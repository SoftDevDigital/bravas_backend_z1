import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString } from 'class-validator';

/**
 * DTO para obtener estadísticas con filtros de fecha
 */
export class StatsQueryDto {
  @ApiPropertyOptional({
    description: 'Fecha de inicio (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Tipo de estadísticas',
    example: 'sales',
    enum: ['sales', 'earnings', 'buyers', 'content', 'all'],
  })
  @IsOptional()
  @IsEnum(['sales', 'earnings', 'buyers', 'content', 'all'])
  type?: string = 'all';
}


























