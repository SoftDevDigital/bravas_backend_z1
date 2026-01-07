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
import { PaymentDistributionService, DistributionResult } from './payment-distribution.service';
import { IdempotencyService } from './idempotency.service';
import { LoggerService } from '../common/logger/logger.service';
import { PaymentRecord } from './database-schema.service';
import { NotificationClient } from '@bravas/shared';

/**
 * Servicio de Pagos
 * 
 * CRÍTICO: Maneja todas las transacciones de pago
 * 
 * Características:
 * - Idempotencia garantizada
 * - Distribución automática de pagos
 * - Auditoría completa
 * - Manejo robusto de errores
 * - Retries automáticos
 */
@Injectable()
export class PaymentService {
  private readonly logger: LoggerService;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly paymentsTable: string;
  private readonly notificationServiceUrl: string;
  private readonly notificationClient: NotificationClient;

  constructor(
    private configService: ConfigService,
    private stripeService: StripeService,
    private distributionService: PaymentDistributionService,
    private idempotencyService: IdempotencyService,
    loggerService: LoggerService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.paymentsTable = this.credentials.dynamodb?.paymentsTable || `${projectName}-payments-${environment}`;
    this.logger = LoggerService.create('PaymentService', configService);
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1';
    this.notificationClient = new NotificationClient(this.notificationServiceUrl);
  }

