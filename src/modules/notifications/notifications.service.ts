import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WsEventType } from '../../common/enums/domain.enum';

export interface SendNotificationPayload {
  recipientId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  channel?: 'IN_APP' | 'EMAIL' | 'PUSH';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('notification.send', { async: true })
  async handleSendNotification(payload: SendNotificationPayload) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          organizationId: payload.organizationId,
          recipientId: payload.recipientId,
          type: payload.type as any,
          channel: payload.channel || 'IN_APP',
          title: payload.title,
          message: payload.message,
          data: payload.data || {},
          sentAt: new Date(),
        },
      });

      // Push to WebSocket for real-time delivery
      this.eventEmitter.emit('ws.send.user', {
        userId: payload.recipientId,
        event: WsEventType.NOTIFICATION_NEW,
        data: notification,
      });

      // TODO: Queue email if channel is EMAIL
      // await this.emailQueue.add('send-email', { notification });

    } catch (err) {
      this.logger.error('Failed to send notification:', err.message);
    }
  }

  async getNotifications(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, recipientId: userId },
    });
    return { deleted: true };
  }
}
