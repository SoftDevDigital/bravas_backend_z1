import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@bravas/shared/config';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { HealthController } from './controllers/health.controller';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { MetricsService } from './services/metrics.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { LoggerService } from './common/logger/logger.service';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController, HealthController],
  providers: [
    AuthService,
    SessionsService,
    MetricsService,
    RateLimitMiddleware,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return new LoggerService(configService);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [AuthService, SessionsService, LoggerService, MetricsService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar rate limiting a todas las rutas excepto health checks y Swagger
    consumer
      .apply(RateLimitMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL },
        { path: 'api-docs', method: RequestMethod.ALL },
        { path: 'api-docs/*path', method: RequestMethod.ALL },
        { path: 'openapi.json', method: RequestMethod.ALL }
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
