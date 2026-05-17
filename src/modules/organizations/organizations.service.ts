import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto/organization.dto';
import { MemberRole } from '../../common/enums/roles.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(ownerId: string, dto: CreateOrganizationDto) {
    const slug = this.generateSlug(dto.name);

    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Organization with this name already exists');
    }

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          website: dto.website,
          type: dto.type || 'OTHER',
          status: 'PENDING',
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: ownerId,
          role: MemberRole.OWNER,
        },
      });

      // Update user role
      await tx.user.update({
        where: { id: ownerId },
        data: { role: 'ORG_OWNER' },
      });

      return organization;
    });

    this.eventEmitter.emit('activity.log', {
      organizationId: org.id,
      actorId: ownerId,
      entity: 'ORGANIZATION',
      entityId: org.id,
      action: 'CREATED',
      after: org,
    });

    return org;
  }

  async findById(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      include: {
        _count: {
          select: { members: true, projects: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
    });
  }

  async getMembers(orgId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            avatarUrl: true, role: true, status: true, lastActiveAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async inviteMember(orgId: string, invitedById: string, dto: InviteMemberDto) {
    const org = await this.findById(orgId);

    // Check if user already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    const token = uuidv4();
    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId: orgId,
        email: dto.email.toLowerCase(),
        role: dto.role || MemberRole.MEMBER,
        token,
        invitedById,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // TODO: Send invitation email
    // await this.emailService.sendInvitationEmail(dto.email, org.name, token);

    this.eventEmitter.emit('activity.log', {
      organizationId: orgId,
      actorId: invitedById,
      entity: 'ORGANIZATION',
      entityId: orgId,
      action: 'INVITED',
      after: { email: dto.email, role: dto.role },
    });

    return { message: `Invitation sent to ${dto.email}`, invitationId: invitation.id };
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.expiresAt < new Date() || invitation.acceptedAt) {
      throw new NotFoundException('Invitation is invalid or has expired');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        },
      });

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    return { message: 'Successfully joined organization' };
  }

  async removeMember(orgId: string, userId: string) {
    await this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    return { message: 'Member removed' };
  }

  async updateMemberRole(orgId: string, userId: string, dto: UpdateMemberRoleDto) {
    return this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      data: { role: dto.role as any },
    });
  }

  async getUserOrganizations(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true, name: true, slug: true, logoUrl: true,
            status: true, plan: true,
            _count: { select: { members: true, projects: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50) + '-' + Math.random().toString(36).substring(2, 7);
  }

  async getAll(status?: string) {
    const where = status ? { status: status as any } : {};
    return this.prisma.organization.findMany({
      where,
      include: {
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(orgId: string, status: string, adminId: string) {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { status: status as any },
    });
    
    this.eventEmitter.emit('activity.log', {
      organizationId: org.id,
      actorId: adminId,
      entity: 'ORGANIZATION',
      entityId: org.id,
      action: 'STATUS_CHANGED',
      after: org,
    });
    
    return org;
  }
}
