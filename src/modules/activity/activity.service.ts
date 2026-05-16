import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';

export interface ActivityLogPayload {
  organizationId: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  entity: string;
  entityId: string;
  action: string;
  before?: any;
  after?: any;
  metadata?: any;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('activity.log', { async: true })
  async handleActivityLog(payload: ActivityLogPayload) {
    try {
      await this.prisma.activity.create({
        data: {
          organizationId: payload.organizationId,
          projectId: payload.projectId,
          taskId: payload.taskId,
          actorId: payload.actorId,
          entity: payload.entity as any,
          entityId: payload.entityId,
          action: payload.action as any,
          before: payload.before ? JSON.parse(JSON.stringify(payload.before)) : undefined,
          after: payload.after ? JSON.parse(JSON.stringify(payload.after)) : undefined,
          metadata: payload.metadata || {},
        },
      });
    } catch (err) {
      this.logger.error('Failed to log activity:', err.message);
    }
  }

  async getProjectActivity(projectId: string, limit = 50) {
    return this.prisma.activity.findMany({
      where: { projectId },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUserActivity(userId: string, limit = 50) {
    return this.prisma.activity.findMany({
      where: { actorId: userId },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getOrganizationActivity(organizationId: string, limit = 100) {
    return this.prisma.activity.findMany({
      where: { organizationId },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async logSecurityEvent(
    userId: string | null,
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: any,
    status: 'success' | 'failure' = 'success',
  ) {
    return this.prisma.activityLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        status,
        metadata: metadata || {},
      },
    });
  }
}
