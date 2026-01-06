import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { getUserFromToken } from '../helpers/auth.helper';

/**
 * WebSocket Gateway para notificaciones en tiempo real
 * 
 * Permite a los clientes conectarse y recibir notificaciones instantáneas
 * cuando se crean nuevas notificaciones para el usuario.
 */
@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especificar dominios permitidos
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger: LoggerService;
  private readonly connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(private configService: ConfigService) {
    this.logger = LoggerService.create('NotificationsGateway', configService);
  }

  /**
   * Maneja nuevas conexiones WebSocket
   */
  async handleConnection(client: Socket) {
    try {
      // Obtener token de autenticación desde query params o headers
      const token = client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        this.logger.warn('Conexión WebSocket rechazada: sin token', 'handleConnection', {
          socketId: client.id,
        });
        client.disconnect();
        return;
      }

      // Validar token y obtener usuario
      const userInfo = await getUserFromToken(token as string);
      
      // Asociar socket con userId
      this.connectedUsers.set(userInfo.userId, client.id);
      client.data.userId = userInfo.userId;

      // Unir al usuario a su room personal
      client.join(`user:${userInfo.userId}`);

      this.logger.log('Cliente WebSocket conectado', 'handleConnection', {
        socketId: client.id,
        userId: userInfo.userId,
        totalConnected: this.connectedUsers.size,
      });

      // Enviar confirmación de conexión
      client.emit('connected', {
        success: true,
        message: 'Conectado al servicio de notificaciones',
        userId: userInfo.userId,
      });
    } catch (error: any) {
      this.logger.error('Error al conectar cliente WebSocket', error?.stack, 'handleConnection', {
        socketId: client.id,
        error: error.message,
      });
      client.disconnect();
    }
  }

  /**
   * Maneja desconexiones WebSocket
   */
  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    
    if (userId) {
      this.connectedUsers.delete(userId);
      
      this.logger.log('Cliente WebSocket desconectado', 'handleDisconnect', {
        socketId: client.id,
        userId,
        totalConnected: this.connectedUsers.size,
      });
    }
  }

  /**
   * Suscripción a notificaciones (opcional, ya se unen automáticamente)
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    
    if (!userId) {
      return { success: false, message: 'No autenticado' };
    }

    client.join(`user:${userId}`);
    
    return {
      success: true,
      message: 'Suscrito a notificaciones',
      userId,
    };
  }

  /**
   * Enviar notificación a un usuario específico
   * Llamado desde el servicio cuando se crea una nueva notificación
   */
  sendNotificationToUser(userId: string, notification: any) {
    try {
      this.server.to(`user:${userId}`).emit('notification', {
        type: 'new_notification',
        data: notification,
        timestamp: new Date().toISOString(),
      });

      this.logger.log('Notificación enviada vía WebSocket', 'sendNotificationToUser', {
        userId,
        notificationId: notification.id || notification.notificationId,
      });
    } catch (error: any) {
      this.logger.error('Error al enviar notificación vía WebSocket', error?.stack, 'sendNotificationToUser', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Enviar actualización de contador de no leídas
   */
  sendUnreadCountUpdate(userId: string, unreadCount: number) {
    try {
      this.server.to(`user:${userId}`).emit('unread_count', {
        type: 'unread_count_update',
        unreadCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error('Error al enviar actualización de contador', error?.stack, 'sendUnreadCountUpdate', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Obtener número de usuarios conectados
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Verificar si un usuario está conectado
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}