  /**
   * Procesa un pago único (tip o PPV)
   * 
   * CRÍTICO: Implementa idempotencia y distribución automática
   */
  async processPayment(
    userId: string,
    recipientId: string,
    amount: number, // en centavos
    currency: string,
    type: 'tip' | 'ppv',
    customerId: string, // Stripe Customer ID
    metadata: Record<string, string>,
    idempotencyKey?: string,
    agencyId?: string,
  ): Promise<PaymentRecord> {
    const startTime = Date.now();

    try {
      // Generar idempotency key si no se proporciona
      const idempotencyKeyFinal = idempotencyKey || this.idempotencyService.generateIdempotencyKey(userId, {
        userId,
        recipientId,
        amount,
        type,
      });

      // Verificar idempotencia
      const requestHash = this.idempotencyService['hashRequest']({
        userId,
        recipientId,
        amount,
        type,
        metadata,
      });
      
      const cachedResponse = await this.idempotencyService.checkIdempotency(
        idempotencyKeyFinal,
        requestHash,
      );

      if (cachedResponse) {
        this.logger.log('Pago procesado (idempotencia)', 'processPayment', {
          idempotencyKey: idempotencyKeyFinal,
          cached: true,
        });
        return cachedResponse.body;
      }

      // Calcular distribución
      const hasAgency = !!agencyId;
      const distribution = this.distributionService.calculateDistribution(amount, hasAgency);

      // Crear PaymentIntent en Stripe
      const paymentIntent = await this.stripeService.createPaymentIntent(
        amount,
        currency,
        customerId,
        {
          ...metadata,
          userId,
          recipientId,
          type,
          agencyId: agencyId || '',
        },
        idempotencyKeyFinal,
      );

      // Crear registro en DynamoDB
      const paymentId = `payment_${Date.now()}_${uuidv4().substring(0, 8)}`;
      const now = Date.now();
      const paymentRecord: PaymentRecord = {
        paymentId,
        createdAt: new Date().toISOString(),
        userId,
        recipientId,
        agencyId,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customerId,
        amount,
        currency,
        platformFee: distribution.bravas.amount,
        recipientAmount: distribution.recipient.amount,
        agencyFee: distribution.agency?.amount,
        type,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        metadata: {
          ...metadata,
          idempotencyKey: idempotencyKeyFinal,
        },
        distribution: {
          bravas: distribution.bravas.amount,
          recipient: distribution.recipient.amount,
          agency: distribution.agency?.amount,
        },
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
        ttl: Math.floor((now + 7 * 365 * 24 * 60 * 60 * 1000) / 1000), // 7 años
      };

      // Guardar en DynamoDB
      await this.savePaymentRecord(paymentRecord);

      // Guardar respuesta para idempotencia
      await this.idempotencyService.saveIdempotencyResponse(
        idempotencyKeyFinal,
        requestHash,
        {
          statusCode: 200,
          body: paymentRecord,
        },
      );

      // Log de transacción
      this.logger.logTransaction(
        paymentId,
        type,
        paymentRecord.status === 'succeeded' ? 'success' : 'pending',
        amount,
        currency,
        {
          userId,
          recipientId,
          distribution: paymentRecord.distribution,
        },
      );

      const duration = Date.now() - startTime;
      this.logger.log('Pago procesado exitosamente', 'processPayment', {
        paymentId,
        amount,
        currency,
        type,
        duration: `${duration}ms`,
      });

      // Crear notificación para el receptor si el pago fue exitoso
      if (paymentRecord.status === 'succeeded') {
        try {
          const amountFormatted = (paymentRecord.recipientAmount / 100).toFixed(2);
          const currencySymbol = paymentRecord.currency.toUpperCase();
          await this.notificationClient.createNotification({
            userId: recipientId,
            type: 'payment',
            title: paymentRecord.type === 'tip' ? 'Nuevo tip recibido' : 'Pago recibido',
            message: `Has recibido ${amountFormatted} ${currencySymbol}${paymentRecord.type === 'tip' ? ' de tip' : ''}`,
            link: `/payments/${paymentId}`,
            metadata: {
              paymentId,
              type: paymentRecord.type,
              amount: paymentRecord.recipientAmount,
              currency: paymentRecord.currency,
            },
          });
        } catch (error: any) {
          this.logger.warn('Error al crear notificación de pago', 'processPayment', {
            paymentId,
            recipientId,
            error: error.message,
          });
        }
      }

      return paymentRecord;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al procesar pago', error?.stack, 'processPayment', {
        userId,
        recipientId,
        amount,
        type,
        duration: `${duration}ms`,
        error: error.message,
      });

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al procesar pago: ${error.message}`);
    }
  }

  /**
   * Confirma un pago (cuando el PaymentIntent se confirma)
   */
  async confirmPayment(paymentIntentId: string): Promise<PaymentRecord> {
    try {
      // Buscar pago por PaymentIntent ID
      const payment = await this.getPaymentByStripeId(paymentIntentId);

      if (!payment) {
        throw new NotFoundException(`Pago no encontrado para PaymentIntent ${paymentIntentId}`);
      }

      if (payment.status === 'succeeded') {
        this.logger.warn('Pago ya confirmado', 'confirmPayment', { paymentId: payment.paymentId });
        return payment;
      }

      // Actualizar estado
      const updatedPayment = await this.updatePaymentStatus(
        payment.paymentId,
        'succeeded',
        Date.now(),
      );

      // Log de transacción
      this.logger.logTransaction(
        payment.paymentId,
        payment.type,
        'success',
        payment.amount,
        payment.currency,
        {
          confirmed: true,
        },
      );

      // Crear notificación para el receptor cuando se confirma el pago
      try {
        const amountFormatted = (updatedPayment.recipientAmount / 100).toFixed(2);
        const currencySymbol = updatedPayment.currency.toUpperCase();
        await this.notificationClient.createNotification({
          userId: updatedPayment.recipientId,
          type: 'payment',
          title: updatedPayment.type === 'tip' ? 'Tip confirmado' : 'Pago confirmado',
          message: `Tu pago de ${amountFormatted} ${currencySymbol}${updatedPayment.type === 'tip' ? ' de tip' : ''} ha sido confirmado`,
          link: `/payments/${updatedPayment.paymentId}`,
          metadata: {
            paymentId: updatedPayment.paymentId,
            type: updatedPayment.type,
            amount: updatedPayment.recipientAmount,
            currency: updatedPayment.currency,
          },
        });
      } catch (error: any) {
        this.logger.warn('Error al crear notificación de confirmación de pago', 'confirmPayment', {
          paymentId: updatedPayment.paymentId,
          recipientId: updatedPayment.recipientId,
          error: error.message,
        });
      }

      return updatedPayment;
    } catch (error: any) {
      this.logger.error('Error al confirmar pago', error?.stack, 'confirmPayment', {
        paymentIntentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtiene un pago por ID
   */
  async getPayment(paymentId: string): Promise<PaymentRecord> {
    try {
      const command = new GetCommand({
        TableName: this.paymentsTable,
        Key: { paymentId },
      });

      const response = await this.dynamoClient.send(command);

      if (!response.Item) {
        throw new NotFoundException(`Pago ${paymentId} no encontrado`);
      }

      return response.Item as PaymentRecord;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error al obtener pago', error?.stack, 'getPayment', {
        paymentId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener pago: ${error.message}`);
    }
  }

  /**
   * Obtiene pagos de un usuario
   */
  async getUserPayments(userId: string, limit: number = 50): Promise<PaymentRecord[]> {
    try {
      const command = new QueryCommand({
        TableName: this.paymentsTable,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Orden descendente (más recientes primero)
        Limit: limit,
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items || []) as PaymentRecord[];
    } catch (error: any) {
      this.logger.error('Error al obtener pagos de usuario', error?.stack, 'getUserPayments', {
        userId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener pagos: ${error.message}`);
    }
  }

  /**
   * Obtener historial de movimientos del buyer con filtros
   */
  async getUserMovements(
    userId: string,
    type: 'purchases' | 'subscriptions' | 'tips' | 'all' = 'all',
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    success: boolean;
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const skip = (page - 1) * limit;

      // Obtener pagos del usuario
      const paymentsResponse = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.paymentsTable,
          IndexName: 'userId-createdAt-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          ScanIndexForward: false,
        }),
      );

      let movements: any[] = [];

      // Procesar pagos según el tipo
      if (type === 'all' || type === 'purchases' || type === 'tips') {
        const payments = (paymentsResponse.Items || []) as PaymentRecord[];
        
        payments.forEach((payment) => {
          if (type === 'all' || (type === 'purchases' && (payment.type === 'ppv' || payment.metadata?.type === 'pack_purchase')) || (type === 'tips' && payment.type === 'tip')) {
            movements.push({
              id: payment.paymentId,
              type: payment.type === 'tip' ? 'tip' : 'purchase',
              amount: payment.amount,
              currency: payment.currency,
              recipientId: payment.recipientId,
              status: payment.status,
              description: payment.metadata?.description || `Pago ${payment.type}`,
              createdAt: payment.createdAt,
              metadata: payment.metadata,
            });
          }
        });
      }

      // Si se solicitan suscripciones, obtenerlas también
      if (type === 'all' || type === 'subscriptions') {
        try {
          const subscriptionsTable = this.credentials.dynamodb?.subscriptionsTable || 'subscriptions';
          const subscriptionsResponse = await this.dynamoClient.send(
            new QueryCommand({
              TableName: subscriptionsTable,
              IndexName: 'userId-createdAt-index',
              KeyConditionExpression: 'userId = :userId',
              ExpressionAttributeValues: {
                ':userId': userId,
              },
              ScanIndexForward: false,
            }),
          );

          (subscriptionsResponse.Items || []).forEach((sub: any) => {
            movements.push({
              id: sub.subscriptionId,
              type: 'subscription',
              amount: sub.amount,
              currency: sub.currency,
              recipientId: sub.recipientId,
              status: sub.status,
              planType: sub.planType,
              description: `Suscripción ${sub.planType} a modelo`,
              createdAt: sub.createdAt,
              currentPeriodEnd: sub.currentPeriodEnd,
            });
          });
        } catch (error) {
          // Si la tabla no existe, continuar sin suscripciones
        }
      }

      // Ordenar por fecha (más recientes primero)
      movements.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Aplicar paginación
      const total = movements.length;
      const paginatedMovements = movements.slice(skip, skip + limit);

      return {
        success: true,
        data: paginatedMovements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error('Error al obtener movimientos', error?.stack, 'getUserMovements', {
        userId,
        type,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener movimientos: ${error.message}`);
    }
  }

  /**
   * Obtiene ingresos de un creador
   */
  async getCreatorPayments(recipientId: string, limit: number = 50): Promise<PaymentRecord[]> {
    try {
      const command = new QueryCommand({
        TableName: this.paymentsTable,
        IndexName: 'recipientId-createdAt-index',
        KeyConditionExpression: 'recipientId = :recipientId',
        ExpressionAttributeValues: {
          ':recipientId': recipientId,
        },
        ScanIndexForward: false,
        Limit: limit,
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items || []) as PaymentRecord[];
    } catch (error: any) {
      this.logger.error('Error al obtener pagos de creador', error?.stack, 'getCreatorPayments', {
        recipientId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener pagos: ${error.message}`);
    }
  }

  /**
   * Guarda un registro de pago en DynamoDB
   */
  private async savePaymentRecord(payment: PaymentRecord): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.paymentsTable,
        Item: payment,
      });

      await this.dynamoClient.send(command);
    } catch (error: any) {
      this.logger.error('Error al guardar pago en DynamoDB', error?.stack, 'savePaymentRecord', {
        paymentId: payment.paymentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Actualiza el estado de un pago
   */
  private async updatePaymentStatus(
    paymentId: string,
    status: PaymentRecord['status'],
    processedAt?: number,
  ): Promise<PaymentRecord> {
    try {
      const command = new UpdateCommand({
        TableName: this.paymentsTable,
        Key: { paymentId },
        UpdateExpression: 'SET #status = :status, updatedAtTimestamp = :updatedAt, #processedAt = :processedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#processedAt': 'processedAt',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': Date.now(),
          ':processedAt': processedAt || Date.now(),
        },
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.dynamoClient.send(command);
      return response.Attributes as PaymentRecord;
    } catch (error: any) {
      this.logger.error('Error al actualizar estado de pago', error?.stack, 'updatePaymentStatus', {
        paymentId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Busca un pago por Stripe PaymentIntent ID
   */
  private async getPaymentByStripeId(paymentIntentId: string): Promise<PaymentRecord | null> {
    try {
      const command = new QueryCommand({
        TableName: this.paymentsTable,
        IndexName: 'stripePaymentIntentId-index',
        KeyConditionExpression: 'stripePaymentIntentId = :paymentIntentId',
        ExpressionAttributeValues: {
          ':paymentIntentId': paymentIntentId,
        },
        Limit: 1,
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items?.[0] as PaymentRecord) || null;
    } catch (error: any) {
      this.logger.error('Error al buscar pago por Stripe ID', error?.stack, 'getPaymentByStripeId', {
        paymentIntentId,
        error: error.message,
      });
      return null;
    }
  }
}

