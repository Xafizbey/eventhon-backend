import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// Config
import {
  appConfig,
  jwtConfig,
  databaseConfig,
  redisConfig,
  emailConfig,
  storageConfig,
  aiConfig,
  throttleConfig,
} from './config/app.config';

// Core
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

// Common
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    // Configuration — loaded globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        databaseConfig,
        redisConfig,
        emailConfig,
        storageConfig,
        aiConfig,
        throttleConfig,
      ],
      envFilePath: '.env',
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
          },
        ],
      }),
    }),

    // Event Bus (in-process events between modules)
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    // Scheduled Tasks (overdue check, snapshots, etc.)
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Health check (used by Railway / Docker HEALTHCHECK)
    HealthModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    TasksModule,
    AiModule,
    NotificationsModule,
    ActivityModule,
    AnalyticsModule,
    WebsocketModule,
  ],

  providers: [
    // Global JWT Guard — all routes protected by default
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global Roles Guard
    { provide: APP_GUARD, useClass: RolesGuard },

    // Global Exception Filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // Global Response Transform
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

    // Global Logging
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
