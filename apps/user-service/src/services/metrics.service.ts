import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

/**
 * Servicio para enviar métricas a CloudWatch
 * Métricas personalizadas para monitoreo del servicio
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cloudWatchClient: CloudWatchClient | null = null;
  private readonly namespace: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.namespace = this.configService.get<string>('CLOUDWATCH_NAMESPACE') || 'Bravas/UserService';
    this.enabled = this.configService.get<string>('ENABLE_CLOUDWATCH_METRICS') !== 'false';

    if (this.enabled) {
      try {
        this.cloudWatchClient = new CloudWatchClient({
          region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
        });
        this.logger.log('CloudWatch Metrics habilitado');
      } catch (error) {
        this.logger.warn('No se pudo inicializar CloudWatch client, métricas deshabilitadas', error);
        this.cloudWatchClient = null;
      }
    } else {
      this.logger.log('CloudWatch Metrics deshabilitado');
    }
  }

  /**
   * Envía una métrica a CloudWatch
   */
  private async putMetric(
    metricName: string,
    value: number,
    unit: 'Count' | 'Milliseconds' | 'Bytes' | 'Percent' = 'Count',
    dimensions?: Record<string, string>,
  ): Promise<void> {
    if (!this.enabled || !this.cloudWatchClient) {
      return;
    }

    try {
      const metricData = {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        ...(dimensions && {
          Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
        }),
      };

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [metricData],
      });

      await this.cloudWatchClient.send(command);
    } catch (error) {
      // No lanzar error, solo loggear para no afectar el flujo principal
      this.logger.warn(`Error al enviar métrica ${metricName}`, error);
    }
  }

  /**
   * Registra latencia de un endpoint
   */
  async recordLatency(endpoint: string, method: string, latencyMs: number): Promise<void> {
    await this.putMetric('EndpointLatency', latencyMs, 'Milliseconds', {
      endpoint,
      method,
    });
  }

  /**
   * Registra un error
   */
  async recordError(endpoint: string, method: string, errorCode?: string): Promise<void> {
    await this.putMetric('ErrorCount', 1, 'Count', {
      endpoint,
      method,
      ...(errorCode && { errorCode }),
    });
  }

  /**
   * Registra uso de caché (hit)
   */
  async recordCacheHit(cacheKey: string): Promise<void> {
    await this.putMetric('CacheHit', 1, 'Count', {
      cacheKey,
    });
  }

  /**
   * Registra miss de caché
   */
  async recordCacheMiss(cacheKey: string): Promise<void> {
    await this.putMetric('CacheMiss', 1, 'Count', {
      cacheKey,
    });
  }

  /**
   * Registra uso de DynamoDB (RCU)
   */
  async recordDynamoDBRead(operation: string, consumedCapacity: number): Promise<void> {
    await this.putMetric('DynamoDBReadCapacity', consumedCapacity, 'Count', {
      operation,
    });
  }

  /**
   * Registra uso de DynamoDB (WCU)
   */
  async recordDynamoDBWrite(operation: string, consumedCapacity: number): Promise<void> {
    await this.putMetric('DynamoDBWriteCapacity', consumedCapacity, 'Count', {
      operation,
    });
  }

  /**
   * Registra tamaño de respuesta
   */
  async recordResponseSize(endpoint: string, sizeBytes: number): Promise<void> {
    await this.putMetric('ResponseSize', sizeBytes, 'Bytes', {
      endpoint,
    });
  }

  /**
   * Registra tiempo de procesamiento de imagen
   */
  async recordImageProcessingTime(operation: string, timeMs: number): Promise<void> {
    await this.putMetric('ImageProcessingTime', timeMs, 'Milliseconds', {
      operation,
    });
  }
}






















