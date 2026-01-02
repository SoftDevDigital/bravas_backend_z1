import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../common/logger/logger.service';
import { loadCredentials } from '@bravas/shared';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory } from '@bravas/shared';

@Injectable()
export class AdminContentService {
  private readonly contentServiceUrl: string;
  private readonly logger: LoggerService;
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.credentials = loadCredentials();
    this.contentServiceUrl = process.env.CONTENT_SERVICE_URL || this.credentials.api.baseUrl?.replace('/api/v1', '') + '/api/v1' || 'http://localhost:3005/api/v1';
    this.logger = LoggerService.create('AdminContentService', configService);
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  /**
   * Listar contenido pendiente de moderación
   */
  async listPendingContent(query: { page?: number; limit?: number; type?: 'post' | 'pack' }, adminToken: string) {
    try {
      // Consultar directamente DynamoDB para contenido pendiente
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = query.type === 'pack' 
        ? this.credentials.dynamodb.packsTable || `${projectName}-packs-${environment}`
        : this.credentials.dynamodb.postsTable || `${projectName}-posts-${environment}`;

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Buscar contenido con moderationStatus = 'pending' o moderated = false
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'userId-createdAt-index', // Asumiendo que existe este GSI
          FilterExpression: '#moderationStatus = :pending OR moderated = :false',
          ExpressionAttributeNames: {
            '#moderationStatus': 'moderationStatus',
          },
          ExpressionAttributeValues: {
            ':pending': 'pending',
            ':false': false,
          },
          Limit: limit,
        }),
      );

      // Si no hay GSI, usar Scan (menos eficiente pero funciona)
      if (!response.Items || response.Items.length === 0) {
        const scanResponse = await this.dynamoClient.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: '#moderationStatus = :pending OR attribute_not_exists(moderated)',
            ExpressionAttributeNames: {
              '#moderationStatus': 'moderationStatus',
            },
            ExpressionAttributeValues: {
              ':pending': 'pending',
            },
            Limit: limit,
          }),
        );

        return {
          success: true,
          data: scanResponse.Items || [],
          pagination: {
            page,
            limit,
            total: scanResponse.Count || 0,
            totalPages: Math.ceil((scanResponse.Count || 0) / limit),
          },
        };
      }

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
      this.logger.error('Error al listar contenido pendiente', error?.stack, 'listPendingContent', {
        error: error.message,
        query,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al listar contenido pendiente',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Moderar contenido (aprobar, rechazar, ocultar, eliminar)
   */
  async moderateContent(
    contentId: string,
    type: 'post' | 'pack',
    action: 'approve' | 'reject' | 'hide' | 'delete',
    reason: string | undefined,
    adminToken: string,
  ) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = type === 'pack'
        ? this.credentials.dynamodb.packsTable || `${projectName}-packs-${environment}`
        : this.credentials.dynamodb.postsTable || `${projectName}-posts-${environment}`;

      const idField = type === 'pack' ? 'packId' : 'postId';

      if (action === 'delete') {
        // Eliminar contenido (soft delete)
        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { [idField]: contentId },
            UpdateExpression: 'SET #status = :deleted, moderated = :true, moderationStatus = :deleted, updatedAtTimestamp = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':deleted': 'deleted',
              ':true': true,
              ':updatedAt': Date.now(),
            },
          }),
        );
      } else if (action === 'hide') {
        // Ocultar contenido
        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { [idField]: contentId },
            UpdateExpression: 'SET #status = :hidden, moderated = :true, moderationStatus = :approved, updatedAtTimestamp = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':hidden': 'hidden',
              ':true': true,
              ':approved': 'approved',
              ':updatedAt': Date.now(),
            },
          }),
        );
      } else if (action === 'approve') {
        // Aprobar contenido
        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { [idField]: contentId },
            UpdateExpression: 'SET moderated = :true, moderationStatus = :approved, #status = :active, updatedAtTimestamp = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':true': true,
              ':approved': 'approved',
              ':active': 'active',
              ':updatedAt': Date.now(),
            },
          }),
        );
      } else if (action === 'reject') {
        // Rechazar contenido
        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { [idField]: contentId },
            UpdateExpression: 'SET moderated = :true, moderationStatus = :rejected, #status = :hidden, updatedAtTimestamp = :updatedAt',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':true': true,
              ':rejected': 'rejected',
              ':hidden': 'hidden',
              ':updatedAt': Date.now(),
            },
          }),
        );
      }

      this.logger.log(`Contenido ${action} exitosamente`, 'moderateContent', {
        contentId,
        type,
        action,
        reason,
      });

      return {
        success: true,
        message: `Contenido ${action === 'approve' ? 'aprobado' : action === 'reject' ? 'rechazado' : action === 'hide' ? 'oculto' : 'eliminado'} exitosamente`,
        data: {
          contentId,
          type,
          action,
          reason,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al moderar contenido', error?.stack, 'moderateContent', {
        contentId,
        type,
        action,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al moderar contenido',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener contenido por ID
   */
  async getContentById(contentId: string, type: 'post' | 'pack', adminToken: string) {
    try {
      const projectName = process.env.PROJECT_NAME || 'bravas';
      const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
      const tableName = type === 'pack'
        ? this.credentials.dynamodb.packsTable || `${projectName}-packs-${environment}`
        : this.credentials.dynamodb.postsTable || `${projectName}-posts-${environment}`;

      const idField = type === 'pack' ? 'packId' : 'postId';

      // Intentar obtener desde Content Service primero
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.contentServiceUrl}/content/${type}s/${contentId}`, {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          }),
        );
        return response.data;
      } catch (httpError: any) {
        // Si falla, obtener directamente de DynamoDB
        const response = await this.dynamoClient.send(
          new GetCommand({
            TableName: tableName,
            Key: { [idField]: contentId },
          }),
        );

        if (!response.Item) {
          throw new HttpException('Contenido no encontrado', HttpStatus.NOT_FOUND);
        }

        return {
          success: true,
          data: response.Item,
        };
      }
    } catch (error: any) {
      this.logger.error('Error al obtener contenido', error?.stack, 'getContentById', {
        contentId,
        type,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al obtener contenido',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

