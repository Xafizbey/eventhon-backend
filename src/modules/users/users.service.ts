import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true, avatarUrl: true,
        bio: true, timezone: true, locale: true, role: true, status: true,
        lastActiveAt: true, createdAt: true,
        _count: {
          select: { assignedTasks: true, createdTasks: true, comments: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        avatarUrl: true, bio: true, timezone: true, locale: true,
      },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  async getWorkload(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        deletedAt: null,
      },
      select: {
        id: true, title: true, priority: true, status: true,
        dueDate: true, estimatedHours: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
    });

    const now = new Date();
    return {
      tasks,
      summary: {
        total: tasks.length,
        overdue: tasks.filter((t) => t.dueDate && t.dueDate < now).length,
        dueThisWeek: tasks.filter((t) => {
          if (!t.dueDate) return false;
          const diff = (t.dueDate.getTime() - now.getTime()) / 86400000;
          return diff >= 0 && diff <= 7;
        }).length,
        estimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      },
    };
  }

  async searchUsers(query: string, orgId?: string) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
        ...(orgId && {
          organizationMemberships: { some: { organizationId: orgId } },
        }),
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, avatarUrl: true, role: true,
      },
      take: 10,
    });
  }

  // Admin only
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, status: true, createdAt: true, lastActiveAt: true,
          _count: { select: { organizationMemberships: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);
    return { data, total, page, limit };
  }

  async suspendUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
    });
  }

  async updateUserRole(userId: string, role: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
    });
  }
}
