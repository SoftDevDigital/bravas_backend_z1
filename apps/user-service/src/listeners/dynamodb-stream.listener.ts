import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// Tipos de AWS Lambda
interface DynamoDBStreamRecord {
  eventName: string;
  eventSourceARN?: string;
  dynamodb?: {
    NewImage?: any;
    OldImage?: any;
  };
}

interface DynamoDBStreamEvent {
  Records: DynamoDBStreamRecord[];
}

import { AutomationService } from '../services/automation.service';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials, NotificationClient } from '@bravas/shared';

/**
 * Listener para DynamoDB Streams
 * 
 * Automatiza actualizaciones basadas en cambios en DynamoDB:
 * - Actualización automática de estadísticas
 * - Invalidación automática de caché
 * - Sincronización automática de datos
 * - Notificaciones automáticas de cambios
 */
@Injectable()
export class DynamoDBStreamListener implements OnModuleInit {
  private readonly logger = new Logger(DynamoDBStreamListener.name);
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;

  constructor(private automationService: AutomationService) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient();
  }

  async onModuleInit() {
    this.logger.log('DynamoDB Stream Listener inicializado');
  }

  /**
   * Procesar eventos de DynamoDB Stream
   * Se llama automáticamente desde Lambda cuando hay cambios en DynamoDB
   */
  async handleStreamEvent(event: DynamoDBStreamEvent): Promise<void> {
    try {
      for (const record of event.Records) {
        const eventName = record.eventName;
        const tableName = record.eventSourceARN?.split('/')[1] || 'unknown';

        this.logger.log(`Procesando evento DynamoDB: ${eventName} en tabla ${tableName}`);

        // Procesar según el tipo de evento
        if (eventName === 'INSERT' || eventName === 'MODIFY') {
          await this.processRecord(record, tableName);
        } else if (eventName === 'REMOVE') {
          await this.processRemoval(record, tableName);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error procesando stream: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Procesar registro insertado o modificado
   */
  private async processRecord(record: any, tableName: string): Promise<void> {
    try {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) return;

      // Convertir DynamoDB format a objeto normal
      const item = this.unmarshallDynamoDBItem(newImage);

      // Procesar según la tabla
      if (tableName.includes('users') || tableName.includes('user-profiles')) {
        await this.processUserChange(item, record.eventName);
      } else if (tableName.includes('user-model-relations')) {
        await this.processRelationChange(item, record.eventName);
      } else if (tableName.includes('verifications')) {
        await this.processVerificationChange(item, record.eventName);
      }
    } catch (error: any) {
      this.logger.error(`Error procesando registro: ${error.message}`, error.stack);
    }
  }

  /**
   * Procesar cambio en usuario
   */
  private async processUserChange(item: any, eventName: string): Promise<void> {
    try {
      const userId = item.id || item.userId;

      // Invalidar caché del usuario
      await this.automationService.publishEvent('cache.invalidate', {
        pattern: `user:profile:${userId}`,
      });

      // Si es un nuevo usuario, enviar notificación de bienvenida
      if (eventName === 'INSERT') {
        await this.automationService.automateNotification(
          userId,
          'user_registered',
          { userId, email: item.email }
        );
      }

      // Si se actualizó verificación, notificar
      if (eventName === 'MODIFY' && item.verified) {
        await this.automationService.automateNotification(
          userId,
          'verification_approved',
          { userId }
        );
      }
    } catch (error: any) {
      this.logger.error(`Error procesando cambio de usuario: ${error.message}`, error.stack);
    }
  }

  /**
   * Procesar cambio en relación usuario-modelo
   */
  private async processRelationChange(item: any, eventName: string): Promise<void> {
    try {
      const { userId, modelId } = item;

      // Actualizar estadísticas del modelo automáticamente
      if (eventName === 'INSERT' && item.relationType === 'purchase') {
        // Incrementar totalSales del modelo
        await this.updateModelStats(modelId, 'increment_sales');

        // Notificar al modelo
        await this.automationService.automateNotification(
          modelId,
          'new_purchase',
          { buyerId: userId, modelId }
        );
      }
    } catch (error: any) {
      this.logger.error(`Error procesando cambio de relación: ${error.message}`, error.stack);
    }
  }

  /**
   * Procesar cambio en verificación
   */
  private async processVerificationChange(item: any, eventName: string): Promise<void> {
    try {
      const { verificationId, userId, status } = item;

      // Si la verificación cambió a pending_review, notificar a admins
      if (status === 'pending_review') {
        await this.automationService.publishEvent('verification.pending_review', {
          verificationId,
          userId,
        });
      }

      // Si fue aprobada, actualizar usuario
      if (status === 'approved') {
        await this.updateUserVerification(userId, true);
        
        // Crear notificación de verificación aprobada
        try {
          const notificationClient = new NotificationClient(
            process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1'
          );
          await notificationClient.createNotification({
            userId,
            type: 'verification',
            title: 'Verificación aprobada',
            message: '¡Felicidades! Tu verificación de identidad ha sido aprobada. Ya puedes disfrutar de todas las funcionalidades de la plataforma.',
            link: '/profile',
            metadata: {
              verificationId,
              status: 'approved',
            },
          });
        } catch (error: any) {
          this.logger.warn('Error al crear notificación de verificación aprobada', 'processVerificationChange', {
            userId,
            verificationId,
            error: error.message,
          });
        }
      }

      // Si fue rechazada, notificar al usuario
      if (status === 'rejected') {
        await this.automationService.automateNotification(
          userId,
          'verification_rejected',
          { verificationId, reason: item.rejectionReason }
        );
      }
    } catch (error: any) {
      this.logger.error(`Error procesando cambio de verificación: ${error.message}`, error.stack);
    }
  }

  /**
   * Procesar eliminación
   */
  private async processRemoval(record: any, tableName: string): Promise<void> {
    try {
      const oldImage = record.dynamodb?.OldImage;
      if (!oldImage) return;

      const item = this.unmarshallDynamoDBItem(oldImage);

      // Invalidar caché relacionado
      if (tableName.includes('users')) {
        const userId = item.id || item.userId;
        await this.automationService.publishEvent('cache.invalidate', {
          pattern: `user:profile:${userId}`,
        });
      }
    } catch (error: any) {
      this.logger.error(`Error procesando eliminación: ${error.message}`, error.stack);
    }
  }

  /**
   * Actualizar estadísticas del modelo
   */
  private async updateModelStats(modelId: string, operation: 'increment_sales'): Promise<void> {
    try {
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId: modelId },
        })
      );

      if (profileResponse.Item) {
        const currentSales = profileResponse.Item.totalSales || 0;
        
        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.credentials.dynamodb.userProfilesTable,
            Key: { userId: modelId },
            UpdateExpression: 'SET totalSales = :sales, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#updatedAt': 'updatedAt',
            },
            ExpressionAttributeValues: {
              ':sales': currentSales + 1,
              ':updatedAt': new Date().toISOString(),
            },
          })
        );
      }
    } catch (error: any) {
      this.logger.error(`Error actualizando estadísticas: ${error.message}`, error.stack);
    }
  }

  /**
   * Actualizar verificación del usuario
   */
  private async updateUserVerification(userId: string, verified: boolean): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression: 'SET #verified = :verified, #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#verified': 'verified',
            '#status': 'status',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':verified': verified,
            ':status': verified ? 'active' : 'pending_verification',
            ':updatedAt': new Date().toISOString(),
          },
        })
      );
    } catch (error: any) {
      this.logger.error(`Error actualizando verificación: ${error.message}`, error.stack);
    }
  }

  /**
   * Convertir item de DynamoDB Stream a objeto normal
   */
  private unmarshallDynamoDBItem(item: any): any {
    const result: any = {};
    
    for (const [key, value] of Object.entries(item)) {
      if (value && typeof value === 'object') {
        const type = Object.keys(value)[0];
        const val = (value as any)[type];
        
        switch (type) {
          case 'S':
            result[key] = val;
            break;
          case 'N':
            result[key] = Number(val);
            break;
          case 'BOOL':
            result[key] = val;
            break;
          case 'M':
            result[key] = this.unmarshallDynamoDBItem(val);
            break;
          case 'L':
            result[key] = val.map((v: any) => {
              const vType = Object.keys(v)[0];
              return v[vType];
            });
            break;
          default:
            result[key] = val;
        }
      }
    }
    
    return result;
  }
}

