import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import {
  NotificationRecord,
  NotificationType,
  createNotificationRecord,
} from './database-schema.service';
import { ListNotificationsDto } from '../dto/list-notifications.dto';
import { LoggerService } from '../common/logger/logger.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly logger: LoggerService;
  private readonly notificationsTable: string;

  private gateway?: NotificationsGateway;

  constructor(
    private configService: ConfigService,
    gateway?: NotificationsGateway,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    this.logger = LoggerService.create('NotificationsService', configService);
    this.gateway = gateway;
    
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.notificationsTable = `${projectName}-notifications-${environment}`;
  }

  /**
   * Inyectar gateway después de la inicialización (para evitar dependencia circular)
   */
  setGateway(gateway: NotificationsGateway) {
    this.gateway = gateway;
  }

  /**
   * Crear una nueva notificación
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      link?: string;
      metadata?: Record<string, any>;
      ttl?: number;
    },
  ): Promise<NotificationRecord> {
    try {
      const notification = createNotificationRecord(userId, type, title, message, options);

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.notificationsTable,
          Item: notification,
        }),
      );

      this.logger.log('Notificación creada exitosamente', 'createNotification', {
        notificationId: notification.notificationId,
        userId,
        type,
      });

      // Enviar notificación vía WebSocket si el usuario está conectado
      if (this.gateway) {
        try {
          const notificationDto = this.mapNotificationToDto(notification);
          this.gateway.sendNotificationToUser(userId, notificationDto);
          
          // Actualizar contador de no leídas
          const unreadCount = await this.getUnreadCount(userId);
          this.gateway.sendUnreadCountUpdate(userId, unreadCount);
        } catch (error: any) {
          this.logger.warn('Error al enviar notificación vía WebSocket', 'createNotification', {
            userId,
            error: error.message,
          });
        }
      }

      return notification;
    } catch (error: any) {
      this.logger.error('Error al crear notificación', error?.stack, 'createNotification', {
        userId,
        type,
        error: error.message,
      });
      throw new BadRequestException(`Error al crear notificación: ${error.message}`);
    }
  }

  /**
   * Listar notificaciones del usuario
   */
  async listNotifications(userId: string, query: ListNotificationsDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Query usando GSI userId-createdAt-index
      const queryParams: any = {
        TableName: this.notificationsTable,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Orden descendente (más recientes primero)
        Limit: limit + skip, // Necesitamos más para paginar
      };

      // Filtrar por tipo si se especifica
      if (query.type) {
        queryParams.FilterExpression = '#type = :type';
        queryParams.ExpressionAttributeNames = {
          '#type': 'type',
        };
        queryParams.ExpressionAttributeValues[':type'] = query.type;
      }

      // Filtrar por no leídas si se especifica
      if (query.unreadOnly) {
        if (queryParams.FilterExpression) {
          queryParams.FilterExpression += ' AND #read = :read';
        } else {
          queryParams.FilterExpression = '#read = :read';
        }
        if (!queryParams.ExpressionAttributeNames) {
          queryParams.ExpressionAttributeNames = {};
        }
        queryParams.ExpressionAttributeNames['#read'] = 'read';
        queryParams.ExpressionAttributeValues[':read'] = false;
      }

      const response = await this.dynamoClient.send(new QueryCommand(queryParams));
      let notifications = (response.Items || []) as NotificationRecord[];

      // Aplicar paginación manual (DynamoDB no soporta OFFSET nativo)
      const total = notifications.length;
      notifications = notifications.slice(skip, skip + limit);

      // Contar no leídas
      const unreadCount = notifications.filter(n => !n.read).length;

      // Mapear a DTO
      const data = notifications.map(n => this.mapNotificationToDto(n));

      return {
        success: true,
        data,
        message: 'Notificaciones obtenidas exitosamente',
        pagination: {
          page,
          limit,
          total: response.Count || 0,
          totalPages: Math.ceil((response.Count || 0) / limit),
          hasMore: (response.Count || 0) > skip + limit,
        },
        unreadCount,
      };
    } catch (error: any) {
      this.logger.error('Error al listar notificaciones', error?.stack, 'listNotifications', {
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al listar notificaciones: ${error.message}`);
    }
  }

  /**
   * Obtener una notificación específica
   */
  async getNotification(notificationId: string, userId: string): Promise<NotificationRecord> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.notificationsTable,
          Key: { notificationId },
        }),
      );

      if (!response.Item) {
        throw new NotFoundException(`Notificación con ID ${notificationId} no encontrada`);
      }

      const notification = response.Item as NotificationRecord;

      // Verificar que la notificación pertenece al usuario
      if (notification.userId !== userId) {
        throw new NotFoundException(`Notificación con ID ${notificationId} no encontrada`);
      }

      return notification;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error al obtener notificación', error?.stack, 'getNotification', {
        notificationId,
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al obtener notificación: ${error.message}`);
    }
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationRecord> {
    try {
      // Verificar que la notificación existe y pertenece al usuario
      const notification = await this.getNotification(notificationId, userId);

      if (notification.read) {
        // Ya está leída, retornar sin cambios
        return notification;
      }

      // Actualizar estado
      const now = new Date().toISOString();
      const response = await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.notificationsTable,
          Key: { notificationId },
          UpdateExpression: 'SET #read = :read, readAt = :readAt',
          ExpressionAttributeNames: {
            '#read': 'read',
          },
          ExpressionAttributeValues: {
            ':read': true,
            ':readAt': now,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      const updated = response.Attributes as NotificationRecord;

      this.logger.log('Notificación marcada como leída', 'markAsRead', {
        notificationId,
        userId,
      });

      // Actualizar contador de no leídas vía WebSocket
      if (this.gateway) {
        try {
          const unreadCount = await this.getUnreadCount(userId);
          this.gateway.sendUnreadCountUpdate(userId, unreadCount);
        } catch (error: any) {
          this.logger.warn('Error al actualizar contador vía WebSocket', 'markAsRead', {
            userId,
            error: error.message,
          });
        }
      }

      return updated;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error al marcar notificación como leída', error?.stack, 'markAsRead', {
        notificationId,
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al marcar notificación como leída: ${error.message}`);
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      // Obtener todas las notificaciones no leídas
      const queryParams = {
        TableName: this.notificationsTable,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#read = :read',
        ExpressionAttributeNames: {
          '#read': 'read',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':read': false,
        },
      };

      const response = await this.dynamoClient.send(new QueryCommand(queryParams));
      const notifications = (response.Items || []) as NotificationRecord[];

      if (notifications.length === 0) {
        return { count: 0 };
      }

      // Actualizar todas las notificaciones
      const now = new Date().toISOString();
      let count = 0;

      for (const notification of notifications) {
        try {
          await this.dynamoClient.send(
            new UpdateCommand({
              TableName: this.notificationsTable,
              Key: { notificationId: notification.notificationId },
              UpdateExpression: 'SET #read = :read, readAt = :readAt',
              ExpressionAttributeNames: {
                '#read': 'read',
              },
              ExpressionAttributeValues: {
                ':read': true,
                ':readAt': now,
              },
            }),
          );
          count++;
        } catch (error: any) {
          this.logger.warn('Error al actualizar notificación individual', 'markAllAsRead', {
            notificationId: notification.notificationId,
            error: error.message,
          });
        }
      }

      this.logger.log('Notificaciones marcadas como leídas', 'markAllAsRead', {
        userId,
        count,
      });

      // Actualizar contador de no leídas vía WebSocket
      if (this.gateway) {
        try {
          const unreadCount = await this.getUnreadCount(userId);
          this.gateway.sendUnreadCountUpdate(userId, unreadCount);
        } catch (error: any) {
          this.logger.warn('Error al actualizar contador vía WebSocket', 'markAllAsRead', {
            userId,
            error: error.message,
          });
        }
      }

      return { count };
    } catch (error: any) {
      this.logger.error('Error al marcar todas las notificaciones como leídas', error?.stack, 'markAllAsRead', {
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al marcar todas las notificaciones como leídas: ${error.message}`);
    }
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      // Usar Scan con FilterExpression para contar (más simple que Query con Select)
      const scanParams = {
        TableName: this.notificationsTable,
        IndexName: 'userId-createdAt-index',
        FilterExpression: 'userId = :userId AND #read = :read',
        ExpressionAttributeNames: {
          '#read': 'read',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':read': false,
        },
        Select: 'COUNT' as const,
      };

      // Alternativa: usar Query normal y contar resultados
      const queryParams = {
        TableName: this.notificationsTable,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#read = :read',
        ExpressionAttributeNames: {
          '#read': 'read',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':read': false,
        },
      };

      const response = await this.dynamoClient.send(new QueryCommand(queryParams));
      return response.Count || 0;
    } catch (error: any) {
      this.logger.error('Error al obtener contador de no leídas', error?.stack, 'getUnreadCount', {
        userId,
        error: error.message,
      });
      // No lanzar error, retornar 0 en caso de fallo
      return 0;
    }
  }

  /**
   * Eliminar notificación individual
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      // Verificar que la notificación existe y pertenece al usuario
      const notification = await this.getNotification(notificationId, userId);

      // Eliminar la notificación
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: this.notificationsTable,
          Key: { notificationId },
        }),
      );

      this.logger.log('Notificación eliminada exitosamente', 'deleteNotification', {
        notificationId,
        userId,
        type: notification.type,
      });

      // Actualizar contador de no leídas vía WebSocket si está disponible
      if (this.gateway) {
        try {
          const unreadCount = await this.getUnreadCount(userId);
          this.gateway.sendUnreadCountUpdate(userId, unreadCount);
        } catch (error: any) {
          this.logger.warn('Error al actualizar contador vía WebSocket', 'deleteNotification', {
            userId,
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error al eliminar notificación', error?.stack, 'deleteNotification', {
        notificationId,
        userId,
        error: error.message,
      });
      throw new BadRequestException(`Error al eliminar notificación: ${error.message}`);
    }
  }

  /**
   * Mapear NotificationRecord a DTO
   */
  mapNotificationToDto(record: NotificationRecord): any {
    return {
      id: record.notificationId, // Alias para frontend
      notificationId: record.notificationId,
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      read: record.read,
      readAt: record.readAt,
      link: record.link,
      metadata: record.metadata,
      timestamp: record.createdAt, // Frontend parseará a Date
      createdAt: record.createdAt,
    };
  }
}

