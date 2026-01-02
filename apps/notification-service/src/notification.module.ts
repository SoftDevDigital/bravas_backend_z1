import { Module, MiddlewareConsumer, NestModule, RequestMethod, OnModuleInit } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@bravas/shared/config';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './controllers/notifications.controller';
import { HealthController } from './controllers/health.controller';
import { NotificationsService } from './services/notifications.service';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { LoggerService } from './common/logger/logger.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [NotificationsController, HealthController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    RateLimitMiddleware,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return LoggerService.create('NotificationModule', configService);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [NotificationsService, LoggerService],
})
export class NotificationModule implements NestModule, OnModuleInit {
  constructor(
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  onModuleInit() {
    // Resolver dependencia circular: inyectar gateway en el servicio
    this.notificationsService.setGateway(this.notificationsGateway);
  }

  configure(consumer: MiddlewareConsumer) {
    // Aplicar rate limiting a todas las rutas excepto health checks
    consumer
      .apply(RateLimitMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

