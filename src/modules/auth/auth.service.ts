import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, deviceInfo: Record<string, string> = {}) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verificationToken = uuidv4();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        verificationToken,
        status: UserStatus.PENDING_VERIFICATION,
        role: dto.role === 'USER' ? 'TEAM_MEMBER' : (dto.role as any || 'TEAM_MEMBER'),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(user.email, verificationToken);

    // Create session and issue tokens immediately so the client is authenticated
    const session = await this.createSession(user.id, deviceInfo);
    const tokens = await this.generateTokens(user.id, user.email, user.role, session.id);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto, deviceInfo: Record<string, string> = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account has been suspended');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create session
    const session = await this.createSession(user.id, deviceInfo);

    // Update last active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role, session.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
      },
      ...tokens,
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const session = await this.prisma.session.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // Rotate refresh token (token rotation for security)
    const tokens = await this.generateTokens(
      session.user.id,
      session.user.email,
      session.user.role,
      session.id,
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    });

    return tokens;
  }

  async logout(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isValid: false },
    });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { isValid: false },
    });
    return { message: 'All sessions terminated' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        verificationToken: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If an account exists, a reset email has been sent' };
    }

    const resetToken = uuidv4();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: resetToken,
        metadata: {
          ...(user.metadata as object),
          passwordResetExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      },
    });

    // TODO: await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If an account exists, a reset email has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const metadata = user.metadata as any;
    if (metadata?.passwordResetExpiresAt && new Date(metadata.passwordResetExpiresAt) < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        verificationToken: null,
        metadata: { ...metadata, passwordResetExpiresAt: null },
      },
    });

    // Invalidate all sessions
    await this.prisma.session.updateMany({
      where: { userId: user.id },
      data: { isValid: false },
    });

    return { message: 'Password reset successfully. Please log in.' };
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isValid: true, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async createSession(userId: string, deviceInfo: Record<string, string>) {
    const refreshToken = uuidv4() + '-' + uuidv4();
    return this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        deviceInfo,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    sessionId: string,
  ) {
    const payload = { sub: userId, email, role, sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret') as string,
        expiresIn: this.configService.get<string>('jwt.expiresIn') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret') as string,
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
