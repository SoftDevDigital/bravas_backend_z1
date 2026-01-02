import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@bravas/shared/config';
import { ConfigService } from '@nestjs/config';
import { MessagesController } from './controllers/messages.controller';
import { HealthController } from './controllers/health.controller';
import { MessagesService } from './services/messages.service';
import { LoggerService } from './common/logger/logger.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [MessagesController, HealthController],
  providers: [
    MessagesService,
    RateLimitMiddleware,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return LoggerService.create('MessagesModule', configService);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [MessagesService, LoggerService],
})
export class MessagesModule implements NestModule {
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

