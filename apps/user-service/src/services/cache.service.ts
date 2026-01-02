import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { MetricsService } from './metrics.service';

/**
 * Servicio de caché usando DynamoDB con TTL
 * Optimización para consultas frecuentes
 * 
 * Estrategias implementadas:
 * 1. Caché de perfiles de usuario (TTL: 5 minutos)
 * 2. Caché de listados de marketplace (TTL: 2 minutos)
 * 3. Caché de estadísticas (TTL: 10 minutos)
 * 4. Caché de relaciones (TTL: 15 minutos)
 */
@Injectable()
export class CacheService {
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;
  private readonly CACHE_TABLE: string;
  private readonly DEFAULT_TTL = 300; // 5 minutos en segundos
  private readonly isProduction: boolean;

  constructor(
    private configService: ConfigService,
    @Optional() @Inject(MetricsService) private metricsService?: MetricsService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    this.isProduction = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev') === 'production';
    
    // Usar tabla de caché según el entorno
    this.CACHE_TABLE = process.env.DYNAMODB_CACHE_TABLE || 
      (this.isProduction ? 'bravas-cache-prod' : 'bravas-cache-dev');
  }

  /**
   * Obtener valor del caché
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.CACHE_TABLE,
          Key: { cacheKey: key },
        })
      );

      if (!response.Item) {
        // Registrar cache miss
        this.metricsService?.recordCacheMiss(key).catch(() => {});
        return null;
      }

      // Verificar si expiró (TTL)
      const now = Math.floor(Date.now() / 1000);
      if (response.Item.ttl && response.Item.ttl < now) {
        // Eliminar del caché si expiró
        await this.delete(key);
        // Registrar cache miss
        this.metricsService?.recordCacheMiss(key).catch(() => {});
        return null;
      }

      // Registrar cache hit
      this.metricsService?.recordCacheHit(key).catch(() => {});
      return response.Item.value as T;
    } catch (error) {
      // Si la tabla no existe, retornar null (caché opcional)
      return null;
    }
  }

  /**
   * Guardar valor en caché
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.CACHE_TABLE,
          Item: {
            cacheKey: key,
            value,
            ttl,
            createdAt: new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      // Si la tabla no existe, ignorar (caché opcional)
    }
  }

  /**
   * Eliminar del caché
   */
  async delete(key: string): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.CACHE_TABLE,
          Key: { cacheKey: key },
          UpdateExpression: 'SET ttl = :ttl',
          ExpressionAttributeValues: {
            ':ttl': 0, // Marcar como expirado
          },
        })
      );
    } catch (error) {
      // Ignorar errores
    }
  }

  /**
   * Invalidar caché por patrón (prefijo)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // En producción, usar GSI con cacheKey como PK y buscar por prefijo
      // Por ahora, implementación simplificada
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.CACHE_TABLE,
          KeyConditionExpression: 'begins_with(cacheKey, :pattern)',
          ExpressionAttributeValues: {
            ':pattern': pattern,
          },
        })
      );

      if (response.Items) {
        await Promise.all(
          response.Items.map((item) => this.delete(item.cacheKey))
        );
      }
    } catch (error) {
      // Ignorar errores
    }
  }

  /**
   * Generar clave de caché para perfil de usuario
   */
  static getUserProfileCacheKey(userId: string): string {
    return `user:profile:${userId}`;
  }

  /**
   * Generar clave de caché para marketplace
   */
  static getMarketplaceCacheKey(
    type: 'models' | 'agencies',
    filters: Record<string, any>
  ): string {
    const filterStr = JSON.stringify(filters);
    return `marketplace:${type}:${Buffer.from(filterStr).toString('base64')}`;
  }

  /**
   * Generar clave de caché para estadísticas
   */
  static getStatsCacheKey(userId: string, type: string): string {
    return `stats:${userId}:${type}`;
  }

  /**
   * Generar clave de caché para estadísticas de plataforma
   */
  static getPlatformStatsCacheKey(): string {
    return 'platform:stats';
  }
}

