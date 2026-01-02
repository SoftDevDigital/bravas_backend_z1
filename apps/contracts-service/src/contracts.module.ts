import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@bravas/shared';
import { ConfigService } from '@nestjs/config';
import { ContractsController } from './controllers/contracts.controller';
import { HealthController } from './controllers/health.controller';
import { ContractsService } from './services/contracts.service';
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
  controllers: [ContractsController, HealthController],
  providers: [
    ContractsService,
    RateLimitMiddleware,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return LoggerService.create('ContractsModule', configService);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [ContractsService, LoggerService],
})
export class ContractsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

