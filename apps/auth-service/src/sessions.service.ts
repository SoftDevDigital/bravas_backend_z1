import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { randomUUID } from 'crypto';

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | 'web';
  refreshToken: string;
  lastActivity: string;
  createdAt: string;
  expiresAt: number; // Unix timestamp para TTL de DynamoDB
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionsService {
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;
  private readonly SESSION_EXPIRY_DAYS = 30; // Sesiones expiran en 30 días

  constructor() {
    this.credentials = loadCredentials();
    // TypeScript puede tener problemas resolviendo tipos desde librería compartida
    // El type assertion asegura que TypeScript reconozca los métodos correctamente
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  /**
   * Crea una nueva sesión para un usuario
   */
  async createSession(
    userId: string,
    email: string,
    refreshToken: string,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: 'mobile' | 'desktop' | 'tablet' | 'web';
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<SessionData> {
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_EXPIRY_DAYS);

    const session: SessionData = {
      sessionId,
      userId,
      email,
      deviceId: deviceInfo?.deviceId || randomUUID(),
      deviceName: deviceInfo?.deviceName || 'Unknown Device',
      deviceType: deviceInfo?.deviceType || 'web',
      refreshToken,
      lastActivity: now.toISOString(),
      createdAt: now.toISOString(),
      expiresAt: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp para TTL
      isActive: true,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
    };

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.credentials.dynamodb.userSessionsTable,
        Item: session,
      }),
    );

    return session;
  }

  /**
   * Actualiza la última actividad de una sesión
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.userSessionsTable,
          Key: { sessionId },
          UpdateExpression: 'SET lastActivity = :lastActivity',
          ExpressionAttributeValues: {
            ':lastActivity': new Date().toISOString(),
          },
        }),
      );
    } catch (error: any) {
      // Si la sesión no existe, no es crítico
      console.warn(`No se pudo actualizar actividad de sesión ${sessionId}:`, error.message);
    }
  }

  /**
   * Obtiene todas las sesiones activas de un usuario
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.userSessionsTable,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          FilterExpression: 'isActive = :isActive',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':isActive': true,
          },
        }),
      );

      return (response.Items || []) as SessionData[];
    } catch (error: any) {
      throw new NotFoundException(`Error al obtener sesiones del usuario: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las sesiones activas de un usuario por email
   */
  async getUserSessionsByEmail(email: string): Promise<SessionData[]> {
    try {
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.userSessionsTable,
          IndexName: 'email-index',
          KeyConditionExpression: 'email = :email',
          FilterExpression: 'isActive = :isActive',
          ExpressionAttributeValues: {
            ':email': email,
            ':isActive': true,
          },
        }),
      );

      return (response.Items || []) as SessionData[];
    } catch (error: any) {
      throw new NotFoundException(`Error al obtener sesiones del usuario: ${error.message}`);
    }
  }

  /**
   * Cierra una sesión específica
   */
  async closeSession(sessionId: string, userId: string): Promise<void> {
    try {
      // Verificar que la sesión pertenece al usuario
      const session = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userSessionsTable,
          Key: { sessionId },
        }),
      );

      if (!session.Item) {
        throw new NotFoundException('Sesión no encontrada');
      }

      const sessionData = session.Item as SessionData;
      if (sessionData.userId !== userId) {
        throw new BadRequestException('No tienes permiso para cerrar esta sesión');
      }

      // Marcar sesión como inactiva
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.userSessionsTable,
          Key: { sessionId },
          UpdateExpression: 'SET isActive = :isActive',
          ExpressionAttributeValues: {
            ':isActive': false,
          },
        }),
      );
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new NotFoundException(`Error al cerrar sesión: ${error.message}`);
    }
  }

  /**
   * Cierra todas las sesiones de un usuario
   */
  async closeAllUserSessions(userId: string): Promise<number> {
    try {
      const sessions = await this.getUserSessions(userId);
      
      // Cerrar todas las sesiones
      const promises = sessions.map((session) =>
        this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.credentials.dynamodb.userSessionsTable,
            Key: { sessionId: session.sessionId },
            UpdateExpression: 'SET isActive = :isActive',
            ExpressionAttributeValues: {
              ':isActive': false,
            },
          }),
        ),
      );

      await Promise.all(promises);
      return sessions.length;
    } catch (error: any) {
      throw new NotFoundException(`Error al cerrar todas las sesiones: ${error.message}`);
    }
  }

  /**
   * Obtiene información de una sesión específica
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userSessionsTable,
          Key: { sessionId },
        }),
      );

      if (!response.Item) {
        return null;
      }

      return response.Item as SessionData;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Actualiza el refreshToken en todas las sesiones activas de un usuario
   * Esto permite sincronización automática de tokens en multi-sesión
   */
  async updateRefreshTokenForAllSessions(
    email: string,
    newRefreshToken: string,
  ): Promise<number> {
    try {
      // Obtener todas las sesiones activas del usuario
      const sessions = await this.getUserSessionsByEmail(email);
      
      if (sessions.length === 0) {
        return 0;
      }

      // Actualizar refreshToken en todas las sesiones activas
      const updatePromises = sessions.map((session) =>
        this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.credentials.dynamodb.userSessionsTable,
            Key: { sessionId: session.sessionId },
            UpdateExpression: 'SET refreshToken = :refreshToken, lastActivity = :lastActivity',
            ExpressionAttributeValues: {
              ':refreshToken': newRefreshToken,
              ':lastActivity': new Date().toISOString(),
            },
          }),
        ),
      );

      await Promise.all(updatePromises);
      return sessions.length;
    } catch (error: any) {
      console.warn(`Error al actualizar refreshToken en sesiones: ${error.message}`);
      return 0;
    }
  }

  /**
   * Busca una sesión existente por deviceId o userAgent
   * Útil para reutilizar sesiones en el mismo dispositivo
   */
  async findSessionByDevice(
    email: string,
    deviceId?: string,
    userAgent?: string,
  ): Promise<SessionData | null> {
    try {
      const sessions = await this.getUserSessionsByEmail(email);
      
      // Buscar por deviceId primero
      if (deviceId) {
        const sessionByDevice = sessions.find((s) => s.deviceId === deviceId && s.isActive);
        if (sessionByDevice) {
          return sessionByDevice;
        }
      }

      // Si no hay deviceId, buscar por userAgent (menos preciso)
      if (userAgent && sessions.length > 0) {
        // Buscar sesión con mismo userAgent y creada recientemente (últimas 24 horas)
        const recentSessions = sessions.filter((s) => {
          if (!s.isActive || s.userAgent !== userAgent) {
            return false;
          }
          const createdAt = new Date(s.createdAt);
          const now = new Date();
          const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24; // Últimas 24 horas
        });

        if (recentSessions.length > 0) {
          // Retornar la más reciente
          return recentSessions.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )[0];
        }
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }
}

