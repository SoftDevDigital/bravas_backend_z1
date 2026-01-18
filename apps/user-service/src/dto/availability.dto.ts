import { IsOptional, IsBoolean, IsArray, IsNumber, IsString, IsIn, MaxLength, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO para configurar disponibilidad para representación (solo modelos)
 */
export class UpdateAvailabilityDto {
  @ApiPropertyOptional({
    description: '¿Estás disponible para representación de agencias?',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return Boolean(value);
  })
  available?: boolean;

  @ApiPropertyOptional({
    description: 'Tipos de contrato que aceptas',
    example: ['with_advance', 'without_advance'],
    enum: ['with_advance', 'without_advance'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['with_advance', 'without_advance'], { each: true, message: 'Los tipos de contrato deben ser "with_advance" o "without_advance"' })
  contractTypes?: string[];

  @ApiPropertyOptional({
    description: 'Monto de anticipo requerido (solo si contractTypes incluye "with_advance")',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El anticipo debe ser mayor o igual a 0' })
  @Max(999999, { message: 'El anticipo no puede exceder 999,999' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value;
  })
  advancePayment?: number;

  @ApiPropertyOptional({
    description: 'Notas adicionales para las agencias',
    example: 'Solo acepto contratos con mínimo 6 meses de duración',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
  @Transform(({ value }) => value?.trim())
  notes?: string;
}
