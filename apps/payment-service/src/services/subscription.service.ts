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
import { PaymentDistributionService } from './payment-distribution.service';
import { IdempotencyService } from './idempotency.service';
import { LoggerService } from '../common/logger/logger.service';
import { SubscriptionRecord } from './database-schema.service';

/**
 * Servicio de Suscripciones
 * 
 * Maneja suscripciones recurrentes usando Stripe Connect
 */
@Injectable()
export class SubscriptionService {
  private readonly logger: LoggerService;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly subscriptionsTable: string;

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
    this.subscriptionsTable = this.credentials.dynamodb?.subscriptionsTable || `${projectName}-subscriptions-${environment}`;
    this.logger = LoggerService.create('SubscriptionService', configService);
  }

  /**
   * Crea una suscripción
   */
  async createSubscription(
    userId: string,
    recipientId: string,
    planType: 'basic' | 'premium' | 'vip',
    amount: number, // en centavos
    currency: string,
    customerId: string,
    connectedAccountId: string, // Stripe Connect Account del creador
    agencyId?: string,
    idempotencyKey?: string,
  ): Promise<SubscriptionRecord> {
    const startTime = Date.now();

    try {
      // Generar idempotency key
      const idempotencyKeyFinal = idempotencyKey || this.idempotencyService.generateIdempotencyKey(userId, {
        userId,
        recipientId,
        planType,
      });

      // Calcular distribución
      const hasAgency = !!agencyId;
      const distribution = this.distributionService.calculateDistribution(amount, hasAgency);

      // Calcular application fee percent para Stripe
      const applicationFeePercent = distribution.bravas.percentage;

      // Obtener price ID desde configuración o metadata
      const priceId = this.getPriceIdForPlan(planType);

      // Crear suscripción en Stripe
      const stripeSubscription = await this.stripeService.createSubscription(
        customerId,
        priceId,
        connectedAccountId,
        applicationFeePercent,
        {
          userId,
          recipientId,
          planType,
          agencyId: agencyId || '',
        },
        idempotencyKeyFinal,
      );

      // Crear registro en DynamoDB
      const subscriptionId = `sub_${userId}_${recipientId}`;
      const now = Date.now();
      const subscription: SubscriptionRecord = {
        subscriptionId,
        createdAt: new Date().toISOString(),
        userId,
        recipientId,
        agencyId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        planType,
        amount,
        currency,
        status: stripeSubscription.status as SubscriptionRecord['status'],
        currentPeriodStart: stripeSubscription.current_period_start * 1000,
        currentPeriodEnd: stripeSubscription.current_period_end * 1000,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        distribution: {
          bravas: distribution.bravas.amount,
          recipient: distribution.recipient.amount,
          agency: distribution.agency?.amount,
        },
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
        ttl: Math.floor((now + 7 * 365 * 24 * 60 * 60 * 1000) / 1000),
      };

      // Guardar en DynamoDB
      await this.saveSubscription(subscription);

      const duration = Date.now() - startTime;
      this.logger.log('Suscripción creada exitosamente', 'createSubscription', {
        subscriptionId,
        userId,
        recipientId,
        planType,
        amount,
        duration: `${duration}ms`,
      });

      return subscription;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al crear suscripción', error?.stack, 'createSubscription', {
        userId,
        recipientId,
        planType,
        duration: `${duration}ms`,
        error: error.message,
      });

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al crear suscripción: ${error.message}`);
    }
  }

  /**
   * Cancela una suscripción
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelImmediately: boolean = false,
  ): Promise<SubscriptionRecord> {
    try {
      const subscription = await this.getSubscription(subscriptionId);

      if (!subscription) {
        throw new NotFoundException(`Suscripción ${subscriptionId} no encontrada`);
      }

      // Cancelar en Stripe
      const stripeSubscription = await this.stripeService.getStripeClient().subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: !cancelImmediately,
        },
      );

      // Actualizar en DynamoDB
      const updated = await this.updateSubscription(subscriptionId, {
        status: stripeSubscription.status as SubscriptionRecord['status'],
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: cancelImmediately ? Date.now() : undefined,
      });

      this.logger.log('Suscripción cancelada', 'cancelSubscription', {
        subscriptionId,
        cancelImmediately,
      });

      return updated;
    } catch (error: any) {
      this.logger.error('Error al cancelar suscripción', error?.stack, 'cancelSubscription', {
        subscriptionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtiene una suscripción por ID
   */
  async getSubscription(subscriptionId: string): Promise<SubscriptionRecord | null> {
    try {
      const command = new GetCommand({
        TableName: this.subscriptionsTable,
        Key: { subscriptionId },
      });

      const response = await this.dynamoClient.send(command);
      return (response.Item as SubscriptionRecord) || null;
    } catch (error: any) {
      this.logger.error('Error al obtener suscripción', error?.stack, 'getSubscription', {
        subscriptionId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Obtiene suscripciones activas de un usuario
   */
  async getUserSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
    try {
      const command = new QueryCommand({
        TableName: this.subscriptionsTable,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#status IN (:active, :trialing)',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':active': 'active',
          ':trialing': 'trialing',
        },
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items || []) as SubscriptionRecord[];
    } catch (error: any) {
      this.logger.error('Error al obtener suscripciones de usuario', error?.stack, 'getUserSubscriptions', {
        userId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener suscripciones: ${error.message}`);
    }
  }

  /**
   * Obtiene suscriptores de un creador
   */
  async getCreatorSubscribers(recipientId: string): Promise<SubscriptionRecord[]> {
    try {
      const command = new QueryCommand({
        TableName: this.subscriptionsTable,
        IndexName: 'recipientId-createdAt-index',
        KeyConditionExpression: 'recipientId = :recipientId',
        FilterExpression: '#status = :active',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':recipientId': recipientId,
          ':active': 'active',
        },
      });

      const response = await this.dynamoClient.send(command);
      return (response.Items || []) as SubscriptionRecord[];
    } catch (error: any) {
      this.logger.error('Error al obtener suscriptores', error?.stack, 'getCreatorSubscribers', {
        recipientId,
        error: error.message,
      });
      throw new InternalServerErrorException(`Error al obtener suscriptores: ${error.message}`);
    }
  }

  private async saveSubscription(subscription: SubscriptionRecord): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.subscriptionsTable,
        Item: subscription,
      });

      await this.dynamoClient.send(command);
    } catch (error: any) {
      this.logger.error('Error al guardar suscripción', error?.stack, 'saveSubscription', {
        subscriptionId: subscription.subscriptionId,
        error: error.message,
      });
      throw error;
    }
  }

  private async updateSubscription(
    subscriptionId: string,
    updates: Partial<SubscriptionRecord>,
  ): Promise<SubscriptionRecord> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.keys(updates).forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = updates[key as keyof SubscriptionRecord];
        updateExpressions.push(`${attrName} = ${attrValue}`);
      });

      updateExpressions.push('updatedAtTimestamp = :updatedAt');
      expressionAttributeValues[':updatedAt'] = Date.now();

      const command = new UpdateCommand({
        TableName: this.subscriptionsTable,
        Key: { subscriptionId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.dynamoClient.send(command);
      return response.Attributes as SubscriptionRecord;
    } catch (error: any) {
      this.logger.error('Error al actualizar suscripción', error?.stack, 'updateSubscription', {
        subscriptionId,
        error: error.message,
      });
      throw error;
    }
  }

  private getPriceIdForPlan(planType: 'basic' | 'premium' | 'vip'): string {
    // Estos deben configurarse en Stripe y en variables de entorno
    const priceIds: Record<string, string> = {
      basic: this.configService.get<string>('STRIPE_PRICE_BASIC') || '',
      premium: this.configService.get<string>('STRIPE_PRICE_PREMIUM') || '',
      vip: this.configService.get<string>('STRIPE_PRICE_VIP') || '',
    };

    const priceId = priceIds[planType];
    if (!priceId) {
      throw new BadRequestException(`Price ID no configurado para plan ${planType}`);
    }

    return priceId;
  }
}

