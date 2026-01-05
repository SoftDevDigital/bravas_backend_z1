import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO para actualizar estado de usuario (admin)
 */
export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del usuario',
    example: 'active',
    enum: ['active', 'suspended', 'pending_verification', 'banned'],
  })
  @IsEnum(['active', 'suspended', 'pending_verification', 'banned'])
  status: string;

  @ApiPropertyOptional({
    description: 'Razón del cambio de estado',
    example: 'Usuario suspendido por violación de términos',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * DTO para aprobar usuario (admin)
 */
export class ApproveUserDto {
  @ApiPropertyOptional({
    description: 'Notas de aprobación',
    example: 'Usuario verificado correctamente',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO para agregar notas de soporte
 */
export class SupportNotesDto {
  @ApiProperty({
    description: 'Notas de soporte',
    example: 'Usuario reportó problema con pago...',
  })
  @IsString()
  notes: string;
}


























