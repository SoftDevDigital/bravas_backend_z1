import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@bravas/shared/config';
import { ConfigService } from '@nestjs/config';
import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';
import { HealthController } from './controllers/health.controller';
import { PaymentService } from './services/payment.service';
import { SubscriptionService } from './services/subscription.service';
import { PayoutService } from './services/payout.service';
import { StripeService } from './services/stripe.service';
import { PaymentDistributionService } from './services/payment-distribution.service';
import { IdempotencyService } from './services/idempotency.service';
import { SecretsService } from './common/security/secrets.service';
import { EncryptionService } from './common/security/encryption.service';
import { LoggerService } from './common/logger/logger.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { MetricsService } from './services/metrics.service';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentController, WebhookController, HealthController],
  providers: [
    // Servicios principales
    PaymentService,
    SubscriptionService,
    PayoutService,
    StripeService,
    PaymentDistributionService,
    IdempotencyService,
    
    // Servicios de seguridad
    SecretsService,
    EncryptionService,
    
    // Servicios de métricas
    MetricsService,
    
    // Middleware y utilidades
    RateLimitMiddleware,
    {
      provide: LoggerService,
      useFactory: (configService: ConfigService) => {
        return new LoggerService(configService);
      },
      inject: [ConfigService],
    },
    
    // Interceptores y filtros globales
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
  exports: [
    PaymentService,
    SubscriptionService,
    PayoutService,
    StripeService,
    LoggerService,
  ],
})
export class PaymentModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL },
        { path: 'webhooks/stripe', method: RequestMethod.POST }, // Webhooks de Stripe necesitan límites más altos
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

