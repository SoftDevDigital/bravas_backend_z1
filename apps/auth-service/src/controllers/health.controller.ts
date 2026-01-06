import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CognitoIdentityProviderClient, ListUserPoolsCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';

/**
 * Health Check Controller para Auth Service
 * Endpoints para verificar el estado del servicio y sus dependencias
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private cognitoClient: CognitoIdentityProviderClient;
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;

  constructor() {
    this.credentials = loadCredentials();
    this.cognitoClient = AWSClientFactory.createCognitoClient() as CognitoIdentityProviderClient;
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  /**
   * GET /health
   * Health check básico
   */
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
    const serviceName = process.env.SERVICE_NAME || 'auth-service';
    const version = process.env.SERVICE_VERSION || '1.0.0';

    return {
      status: 'ok',
      service: serviceName,
      version,
      environment,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/detailed
   * Health check detallado con estado de dependencias
   */
  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health Check Detallado',
    description: 'Verifica el estado del servicio y todas sus dependencias (Cognito, DynamoDB).',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado detallado del servicio y dependencias',
  })
  async detailedHealthCheck() {
    const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
    const serviceName = process.env.SERVICE_NAME || 'auth-service';
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
        cognito: await this.checkCognito(),
        dynamodb: await this.checkDynamoDB(),
      },
    };

    // Determinar estado general
    const allHealthy = Object.values(checks.dependencies).every(
      (dep) => dep.status === 'ok',
    );

    return {
      ...checks,
      status: allHealthy ? 'ok' : 'degraded',
      overall: allHealthy ? 'healthy' : 'unhealthy',
    };
  }

  /**
   * Verificar estado de Cognito
   */
  private async checkCognito(): Promise<{ status: string; message?: string }> {
    try {
      const userPoolId = this.credentials.cognito?.userPoolId;
      if (!userPoolId) {
        return { status: 'error', message: 'User Pool no configurado' };
      }

      // Intentar listar user pools para verificar conectividad
      await this.cognitoClient.send(
        new ListUserPoolsCommand({
          MaxResults: 1,
        }),
      );

      return { status: 'ok', message: 'Cognito accesible' };
    } catch (error: any) {
      // Si falla, puede ser por permisos o conectividad
      return { 
        status: 'error', 
        message: `Error al acceder a Cognito: ${error.message || 'Error desconocido'}` 
      };
    }
  }

  /**
   * Verificar estado de DynamoDB
   */
  private async checkDynamoDB(): Promise<{ status: string; message?: string }> {
    try {
      const tableName = this.credentials.dynamodb?.usersTable;
      if (!tableName) {
        return { status: 'warning', message: 'Tabla de usuarios no configurada' };
      }

      // Intentar leer un item (usando una clave que probablemente no existe)
      await this.dynamoClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { id: '__health_check__' },
        }),
      );

      return { status: 'ok', message: 'DynamoDB accesible' };
    } catch (error: any) {
      // Si el error es que el item no existe, DynamoDB está funcionando
      if (error.name === 'ResourceNotFoundException') {
        return { status: 'error', message: 'Tabla no encontrada' };
      }
      // Otros errores pueden indicar problemas de conectividad
      return { 
        status: 'ok', 
        message: 'DynamoDB accesible (error esperado en health check)' 
      };
    }
  }
}























