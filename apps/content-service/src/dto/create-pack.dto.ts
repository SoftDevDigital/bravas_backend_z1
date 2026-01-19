import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class CreatePackDto {
  @ApiProperty({
    description: 'Nombre del pack',
    example: 'Pack "Chica Traviesa"',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción del pack',
    example: 'Pack exclusivo con fotos y videos',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;

  @ApiProperty({
    description: 'Precio del pack en dólares (ej: 35.00 = $35.00)',
    example: 35.00,
    minimum: 1.00, // Mínimo $1.00
  })
  @IsNumber()
  @Min(1.00, { message: 'El precio mínimo es $1.00' })
  price: number; // Precio en dólares

  @ApiProperty({
    description: 'URL de la imagen de portada en S3',
    example: 'https://s3.amazonaws.com/bravas-content/packs/pack_123.jpg',
  })
  @IsString()
  imageUrl: string;

  @ApiProperty({
    description: 'Key de la imagen de portada en S3 (para eliminación)',
    example: 'packs/model123/pack_123.jpg',
  })
  @IsString()
  imageKey: string;

  @ApiPropertyOptional({
    description: 'URLs de las imágenes/videos del pack en S3',
    example: ['https://s3.amazonaws.com/bravas-content/packs/content1.jpg'],
    type: [String],
  })
  @IsOptional()
  contentUrls?: string[];

  @ApiPropertyOptional({
    description: 'Keys del contenido en S3 (para eliminación)',
    example: ['packs/model123/content1.jpg'],
    type: [String],
  })
  @IsOptional()
  contentKeys?: string[];
}
















