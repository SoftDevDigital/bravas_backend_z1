import { v4 as uuidv4 } from 'uuid';

/**
 * Tipos de notificaciones soportados
 */
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

/**
 * Schema de registro de notificación en DynamoDB
 */
export interface NotificationRecord {
  notificationId: string; // PK
  userId: string; // GSI partition key
  createdAt: string; // GSI sort key (ISO string)
  createdAtTimestamp: number; // Para ordenamiento numérico
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: string;
  link?: string; // URL para navegar desde la notificación
  metadata?: {
    // Datos adicionales según el tipo
    contractId?: string;
    chatId?: string;
    messageId?: string;
    paymentId?: string;
    transferId?: string;
    verificationId?: string;
    [key: string]: any;
  };
  ttl?: number; // Time-to-Live (opcional, para auto-eliminación)
}

/**
 * Genera un ID único para notificación
 */
export function generateNotificationId(): string {
  return `notif_${uuidv4()}`;
}

/**
 * Crea un registro de notificación
 */
export function createNotificationRecord(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    link?: string;
    metadata?: Record<string, any>;
    ttl?: number; // Días hasta expiración (default: 90 días)
  },
): NotificationRecord {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  
  // TTL: 90 días por defecto (en segundos Unix timestamp)
  const defaultTtl = Math.floor(now / 1000) + (90 * 24 * 60 * 60);
  const ttl = options?.ttl 
    ? Math.floor(now / 1000) + (options.ttl * 24 * 60 * 60)
    : defaultTtl;

  return {
    notificationId: generateNotificationId(),
    userId,
    createdAt,
    createdAtTimestamp: now,
    type,
    title,
    message,
    read: false,
    link: options?.link,
    metadata: options?.metadata,
    ttl,
  };
}


