import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { LoggerService } from '../common/logger/logger.service';
import { loadCredentials } from '@bravas/shared';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory } from '@bravas/shared';

@Injectable()
export class AdminReportsService {
  private readonly logger: LoggerService;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly userServiceUrl: string;
  private readonly contentServiceUrl: string;
  private readonly paymentServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.credentials = loadCredentials();
    this.userServiceUrl = process.env.USER_SERVICE_URL || this.credentials.api.baseUrl?.replace('/api/v1', '') + '/api/v1' || 'http://localhost:3001/api/v1';
    this.contentServiceUrl = process.env.CONTENT_SERVICE_URL || this.credentials.api.baseUrl?.replace('/api/v1', '') + '/api/v1' || 'http://localhost:3005/api/v1';
    this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || this.credentials.api.baseUrl?.replace('/api/v1', '') + '/api/v1' || 'http://localhost:3002/api/v1';
    this.logger = LoggerService.create('AdminReportsService', configService);
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  /**
   * Obtener estadísticas generales de la plataforma
   */
  async getPlatformStats(query: { period?: string; fromDate?: string; toDate?: string }, adminToken: string) {
    try {
      const [usersStats, contentStats, paymentsStats] = await Promise.all([
        this.getUsersStats(query, adminToken),
        this.getContentStats(query, adminToken),
        this.getPaymentsStats(query, adminToken),
      ]);

      return {
        success: true,
        data: {
          users: usersStats,
          content: contentStats,
          payments: paymentsStats,
          period: {
            from: query.fromDate,
            to: query.toDate,
            period: query.period,
          },
        },
      };
    } catch (error: any) {
      this.logger.error('Error al obtener estadísticas de plataforma', error?.stack, 'getPlatformStats', {
        error: error.message,
        query,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al obtener estadísticas de plataforma',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getUsersStats(query: { fromDate?: string; toDate?: string }, adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = this.credentials.dynamodb.usersTable || `${projectName}-users-${environment}`;

      // Obtener todos los usuarios (con límite razonable)
      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: tableName,
          Limit: 10000, // Límite razonable para estadísticas
        }),
      );

      const users = response.Items || [];
      const totalUsers = users.length;
      const verifiedUsers = users.filter(u => u.verified === true).length;
      const byRole = users.reduce((acc, u) => {
        const role = u.role || 'unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        byRole,
      };
    } catch (error: any) {
      this.logger.error('Error al obtener estadísticas de usuarios', error?.stack, 'getUsersStats', {
        error: error.message,
      });
      return {
        totalUsers: 0,
        verifiedUsers: 0,
        unverifiedUsers: 0,
        byRole: {},
      };
    }
  }

  /**
   * Obtener estadísticas de contenido
   */
  async getContentStats(query: { fromDate?: string; toDate?: string }, adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const postsTable = this.credentials.dynamodb.postsTable || `${projectName}-posts-${environment}`;
      const packsTable = this.credentials.dynamodb.packsTable || `${projectName}-packs-${environment}`;

      const [postsResponse, packsResponse] = await Promise.all([
        this.dynamoClient.send(
          new ScanCommand({
            TableName: postsTable,
            Limit: 10000,
          }),
        ),
        this.dynamoClient.send(
          new ScanCommand({
            TableName: packsTable,
            Limit: 10000,
          }),
        ),
      ]);

      const posts = postsResponse.Items || [];
      const packs = packsResponse.Items || [];

      const activePosts = posts.filter(p => p.status === 'active').length;
      const activePacks = packs.filter(p => p.status === 'active').length;

      return {
        totalPosts: posts.length,
        activePosts,
        totalPacks: packs.length,
        activePacks,
        moderatedPosts: posts.filter(p => p.moderated === true).length,
        moderatedPacks: packs.filter(p => p.moderated === true).length,
      };
    } catch (error: any) {
      this.logger.error('Error al obtener estadísticas de contenido', error?.stack, 'getContentStats', {
        error: error.message,
      });
      return {
        totalPosts: 0,
        activePosts: 0,
        totalPacks: 0,
        activePacks: 0,
        moderatedPosts: 0,
        moderatedPacks: 0,
      };
    }
  }

  /**
   * Obtener estadísticas de pagos
   */
  async getPaymentsStats(query: { fromDate?: string; toDate?: string }, adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = this.credentials.dynamodb.paymentsTable || `${projectName}-payments-${environment}`;

      const response = await this.dynamoClient.send(
        new ScanCommand({
          TableName: tableName,
          Limit: 10000,
        }),
      );

      const transactions = response.Items || [];
      const succeeded = transactions.filter(t => t.status === 'succeeded');
      const totalRevenue = succeeded.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalTransactions = transactions.length;

      return {
        totalTransactions,
        succeededTransactions: succeeded.length,
        failedTransactions: transactions.filter(t => t.status === 'failed').length,
        totalRevenue,
        averageTransaction: succeeded.length > 0 ? totalRevenue / succeeded.length : 0,
      };
    } catch (error: any) {
      this.logger.error('Error al obtener estadísticas de pagos', error?.stack, 'getPaymentsStats', {
        error: error.message,
      });
      return {
        totalTransactions: 0,
        succeededTransactions: 0,
        failedTransactions: 0,
        totalRevenue: 0,
        averageTransaction: 0,
      };
    }
  }
}

