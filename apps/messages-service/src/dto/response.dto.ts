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
    cursor?: string; // Para paginación cursor-based
  };
}

export class ChatDto {
  @ApiProperty({ description: 'ID del chat' })
  chatId: string;

  @ApiProperty({ description: 'ID del otro participante' })
  otherParticipantId: string;

  @ApiProperty({ description: 'Nombre del otro participante' })
  otherParticipantName: string;

  @ApiPropertyOptional({ description: 'Avatar del otro participante' })
  otherParticipantAvatar?: string;

  @ApiPropertyOptional({ description: 'Vista previa del último mensaje' })
  lastMessagePreview?: string;

  @ApiPropertyOptional({ description: 'Timestamp del último mensaje' })
  lastMessageAt?: string;

  @ApiProperty({ description: 'Cantidad de mensajes no leídos' })
  unreadCount: number;

  @ApiProperty({ description: 'Si el chat está archivado' })
  isArchived: boolean;

  @ApiProperty({ description: 'Timestamp de creación' })
  createdAt: string;
}

export class MessageDto {
  @ApiProperty({ description: 'ID del mensaje' })
  messageId: string;

  @ApiProperty({ description: 'ID del chat' })
  chatId: string;

  @ApiProperty({ description: 'ID del remitente' })
  senderId: string;

  @ApiProperty({ description: 'Si el mensaje fue enviado por el usuario actual' })
  isFromMe: boolean;

  @ApiProperty({ description: 'Tipo de mensaje' })
  type: string;

  @ApiPropertyOptional({ description: 'Contenido del mensaje' })
  content?: string;

  @ApiPropertyOptional({ description: 'URL de la imagen' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Precio (para paid_image)' })
  price?: number;

  @ApiPropertyOptional({ description: 'Datos del contrato' })
  contractData?: any;

  @ApiPropertyOptional({ description: 'Datos de transferencia' })
  transferData?: any;

  @ApiProperty({ description: 'Si el mensaje fue leído' })
  read: boolean;

  @ApiPropertyOptional({ description: 'Timestamp de lectura' })
  readAt?: string;

  @ApiProperty({ description: 'Timestamp de creación' })
  createdAt: string;
}















