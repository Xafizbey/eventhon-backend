import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { WsEventType } from '../../common/enums/domain.enum';

interface AuthenticatedSocket extends Socket {
  userId: string;
  orgId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      client.userId = payload.sub;
      client.join(`user:${payload.sub}`);

      // Track online users
      if (!this.connectedUsers.has(payload.sub)) {
        this.connectedUsers.set(payload.sub, new Set());
      }
      this.connectedUsers.get(payload.sub)!.add(client.id);

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
      client.emit('connected', { message: 'Connected to Eventhon WebSocket' });
    } catch (err) {
      this.logger.warn(`Connection rejected: ${err.message}`);
      client.emit('error', { message: 'Invalid authentication token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.connectedUsers.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.connectedUsers.delete(client.userId);
        }
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ─── Room Management ──────────────────────────────────────────────────────────

  @SubscribeMessage('join:project')
  handleJoinProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    client.join(`project:${data.projectId}`);
    client.emit('joined', { room: `project:${data.projectId}` });
    this.logger.debug(`${client.userId} joined project:${data.projectId}`);
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    client.leave(`project:${data.projectId}`);
  }

  @SubscribeMessage('join:task')
  handleJoinTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    client.join(`task:${data.taskId}`);
    client.emit('joined', { room: `task:${data.taskId}` });
  }

  @SubscribeMessage('leave:task')
  handleLeaveTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    client.leave(`task:${data.taskId}`);
  }

  @SubscribeMessage('user:typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string; isTyping: boolean },
  ) {
    client.to(`task:${data.taskId}`).emit(WsEventType.USER_TYPING, {
      userId: client.userId,
      taskId: data.taskId,
      isTyping: data.isTyping,
    });
  }

  // ─── Event Listeners (from other services via EventEmitter) ──────────────────

  @OnEvent('ws.broadcast')
  handleBroadcastEvent(payload: { room: string; event: string; data: any }) {
    this.server.to(payload.room).emit(payload.event, payload.data);
  }

  @OnEvent('ws.send.user')
  handleSendToUser(payload: { userId: string; event: string; data: any }) {
    this.server.to(`user:${payload.userId}`).emit(payload.event, payload.data);
  }

  // ─── Presence API ─────────────────────────────────────────────────────────────

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}
