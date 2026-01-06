import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Datos de la respuesta',
  })
  data?: T;

  @ApiPropertyOptional({
    description: 'Mensaje descriptivo',
    example: 'Operación completada exitosamente',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Información de paginación',
  })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore?: boolean;
  };
}

export class NotificationDto {
  @ApiProperty({ description: 'ID de la notificación' })
  id: string;

  @ApiProperty({ description: 'ID de la notificación (alias de id)' })
  notificationId: string;

  @ApiProperty({ description: 'ID del usuario' })
  userId: string;

  @ApiProperty({ 
    description: 'Tipo de notificación',
    enum: ['message', 'contract', 'transfer', 'payment', 'verification', 'general', 'subscription', 'content', 'system'],
  })
  type: string;

  @ApiProperty({ description: 'Título de la notificación' })
  title: string;

  @ApiProperty({ description: 'Mensaje de la notificación' })
  message: string;

  @ApiProperty({ description: 'Si la notificación fue leída' })
  read: boolean;

  @ApiPropertyOptional({ description: 'Timestamp de lectura' })
  readAt?: string;

  @ApiPropertyOptional({ description: 'URL para navegar desde la notificación' })
  link?: string;

  @ApiPropertyOptional({ description: 'Datos adicionales según el tipo' })
  metadata?: {
    contractId?: string;
    chatId?: string;
    messageId?: string;
    paymentId?: string;
    transferId?: string;
    verificationId?: string;
    [key: string]: any;
  };

  @ApiProperty({ description: 'Timestamp de creación (ISO string)' })
  timestamp: string;

  @ApiProperty({ description: 'Fecha de creación (ISO string)' })
  createdAt: string;
}










