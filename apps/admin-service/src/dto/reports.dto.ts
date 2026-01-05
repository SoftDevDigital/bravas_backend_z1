import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para obtener estadísticas
 */
export class GetStatsDto {
  @ApiPropertyOptional({ description: 'Período', enum: ['day', 'week', 'month', 'year', 'all'], default: 'month' })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year', 'all'])
  period?: 'day' | 'week' | 'month' | 'year' | 'all' = 'month';

  @ApiPropertyOptional({ description: 'Fecha desde (ISO string)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO string)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}








