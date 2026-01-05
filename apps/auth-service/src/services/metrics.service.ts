import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

/**
 * Servicio para enviar métricas a CloudWatch
 * Métricas personalizadas para monitoreo del Auth Service
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cloudWatchClient: CloudWatchClient | null = null;
  private readonly namespace: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.namespace = this.configService.get<string>('CLOUDWATCH_NAMESPACE') || 'Bravas/AuthService';
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
      Endpoint: endpoint,
      Method: method,
    });
  }

  /**
   * Registra un error en un endpoint
   */
  async recordError(endpoint: string, method: string, errorCode: string): Promise<void> {
    await this.putMetric('EndpointError', 1, 'Count', {
      Endpoint: endpoint,
      Method: method,
      ErrorCode: errorCode,
    });
  }

  /**
   * Registra tamaño de respuesta
   */
  async recordResponseSize(endpoint: string, sizeBytes: number): Promise<void> {
    await this.putMetric('ResponseSize', sizeBytes, 'Bytes', {
      Endpoint: endpoint,
    });
  }

  /**
   * Registra intentos de registro exitosos
   */
  async recordRegistration(success: boolean): Promise<void> {
    await this.putMetric('Registration', 1, 'Count', {
      Status: success ? 'success' : 'failure',
    });
  }

  /**
   * Registra intentos de login
   */
  async recordLogin(success: boolean, method?: string): Promise<void> {
    await this.putMetric('Login', 1, 'Count', {
      Status: success ? 'success' : 'failure',
      ...(method && { Method: method }),
    });
  }

  /**
   * Registra verificaciones OTP
   */
  async recordOTPVerification(success: boolean): Promise<void> {
    await this.putMetric('OTPVerification', 1, 'Count', {
      Status: success ? 'success' : 'failure',
    });
  }

  /**
   * Registra reenvíos de OTP
   */
  async recordOTPResend(): Promise<void> {
    await this.putMetric('OTPResend', 1, 'Count');
  }

  /**
   * Registra refrescos de token
   */
  async recordTokenRefresh(success: boolean): Promise<void> {
    await this.putMetric('TokenRefresh', 1, 'Count', {
      Status: success ? 'success' : 'failure',
    });
  }

  /**
   * Registra operaciones de sesiones
   */
  async recordSessionOperation(operation: 'create' | 'close' | 'closeAll'): Promise<void> {
    await this.putMetric('SessionOperation', 1, 'Count', {
      Operation: operation,
    });
  }
}




















