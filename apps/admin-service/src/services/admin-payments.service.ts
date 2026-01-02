import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../common/logger/logger.service';
import { loadCredentials } from '@bravas/shared';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory } from '@bravas/shared';

@Injectable()
export class AdminPaymentsService {
  private readonly paymentServiceUrl: string;
  private readonly logger: LoggerService;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.credentials = loadCredentials();
    this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || this.credentials.api.baseUrl?.replace('/api/v1', '') + '/api/v1' || 'http://localhost:3002/api/v1';
    this.logger = LoggerService.create('AdminPaymentsService', configService);
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  /**
   * Listar transacciones
   */
  async listTransactions(query: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
  }, adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = this.credentials.dynamodb.paymentsTable || `${projectName}-payments-${environment}`;
      const page = query.page || 1;
      const limit = query.limit || 20;

      // Construir filtros
      const filterExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};

      if (query.status) {
        filterExpressions.push('#status = :status');
        expressionAttributeValues[':status'] = query.status;
      }

      if (query.type) {
        filterExpressions.push('#type = :type');
        expressionAttributeValues[':type'] = query.type;
      }

      if (query.fromDate) {
        filterExpressions.push('createdAtTimestamp >= :fromDate');
        expressionAttributeValues[':fromDate'] = new Date(query.fromDate).getTime();
      }

      if (query.toDate) {
        filterExpressions.push('createdAtTimestamp <= :toDate');
        expressionAttributeValues[':toDate'] = new Date(query.toDate).getTime();
      }

      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: tableName,
          FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
          ExpressionAttributeNames: query.status || query.type ? {
            ...(query.status ? { '#status': 'status' } : {}),
            ...(query.type ? { '#type': 'type' } : {}),
          } : undefined,
          ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
          Limit: limit,
          ScanIndexForward: false, // Ordenar por fecha descendente
        }),
      );

      return {
        success: true,
        data: response.Items || [],
        pagination: {
          page,
          limit,
          total: response.Count || 0,
          totalPages: Math.ceil((response.Count || 0) / limit),
        },
      };
    } catch (error: any) {
      this.logger.error('Error al listar transacciones', error?.stack, 'listTransactions', {
        error: error.message,
        query,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al listar transacciones',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener transacción por ID
   */
  async getTransactionById(transactionId: string, adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = this.credentials.dynamodb.paymentsTable || `${projectName}-payments-${environment}`;

      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { paymentId: transactionId },
        }),
      );

      if (!response.Item) {
        throw new HttpException('Transacción no encontrada', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: response.Item,
      };
    } catch (error: any) {
      this.logger.error('Error al obtener transacción', error?.stack, 'getTransactionById', {
        transactionId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al obtener transacción',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Procesar reembolso
   */
  async processRefund(transactionId: string, reason: string, amount: number | undefined, adminToken: string) {
    try {
      // Obtener la transacción primero
      const transaction = await this.getTransactionById(transactionId, adminToken);

      if (transaction.data.status !== 'succeeded') {
        throw new HttpException('Solo se pueden reembolsar transacciones exitosas', HttpStatus.BAD_REQUEST);
      }

      // Aquí deberías integrar con Stripe para procesar el reembolso
      // Por ahora, solo actualizamos el estado en DynamoDB
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = this.credentials.dynamodb.paymentsTable || `${projectName}-payments-${environment}`;

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { paymentId: transactionId },
          UpdateExpression: 'SET #status = :refunded, refundReason = :reason, refundedAt = :refundedAt, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':refunded': 'refunded',
            ':reason': reason,
            ':refundedAt': new Date().toISOString(),
            ':updatedAt': Date.now(),
          },
        }),
      );

      this.logger.log('Reembolso procesado exitosamente', 'processRefund', {
        transactionId,
        reason,
        amount,
      });

      return {
        success: true,
        message: 'Reembolso procesado exitosamente',
        data: {
          transactionId,
          reason,
          amount: amount || transaction.data.amount,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al procesar reembolso', error?.stack, 'processRefund', {
        transactionId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al procesar reembolso',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener estadísticas de pagos
   */
  async getPaymentStats(query: { fromDate?: string; toDate?: string }, adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = this.credentials.dynamodb.paymentsTable || `${projectName}-payments-${environment}`;

      // Construir filtros de fecha
      const filterExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {
        ':succeeded': 'succeeded',
      };

      if (query.fromDate) {
        filterExpressions.push('createdAtTimestamp >= :fromDate');
        expressionAttributeValues[':fromDate'] = new Date(query.fromDate).getTime();
      }

      if (query.toDate) {
        filterExpressions.push('createdAtTimestamp <= :toDate');
        expressionAttributeValues[':toDate'] = new Date(query.toDate).getTime();
      }

      // Obtener todas las transacciones exitosas
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: tableName,
          FilterExpression: `#status = :succeeded${filterExpressions.length > 0 ? ' AND ' + filterExpressions.join(' AND ') : ''}`,
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      const transactions = response.Items || [];
      const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalTransactions = transactions.length;
      const byType = transactions.reduce((acc, t) => {
        const type = t.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        success: true,
        data: {
          totalRevenue,
          totalTransactions,
          averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          byType,
          period: {
            from: query.fromDate,
            to: query.toDate,
          },
        },
      };
    } catch (error: any) {
      this.logger.error('Error al obtener estadísticas de pagos', error?.stack, 'getPaymentStats', {
        error: error.message,
        query,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al obtener estadísticas de pagos',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

