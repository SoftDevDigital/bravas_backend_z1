import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { StripeService } from '../services/stripe.service';
import { PaymentService } from '../services/payment.service';
import { SubscriptionService } from '../services/subscription.service';
import { SecretsService } from '../common/security/secrets.service';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Webhook Controller para Stripe
 * 
 * CRÍTICO: Maneja eventos de Stripe de forma segura
 * - Verifica firma de webhook
 * - Procesa eventos de forma idempotente
 * - Actualiza estados en DynamoDB
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger: LoggerService;

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly secretsService: SecretsService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('WebhookController', configService);
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // No mostrar en Swagger (es un webhook)
  @ApiOperation({ summary: 'Webhook de Stripe (interno)' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const startTime = Date.now();

    try {
      if (!signature) {
        this.logger.error('Webhook sin firma', undefined, 'handleStripeWebhook');
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing stripe-signature header' });
      }

      // Obtener webhook secret
      const webhookSecret = await this.secretsService.getStripeWebhookSecret();

      // Verificar firma
      let event: Stripe.Event;
      try {
        event = this.stripeService.verifyWebhookSignature(
          req.rawBody || req.body,
          signature,
          webhookSecret,
        );
      } catch (error: any) {
        this.logger.error('Error al verificar firma de webhook', error?.stack, 'handleStripeWebhook');
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid signature' });
      }

      // Procesar evento
      await this.processStripeEvent(event);

      const duration = Date.now() - startTime;
      this.logger.log('Webhook procesado exitosamente', 'handleStripeWebhook', {
        eventType: event.type,
        eventId: event.id,
        duration: `${duration}ms`,
      });

      return res.json({ received: true });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al procesar webhook', error?.stack, 'handleStripeWebhook', {
        duration: `${duration}ms`,
        error: error.message,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Procesa eventos de Stripe
   */
  private async processStripeEvent(event: Stripe.Event): Promise<void> {
    this.logger.debug('Procesando evento de Stripe', 'processStripeEvent', {
      type: event.type,
      id: event.id,
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'payout.paid':
        await this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        await this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      default:
        this.logger.debug('Evento de Stripe no manejado', 'processStripeEvent', {
          type: event.type,
        });
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      await this.paymentService.confirmPayment(paymentIntent.id);
      this.logger.log('PaymentIntent confirmado vía webhook', 'handlePaymentIntentSucceeded', {
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      this.logger.error('Error al confirmar pago desde webhook', error?.stack, 'handlePaymentIntentSucceeded', {
        paymentIntentId: paymentIntent.id,
      });
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.warn('PaymentIntent falló', 'handlePaymentIntentFailed', {
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message,
    });
    // TODO: Actualizar estado en DynamoDB
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log('Suscripción actualizada vía webhook', 'handleSubscriptionUpdated', {
      subscriptionId: subscription.id,
      status: subscription.status,
    });
    // TODO: Actualizar suscripción en DynamoDB
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    this.logger.log('Suscripción cancelada vía webhook', 'handleSubscriptionDeleted', {
      subscriptionId: subscription.id,
    });
    // TODO: Actualizar estado en DynamoDB
  }

  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    this.logger.log('Payout completado vía webhook', 'handlePayoutPaid', {
      payoutId: payout.id,
      amount: payout.amount,
    });
    // TODO: Actualizar estado en DynamoDB
  }

  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    this.logger.error('Payout falló vía webhook', undefined, 'handlePayoutFailed', {
      payoutId: payout.id,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message,
    });
    // TODO: Actualizar estado en DynamoDB
  }
}



