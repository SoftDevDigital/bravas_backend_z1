import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({
    description: 'Texto del post',
    example: '¡Nueva sesión de fotos! 🔥',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede exceder 2000 caracteres' })
  description?: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen en S3 (después de subirla)',
    example: 'https://s3.amazonaws.com/bravas-content/posts/image_123.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Key de la imagen en S3 (para eliminación)',
    example: 'posts/user123/image_123.jpg',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;
}















