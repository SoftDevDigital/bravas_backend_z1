/**
 * Cliente HTTP para crear notificaciones desde otros servicios
 * 
 * Uso:
 * ```typescript
 * const notificationClient = new NotificationClient('http://localhost:3006/api/v1');
 * await notificationClient.createNotification({
 *   userId: 'user_123',
 *   type: 'message',
 *   title: 'Nuevo mensaje',
 *   message: 'Has recibido un nuevo mensaje',
 *   link: '/messages/chat_123',
 *   metadata: { chatId: 'chat_123' }
 * });
 * ```
 */

import axios, { AxiosInstance } from 'axios';

export type NotificationType =
  | 'message'
  | 'contract'
  | 'transfer'
  | 'payment'
  | 'verification'
  | 'general'
  | 'subscription'
  | 'content'
  | 'system';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  ttl?: number; // Días hasta expiración
}

export class NotificationClient {
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  constructor(
    baseUrl: string = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1',
    apiKey: string = process.env.INTERNAL_API_KEY || 'bravas-internal-key-dev',
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': apiKey,
      },
    });
    this.apiKey = apiKey;
  }

  /**
   * Crear una notificación
   * Retorna la notificación creada o null si hay error (no lanza excepción)
   */
  async createNotification(params: CreateNotificationParams): Promise<any | null> {
    try {
      const response = await this.client.post('/notifications/internal/create', params);
      return response.data?.data || null;
    } catch (error: any) {
      // No lanzar error, solo loggear (para no interrumpir el flujo principal)
      console.error('[NotificationClient] Error al crear notificación:', error.message);
      return null;
    }
  }

  /**
   * Crear múltiples notificaciones (batching optimizado)
   * Usa el endpoint de batch si está disponible, sino procesa en lotes
   */
  async createNotifications(params: CreateNotificationParams[]): Promise<any[]> {
    if (params.length === 0) return [];

    try {
      // Intentar usar endpoint de batch (más eficiente)
      const response = await this.client.post('/notifications/internal/create-batch', {
        notifications: params,
      });
      
      if (response.data?.success && response.data?.data?.notifications) {
        return response.data.data.notifications;
      }
      
      // Fallback: procesar individualmente en lotes
      return await this.createNotificationsFallback(params);
    } catch (error: any) {
      // Si el endpoint de batch no existe, usar fallback
      if (error.response?.status === 404) {
        return await this.createNotificationsFallback(params);
      }
      
      console.error('[NotificationClient] Error al crear notificaciones en batch:', error.message);
      return [];
    }
  }

  /**
   * Fallback: crear notificaciones individualmente en lotes
   */
  private async createNotificationsFallback(params: CreateNotificationParams[]): Promise<any[]> {
    const batchSize = 10;
    const results: any[] = [];

    for (let i = 0; i < params.length; i += batchSize) {
      const batch = params.slice(i, i + batchSize);
      const promises = batch.map(p => this.createNotification(p));
      const batchResults = await Promise.allSettled(promises);
      
      const successful = batchResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
      
      results.push(...successful);
    }

    return results;
  }

  /**
   * Crear notificaciones para múltiples usuarios con el mismo contenido
   * Útil para notificaciones masivas (anuncios, actualizaciones del sistema)
   */
  async createBulkNotification(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      link?: string;
      metadata?: Record<string, any>;
      ttl?: number;
    }
  ): Promise<{ created: number; failed: number }> {
    const notifications = userIds.map(userId => ({
      userId,
      type,
      title,
      message,
      link: options?.link,
      metadata: options?.metadata,
      ttl: options?.ttl,
    }));

    const results = await this.createNotifications(notifications);
    
    return {
      created: results.length,
      failed: userIds.length - results.length,
    };
  }
}

