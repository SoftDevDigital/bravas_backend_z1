import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para moderar contenido
 */
export class ModerateContentDto {
  @ApiProperty({
    description: 'Acción a realizar',
    enum: ['approve', 'reject', 'hide', 'delete'],
    example: 'approve',
  })
  @IsEnum(['approve', 'reject', 'hide', 'delete'])
  action: 'approve' | 'reject' | 'hide' | 'delete';

  @ApiPropertyOptional({
    description: 'Razón de la moderación',
    example: 'Contenido aprobado después de revisión',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * DTO para listar contenido pendiente de moderación
 */
export class ListPendingContentDto {
  @ApiPropertyOptional({ description: 'Página', example: 1, default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Límite por página', example: 20, default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Tipo de contenido', enum: ['post', 'pack'] })
  @IsOptional()
  @IsEnum(['post', 'pack'])
  type?: 'post' | 'pack';
}








