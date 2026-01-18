import { IsOptional, IsString, IsEnum, IsInt, Min, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { UserRole } from '@bravas/shared';

/**
 * DTO para listar modelos/agencias en el marketplace
 * Todos los filtros son opcionales y se pasan como query parameters
 */
export class MarketplaceQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda por texto (nombre, email, bio)',
    example: 'maria',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'La búsqueda debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'La búsqueda no puede exceder 100 caracteres' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por país (código ISO de 2 letras)',
    example: 'AR',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'El código de país debe ser un código ISO de 2 letras (ej: AR, US, MX)' })
  @Transform(({ value }) => value?.toUpperCase()?.trim())
  country?: string;

  @ApiPropertyOptional({
    description: 'Filtrar solo verificados',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  verified?: boolean;

  @ApiPropertyOptional({
    description: 'Página (paginación)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Ordenar por campo',
    example: 'createdAt',
    enum: ['createdAt', 'reputation', 'totalSales', 'name', 'rating', 'experience', 'totalModels'],
  })
  @IsOptional()
  @IsEnum(['createdAt', 'reputation', 'totalSales', 'name', 'rating', 'experience', 'totalModels'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Orden (ascendente o descendente)',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Solo agencias recomendadas',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  recommended?: boolean;

  @ApiPropertyOptional({
    description: 'Rating mínimo de la agencia (0-5)',
    example: 4,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Años de experiencia mínimo de la agencia',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minExperience?: number;

  @ApiPropertyOptional({
    description: 'Cantidad mínima de modelos gestionados por la agencia',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minModels?: number;
}





