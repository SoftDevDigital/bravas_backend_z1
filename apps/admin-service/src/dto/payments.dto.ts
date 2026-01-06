import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para listar transacciones (admin)
 */
export class ListTransactionsDto {
  @ApiPropertyOptional({ description: 'Página', example: 1, default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Límite por página', example: 20, default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: ['pending', 'succeeded', 'failed', 'refunded'] })
  @IsOptional()
  @IsEnum(['pending', 'succeeded', 'failed', 'refunded'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo', enum: ['tip', 'ppv', 'subscription'] })
  @IsOptional()
  @IsEnum(['tip', 'ppv', 'subscription'])
  type?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (ISO string)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO string)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/**
 * DTO para procesar reembolso
 */
export class ProcessRefundDto {
  @ApiProperty({ description: 'Razón del reembolso', example: 'Solicitud del usuario' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Monto del reembolso (en centavos). Si no se especifica, se reembolsa el monto completo' })
  @IsOptional()
  amount?: number;
}











