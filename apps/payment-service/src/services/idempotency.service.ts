import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { createHash } from 'crypto';

/**
 * Servicio de Idempotencia
 * 
 * CRÍTICO: Previene transacciones duplicadas
 * Implementa el patrón de idempotencia usado por grandes plataformas (Stripe, PayPal, etc.)
 * 
 * Estrategia:
 * 1. Cada request debe incluir un idempotency-key único
 * 2. Si la key ya existe, retornamos la respuesta cacheada
 * 3. Si no existe, procesamos y guardamos la respuesta
 * 4. TTL de 24 horas para limpieza automática
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private dynamoClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly credentials: ReturnType<typeof loadCredentials>;

  constructor() {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.tableName = this.credentials.dynamodb?.idempotencyTable || `${projectName}-idempotency-keys-${environment}`;
  }

  /**
   * Genera una clave de idempotencia única
   * Formato: {userId}_{timestamp}_{hash}
   */
  generateIdempotencyKey(userId: string, requestData: any): string {
    const timestamp = Date.now();
    const requestHash = this.hashRequest(requestData);
    return `${userId}_${timestamp}_${requestHash.substring(0, 8)}`;
  }

  /**
   * Verifica si una clave de idempotencia ya existe
   * Si existe, retorna la respuesta cacheada
   * Si no existe, retorna null
   */
  async checkIdempotency(idempotencyKey: string, requestHash: string): Promise<any | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          idempotencyKey,
        },
      });

      const response = await this.dynamoClient.send(command);

      if (!response.Item) {
        // No existe, puede procesar
        return null;
      }

      const item = response.Item as any;

      // Verificar que la request sea la misma
      if (item.requestHash !== requestHash) {
        this.logger.warn(
          `Idempotency key ${idempotencyKey} existe pero con request diferente. Posible colisión.`,
        );
        throw new Error('Idempotency key conflict: Request data mismatch');
      }

      // Verificar que no haya expirado
      if (Date.now() > item.expiresAt) {
        this.logger.warn(`Idempotency key ${idempotencyKey} expirada`);
        return null;
      }

      // Retornar respuesta cacheada
      this.logger.debug(`Idempotency hit para key: ${idempotencyKey}`);
      return item.response;
    } catch (error: any) {
      this.logger.error(`Error al verificar idempotencia: ${error.message}`, error.stack);
      // En caso de error, permitir procesar (fail open)
      // Pero loggear para investigar
      return null;
    }
  }

  /**
   * Guarda la respuesta de una transacción para idempotencia
   */
  async saveIdempotencyResponse(
    idempotencyKey: string,
    requestHash: string,
    response: { statusCode: number; body: any },
  ): Promise<void> {
    try {
      const now = Date.now();
      const expiresAt = now + 24 * 60 * 60 * 1000; // 24 horas
      const ttl = Math.floor(expiresAt / 1000); // TTL en segundos (DynamoDB)

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          idempotencyKey,
          requestHash,
          response,
          createdAt: now,
          expiresAt,
          ttl,
        },
        // Solo crear si no existe (prevenir race conditions)
        ConditionExpression: 'attribute_not_exists(idempotencyKey)',
      });

      await this.dynamoClient.send(command);
      this.logger.debug(`Idempotency response guardada para key: ${idempotencyKey}`);
    } catch (error: any) {
      // Si ya existe, está bien (otra request ya la guardó)
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.debug(`Idempotency key ${idempotencyKey} ya existe (race condition manejada)`);
        return;
      }
      
      this.logger.error(`Error al guardar idempotencia: ${error.message}`, error.stack);
      // No lanzar error - idempotencia es best effort
    }
  }

  /**
   * Calcula hash de la request para validación
   */
  private hashRequest(requestData: any): string {
    const jsonString = JSON.stringify(requestData, Object.keys(requestData).sort());
    return createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Limpia claves expiradas (útil para mantenimiento)
   * DynamoDB lo hace automáticamente con TTL, pero podemos forzar limpieza
   */
  async cleanupExpiredKeys(): Promise<number> {
    // Nota: DynamoDB limpia automáticamente con TTL
    // Este método es solo para logging/monitoreo
    this.logger.debug('Limpieza de claves expiradas manejada automáticamente por DynamoDB TTL');
    return 0;
  }
}

