import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@bravas/shared/config';
import { ConfigService } from '@nestjs/config';
import { UserServiceController } from './user-service.controller';
import { UserService } from './user.service';
import { AvatarController } from './controllers/avatar.controller';
import { VerificationController } from './controllers/verification.controller';
import { HealthController } from './controllers/health.controller';
import { AvatarService } from './services/avatar.service';
import { VerificationService } from './services/verification.service';
import { CacheService } from './services/cache.service';
import { AutomationService } from './services/automation.service';
import { SanitizationService } from './services/sanitization.service';
import { MetricsService } from './services/metrics.service';
import { S3EventListener } from './listeners/s3-event.listener';
import { DynamoDBStreamListener } from './listeners/dynamodb-stream.listener';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { LoggerService } from './common/logger/logger.service';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { SanitizationInterceptor } from './common/interceptors/sanitization.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [ConfigModule],
  controllers: [
    UserServiceController,
    AvatarController,
    VerificationController,
    HealthController,
  ],
  providers: [
    UserService,
    AvatarService,
    VerificationService,
    CacheService,
    AutomationService,
    SanitizationService,
    MetricsService,
    S3EventListener,
    DynamoDBStreamListener,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return new LoggerService(configService);
      },
      inject: [ConfigService],
    },
    RateLimitMiddleware,
    // Interceptores globales
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [
    UserService,
    AvatarService,
    VerificationService,
    CacheService,
    AutomationService,
    SanitizationService,
    MetricsService,
    LoggerService,
  ],
})
export class UserServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar rate limiting a todas las rutas excepto health checks
    consumer
      .apply(RateLimitMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL }
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
