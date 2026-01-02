import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@bravas/shared';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './controllers/health.controller';
import { UsersController } from './controllers/users.controller';
import { ContentController } from './controllers/content.controller';
import { PaymentsController } from './controllers/payments.controller';
import { ReportsController } from './controllers/reports.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminPaymentsService } from './services/admin-payments.service';
import { AdminReportsService } from './services/admin-reports.service';
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
  controllers: [
    HealthController,
    UsersController,
    ContentController,
    PaymentsController,
    ReportsController,
  ],
  providers: [
    AdminUsersService,
    AdminContentService,
    AdminPaymentsService,
    AdminReportsService,
    RateLimitMiddleware,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return LoggerService.create('AdminModule', configService);
      },
      inject: [ConfigService],
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [LoggerService, AdminUsersService, AdminContentService, AdminPaymentsService, AdminReportsService],
})
export class AdminServiceModule implements NestModule {
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
