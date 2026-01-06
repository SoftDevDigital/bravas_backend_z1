import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cloudWatchClient: CloudWatchClient | null = null;
  private readonly namespace: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.namespace = this.configService.get<string>('CLOUDWATCH_NAMESPACE') || 'Bravas/PaymentService';
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
      this.logger.warn(`Error al enviar métrica ${metricName}`, error);
    }
  }

  async recordLatency(endpoint: string, method: string, latencyMs: number): Promise<void> {
    await this.putMetric('EndpointLatency', latencyMs, 'Milliseconds', {
      Endpoint: endpoint,
      Method: method,
    });
  }

  async recordError(endpoint: string, method: string, errorCode: string): Promise<void> {
    await this.putMetric('EndpointError', 1, 'Count', {
      Endpoint: endpoint,
      Method: method,
      ErrorCode: errorCode,
    });
  }

  async recordResponseSize(endpoint: string, sizeBytes: number): Promise<void> {
    await this.putMetric('ResponseSize', sizeBytes, 'Bytes', {
      Endpoint: endpoint,
    });
  }

  async recordPayment(type: 'tip' | 'ppv' | 'subscription', amount: number, success: boolean): Promise<void> {
    await this.putMetric('Payment', 1, 'Count', {
      Type: type,
      Status: success ? 'success' : 'failure',
      AmountRange: this.getAmountRange(amount),
    });
  }

  async recordPayout(amount: number, success: boolean): Promise<void> {
    await this.putMetric('Payout', 1, 'Count', {
      Status: success ? 'success' : 'failure',
      AmountRange: this.getAmountRange(amount),
    });
  }

  private getAmountRange(amount: number): string {
    if (amount < 1000) return '<10';
    if (amount < 5000) return '10-50';
    if (amount < 10000) return '50-100';
    if (amount < 50000) return '100-500';
    return '500+';
  }
}






















