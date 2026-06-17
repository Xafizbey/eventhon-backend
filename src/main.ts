import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ─── Security Headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ─── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'https://eventhon-admin.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'https://eventhon-backend-production.up.railway.app',
      'http://172.20.10.3:8081',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
  });

  // ─── API Versioning ────────────────────────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── Global Prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: false,
      transform: true, // Auto-transform types (strings to numbers, etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false, // Return all validation errors
    }),
  );

  // ─── WebSocket Adapter ─────────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Swagger / OpenAPI ─────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Eventhon API')
      .setDescription(
        `
## Eventhon — Intelligent Project Management System

Production-ready REST API for team collaboration, task management, and AI-powered insights.

### Authentication
All endpoints require a Bearer JWT token except \`/auth/register\`, \`/auth/login\`, and \`/auth/refresh\`.

### WebSocket
Connect to \`ws://localhost:3000/ws\` for real-time events.
Send \`join:project\` with \`{ projectId }\` to receive project updates.

### Rate Limits
- General: 100 req/min
- Auth endpoints: 10 req/min
      `,
      )
      .setVersion('1.0')
      .addBearerAuth()
      // .addServer('http://localhost:3000', 'Development')
      .addServer(
        'https://eventhon-backend-production.up.railway.app',
        'Production',
      )
      .setContact('Eventhon Team', 'https://eventhon.io', 'api@eventhon.io')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'Eventhon API Docs',
    });

    logger.log(
      `Swagger docs available at: https://eventhon-backend-production.up.railway.app/api/docs`,
    );
  }

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`Eventhon backend running on: http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`WebSocket: ws://localhost:${port}/ws`);
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
