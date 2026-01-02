import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';
import { SecretsService } from '../common/security/secrets.service';
import { IdempotencyService } from './idempotency.service';

/**
 * Servicio de Stripe
 * 
 * CRÍTICO: Manejo seguro y robusto de todas las operaciones con Stripe
 * 
 * Características:
 * - Retries automáticos con backoff exponencial
 * - Idempotencia en todas las operaciones
 * - Manejo robusto de errores
 * - Logging completo para auditoría
 */
@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 segundo base

  constructor(
    private secretsService: SecretsService,
    private idempotencyService: IdempotencyService,
  ) {}

  async onModuleInit() {
    try {
      const secretKey = await this.secretsService.getStripeSecretKey();
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-02-24.acacia',
        maxNetworkRetries: this.maxRetries,
        timeout: 30000, // 30 segundos
        typescript: true,
      });
      this.logger.log('Stripe client inicializado exitosamente');
    } catch (error: any) {
      this.logger.error('Error al inicializar Stripe client', error.stack);
      throw error;
    }
  }

  /**
   * Ejecuta una operación con retry automático
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    idempotencyKey?: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Backoff exponencial
          this.logger.warn(
            `Reintentando ${operationName} (intento ${attempt + 1}/${this.maxRetries + 1}) después de ${delay}ms`,
          );
          await this.sleep(delay);
        }

        return await operation();
      } catch (error: any) {
        lastError = error;

        // No reintentar en ciertos errores
        if (this.isNonRetryableError(error)) {
          this.logger.error(`Error no reintentable en ${operationName}`, error);
          throw error;
        }

        // Si es el último intento, lanzar error
        if (attempt === this.maxRetries) {
          this.logger.error(
            `Error después de ${this.maxRetries + 1} intentos en ${operationName}`,
            error,
          );
          throw error;
        }
      }
    }

    throw lastError || new Error(`Error desconocido en ${operationName}`);
  }

  /**
   * Crea un PaymentIntent (para pagos únicos: tips, PPV)
   */
  async createPaymentIntent(
    amount: number, // en centavos
    currency: string,
    customerId: string,
    metadata: Record<string, string>,
    idempotencyKey: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.executeWithRetry(
      async () => {
        const paymentIntent = await this.stripe.paymentIntents.create(
          {
            amount,
            currency,
            customer: customerId,
            metadata,
            automatic_payment_methods: {
              enabled: true,
            },
          },
          {
            idempotencyKey, // Stripe también maneja idempotencia
          },
        );

        this.logger.log('PaymentIntent creado', {
          paymentIntentId: paymentIntent.id,
          amount,
          currency,
          customerId,
        });

        return paymentIntent;
      },
      'createPaymentIntent',
      idempotencyKey,
    );
  }

  /**
   * Confirma un PaymentIntent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.executeWithRetry(
      async () => {
        const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
          payment_method: paymentMethodId,
        });

        this.logger.log('PaymentIntent confirmado', {
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
        });

        return paymentIntent;
      },
      'confirmPaymentIntent',
    );
  }

  /**
   * Crea una suscripción usando Stripe Connect
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    connectedAccountId: string, // Stripe Connect Account del creador
    applicationFeePercent: number, // Porcentaje de comisión para Bravas
    metadata: Record<string, string>,
    idempotencyKey: string,
  ): Promise<Stripe.Subscription> {
    return this.executeWithRetry(
      async () => {
        const subscription = await this.stripe.subscriptions.create(
          {
            customer: customerId,
            items: [{ price: priceId }],
            application_fee_percent: applicationFeePercent,
            transfer_data: {
              destination: connectedAccountId,
            },
            metadata,
          },
          {
            idempotencyKey,
          },
        );

        this.logger.log('Suscripción creada', {
          subscriptionId: subscription.id,
          customerId,
          connectedAccountId,
        });

        return subscription;
      },
      'createSubscription',
      idempotencyKey,
    );
  }

  /**
   * Crea un Connect Account (onboarding de creador)
   */
  async createConnectAccount(
    email: string,
    country: string,
    type: 'express' | 'standard' = 'express',
  ): Promise<Stripe.Account> {
    return this.executeWithRetry(
      async () => {
        const account = await this.stripe.accounts.create({
          type,
          country,
          email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });

        this.logger.log('Connect Account creado', {
          accountId: account.id,
          email,
          country,
        });

        return account;
      },
      'createConnectAccount',
    );
  }

  /**
   * Crea un link de onboarding para Connect Account
   */
  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    return this.executeWithRetry(
      async () => {
        const accountLink = await this.stripe.accountLinks.create({
          account: accountId,
          return_url: returnUrl,
          refresh_url: refreshUrl,
          type: 'account_onboarding',
        });

        this.logger.log('Account Link creado', {
          accountId,
          url: accountLink.url,
        });

        return accountLink.url;
      },
      'createAccountLink',
    );
  }

  /**
   * Obtiene información de un Connect Account
   */
  async getConnectAccount(accountId: string): Promise<Stripe.Account> {
    return this.executeWithRetry(
      async () => {
        return await this.stripe.accounts.retrieve(accountId);
      },
      'getConnectAccount',
    );
  }

  /**
   * Crea un retiro (payout) para un creador
   */
  async createPayout(
    connectedAccountId: string,
    amount: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<Stripe.Payout> {
    return this.executeWithRetry(
      async () => {
        const payout = await this.stripe.payouts.create(
          {
            amount,
            currency,
          },
          {
            stripeAccount: connectedAccountId,
            idempotencyKey,
          },
        );

        this.logger.log('Payout creado', {
          payoutId: payout.id,
          accountId: connectedAccountId,
          amount,
          currency,
        });

        return payout;
      },
      'createPayout',
      idempotencyKey,
    );
  }

  /**
   * Verifica la firma de un webhook
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      this.logger.error('Error al verificar firma de webhook', error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Determina si un error es no reintentable
   */
  private isNonRetryableError(error: any): boolean {
    if (!error.type) return false;

    const nonRetryableTypes = [
      'StripeCardError', // Error de tarjeta (número inválido, etc.)
      'StripeInvalidRequestError', // Request inválido
      'StripeAuthenticationError', // Error de autenticación
      'StripePermissionError', // Sin permisos
    ];

    return nonRetryableTypes.includes(error.type);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Getter para acceso directo al cliente Stripe (solo si es necesario)
   */
  getStripeClient(): Stripe {
    return this.stripe;
  }
}



