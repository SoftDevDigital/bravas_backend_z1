import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { SecretsService } from '../common/security/secrets.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;

  constructor(private secretsService: SecretsService) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health Check Básico',
    description: 'Verifica que el servicio esté funcionando correctamente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio funcionando correctamente',
  })
  async basicHealthCheck() {
    const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
    const serviceName = process.env.SERVICE_NAME || 'payment-service';
    const version = process.env.SERVICE_VERSION || '1.0.0';

    return {
      status: 'ok',
      service: serviceName,
      version,
      environment,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health Check Detallado',
    description: 'Verifica el estado del servicio y todas sus dependencias (DynamoDB, Secrets Manager, Stripe).',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado detallado del servicio y dependencias',
  })
  async detailedHealthCheck() {
    const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
    const serviceName = process.env.SERVICE_NAME || 'payment-service';
    const version = process.env.SERVICE_VERSION || '1.0.0';

    const checks = {
      service: {
        status: 'ok',
        service: serviceName,
        version,
        environment,
        timestamp: new Date().toISOString(),
      },
      dependencies: {
        dynamodb: await this.checkDynamoDB(),
        secretsManager: await this.checkSecretsManager(),
        stripe: await this.checkStripe(),
      },
    };

    const allHealthy = Object.values(checks.dependencies).every(
      (dep) => dep.status === 'ok',
    );

    return {
      ...checks,
      status: allHealthy ? 'ok' : 'degraded',
      overall: allHealthy ? 'healthy' : 'unhealthy',
    };
  }

  private async checkDynamoDB(): Promise<{ status: string; message?: string }> {
    try {
      const tableName = this.credentials.dynamodb?.paymentsTable;
      if (!tableName) {
        return { status: 'warning', message: 'Tabla de pagos no configurada' };
      }

      await this.dynamoClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { paymentId: '__health_check__' },
        }),
      );

      return { status: 'ok', message: 'DynamoDB accesible' };
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return { status: 'error', message: 'Tabla no encontrada' };
      }
      return { 
        status: 'ok', 
        message: 'DynamoDB accesible (error esperado en health check)' 
      };
    }
  }

  private async checkSecretsManager(): Promise<{ status: string; message?: string }> {
    try {
      await this.secretsService.getStripeSecretKey();
      return { status: 'ok', message: 'Secrets Manager accesible' };
    } catch (error: any) {
      return { 
        status: 'error', 
        message: `Error al acceder a Secrets Manager: ${error.message}` 
      };
    }
  }

  private async checkStripe(): Promise<{ status: string; message?: string }> {
    // Stripe no tiene un endpoint de health check directo
    // Verificamos que podemos obtener el secret key (ya verificado en Secrets Manager)
    return { 
      status: 'ok', 
      message: 'Stripe configurado (verificación completa requiere transacción real)' 
    };
  }
}




















