import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { v4 as uuidv4 } from 'uuid';
import { StripeService } from './stripe.service';
import { IdempotencyService } from './idempotency.service';
import { LoggerService } from '../common/logger/logger.service';
import { PayoutRecord } from './database-schema.service';
import { PaymentRecord } from './database-schema.service';

/**
 * Servicio de Retiros (Payouts)
 * 
 * Maneja retiros de creadores usando Stripe Connect
 */
@Injectable()
export class PayoutService {
  private readonly logger: LoggerService;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly payoutsTable: string;
  private readonly paymentsTable: string;
  private readonly minPayoutAmount: number = 1000; // $10.00 mínimo

  constructor(
    private configService: ConfigService,
    private stripeService: StripeService,
    private idempotencyService: IdempotencyService,
    loggerService: LoggerService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.payoutsTable = this.credentials.dynamodb?.payoutsTable || `${projectName}-payouts-${environment}`;
    this.paymentsTable = this.credentials.dynamodb?.paymentsTable || `${projectName}-payments-${environment}`;
    this.logger = LoggerService.create('PayoutService', configService);
    
    const minPayout = this.configService.get<number>('MIN_PAYOUT_AMOUNT');
    if (minPayout) {
      this.minPayoutAmount = minPayout;
    }
  }

  /**
   * Crea un retiro para un creador
   */
  async createPayout(
    recipientId: string,
    connectedAccountId: string,
    amount: number, // en centavos
    currency: string,
    paymentIds: string[], // IDs de pagos a incluir
    idempotencyKey?: string,
  ): Promise<PayoutRecord> {
    const startTime = Date.now();

    try {
      // Validar monto mínimo
      if (amount < this.minPayoutAmount) {
        throw new BadRequestException(
          `Monto mínimo para retiro es ${this.minPayoutAmount / 100} ${currency.toUpperCase()}`,
        );
      }

      // Generar idempotency key
      const idempotencyKeyFinal = idempotencyKey || this.idempotencyService.generateIdempotencyKey(recipientId, {
        recipientId,
        amount,
        paymentIds,
      });

      // Crear payout en Stripe
      const stripePayout = await this.stripeService.createPayout(
        connectedAccountId,
        amount,
        currency,
        idempotencyKeyFinal,
      );

      // Crear registro en DynamoDB
      const payoutId = `payout_${recipientId}_${Date.now()}`;
      const now = Date.now();
      const payout: PayoutRecord = {
        payoutId,
        createdAt: new Date().toISOString(),
        recipientId,
        stripePayoutId: stripePayout.id,
        stripeAccountId: connectedAccountId,
        amount,
        currency,
        status: stripePayout.status === 'paid' ? 'paid' : 'pending',
        paymentIds,
        estimatedArrivalDate: stripePayout.arrival_date ? stripePayout.arrival_date * 1000 : undefined,
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
        ttl: Math.floor((now + 7 * 365 * 24 * 60 * 60 * 1000) / 1000),
      };

      // Guardar en DynamoDB
      await this.savePayout(payout);

      // Marcar pagos como incluidos en payout
      await this.markPaymentsAsPayout(paymentIds, payoutId);

      const duration = Date.now() - startTime;
      this.logger.log('Retiro creado exitosamente', 'createPayout', {
        payoutId,
        recipientId,
        amount,
        currency,
        duration: `${duration}ms`,
      });

      return payout;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al crear retiro', error?.stack, 'createPayout', {
        recipientId,
        amount,
        duration: `${duration}ms`,
        error: error.message,
      });

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al crear retiro: ${error.message}`);
    }
  }

  /**
   * Calcula el balance disponible para retiro de un creador
   */
  async calculateAvailableBalance(recipientId: string): Promise<{
    available: number;
    pending: number;
    currency: string;
  }> {
    try {
      // Obtener todos los pagos del creador que no han sido retirados
      const payments = await this.getUnpaidPayments(recipientId);

      let available = 0;
      let pending = 0;
      const currency = payments[0]?.currency || 'usd';

      for (const payment of payments) {
        if (payment.status === 'succeeded') {
          // Solo contar pagos exitosos que tienen más de 7 días (período de espera)
          const daysSincePayment = (Date.now() - payment.processedAt!) / (1000 * 60 * 60 * 24);
          if (daysSincePayment >= 7) {
            available += payment.recipientAmount;
          } else {
            pending += payment.recipientAmount;
          }
        }
      }

      return {
        available: Math.round(available),
        pending: Math.round(pending),
        currency,
      };
    } catch (error: any) {
      this.logger.error('Error al calcular balance', error?.stack, 'calculateAvailableBalance', {
        recipientId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al calcular balance: ${error.message}`);
    }
  }

  /**
   * Obtiene retiros de un creador
   */
  async getCreatorPayouts(recipientId: string, limit: number = 50): Promise<PayoutRecord[]> {
    try {
      const command = new QueryCommand({
        TableName: this.payoutsTable,
        KeyConditionExpression: 'recipientId = :recipientId',
        ExpressionAttributeValues: {
          ':recipientId': recipientId,
        },
        ScanIndexForward: false,
        Limit: limit,
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items || []) as PayoutRecord[];
    } catch (error: any) {
      this.logger.error('Error al obtener retiros', error?.stack, 'getCreatorPayouts', {
        recipientId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener retiros: ${error.message}`);
    }
  }

  private async savePayout(payout: PayoutRecord): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.payoutsTable,
        Item: payout,
      });

      await this.dynamoClient.send(command);
    } catch (error: any) {
      this.logger.error('Error al guardar retiro', error?.stack, 'savePayout', {
        payoutId: payout.payoutId,
        error: error.message,
      });
      throw error;
    }
  }

  private async markPaymentsAsPayout(paymentIds: string[], payoutId: string): Promise<void> {
    // Nota: Esto requeriría agregar un campo payoutId a PaymentRecord
    // Por ahora, solo loggeamos
    this.logger.debug('Marcando pagos como incluidos en retiro', 'markPaymentsAsPayout', {
      paymentIds,
      payoutId,
    });
  }

  private async getUnpaidPayments(recipientId: string): Promise<PaymentRecord[]> {
    try {
      const command = new QueryCommand({
        TableName: this.paymentsTable,
        IndexName: 'recipientId-createdAt-index',
        KeyConditionExpression: 'recipientId = :recipientId',
        FilterExpression: 'attribute_not_exists(payoutId) AND #status = :succeeded',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':recipientId': recipientId,
          ':succeeded': 'succeeded',
        },
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items || []) as PaymentRecord[];
    } catch (error: any) {
      this.logger.error('Error al obtener pagos no retirados', error?.stack, 'getUnpaidPayments', {
        recipientId,
        error: error.message,
      });
      return [];
    }
  }
}

