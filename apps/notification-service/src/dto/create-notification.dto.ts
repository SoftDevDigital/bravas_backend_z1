import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, IsNumber, Min } from 'class-validator';

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

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID del usuario que recibirá la notificación',
    example: 'user_123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Tipo de notificación',
    enum: ['message', 'contract', 'transfer', 'payment', 'verification', 'general', 'subscription', 'content', 'system'],
    example: 'message',
  })
  @IsEnum(['message', 'contract', 'transfer', 'payment', 'verification', 'general', 'subscription', 'content', 'system'])
  type: NotificationType;

  @ApiProperty({
    description: 'Título de la notificación',
    example: 'Nuevo mensaje',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Mensaje de la notificación',
    example: 'Has recibido un nuevo mensaje de Juan',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'URL para navegar desde la notificación',
    example: '/messages/chat_123',
  })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({
    description: 'Datos adicionales según el tipo',
    example: { chatId: 'chat_123', messageId: 'msg_456' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'TTL en días (default: 90)',
    example: 90,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  ttl?: number;
}








