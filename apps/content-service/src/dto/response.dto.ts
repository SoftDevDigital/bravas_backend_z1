import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({ description: 'Indica si la operación fue exitosa', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: 'Datos de la respuesta' })
  data?: T;

  @ApiPropertyOptional({ description: 'Mensaje descriptivo', example: 'Operación completada exitosamente' })
  message?: string;

  @ApiPropertyOptional({ description: 'Información de paginación' })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore?: boolean;
    cursor?: string;
  };
}

export class PostDto {
  @ApiProperty({ description: 'ID del post (alias: id para frontend)' })
  id: string;

  @ApiProperty({ description: 'ID del post (original)' })
  postId: string;

  @ApiProperty({ description: 'ID del usuario autor' })
  userId: string;

  @ApiProperty({ description: 'Rol del autor', enum: ['buyer', 'model', 'agency'] })
  userRole: 'buyer' | 'model' | 'agency';

  @ApiPropertyOptional({ description: 'Nombre del autor' })
  authorName?: string;

  @ApiPropertyOptional({ description: 'Username del autor' })
  authorUsername?: string;

  @ApiPropertyOptional({ description: 'Avatar del autor' })
  authorAvatar?: string;

  @ApiPropertyOptional({ description: 'Texto del post' })
  description?: string;

  @ApiPropertyOptional({ description: 'URL de la imagen en S3' })
  imageUrl?: string;

  @ApiProperty({ description: 'Número de likes', example: 0 })
  likesCount: number;

  @ApiProperty({ description: 'Número de comentarios', example: 0 })
  commentsCount: number;

  @ApiProperty({ description: 'Estado del post', enum: ['active', 'deleted', 'hidden'] })
  status: 'active' | 'deleted' | 'hidden';

  @ApiProperty({ description: 'Fecha de creación (ISO string)' })
  createdAt: string;
}

export class PackDto {
  @ApiProperty({ description: 'ID del pack (alias: id para frontend)' })
  id: string;

  @ApiProperty({ description: 'ID del pack (original)' })
  packId: string;

  @ApiProperty({ description: 'ID del modelo propietario' })
  modelId: string;

  @ApiPropertyOptional({ description: 'Nombre del modelo' })
  modelName?: string;

  @ApiPropertyOptional({ description: 'Username del modelo' })
  modelUsername?: string;

  @ApiPropertyOptional({ description: 'Avatar del modelo' })
  modelAvatar?: string;

  @ApiProperty({ description: 'Nombre del pack' })
  name: string;

  @ApiPropertyOptional({ description: 'Descripción del pack' })
  description?: string;

  @ApiProperty({ description: 'Precio en dólares', example: 35.00 })
  price: number;

  @ApiProperty({ description: 'URL de la imagen de portada en S3' })
  imageUrl: string;

  @ApiPropertyOptional({ description: 'URLs del contenido del pack', type: [String] })
  contentUrls?: string[];

  @ApiProperty({ description: 'Número de ventas', example: 0 })
  salesCount: number;

  @ApiProperty({ description: 'Ingresos totales en dólares', example: 0 })
  totalRevenue: number;

  @ApiProperty({ description: 'Estado del pack', enum: ['active', 'deleted', 'hidden'] })
  status: 'active' | 'deleted' | 'hidden';

  @ApiProperty({ description: 'Fecha de creación (ISO string)' })
  createdAt: string;
}
















