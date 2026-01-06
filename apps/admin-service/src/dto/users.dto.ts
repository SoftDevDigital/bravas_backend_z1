import { IsOptional, IsString, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
 * DTO para listar usuarios (admin)
 */
export class ListUsersDto {
  @ApiPropertyOptional({ description: 'Página', example: 1, default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Límite por página', example: 20, default: 20 })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filtrar por rol', enum: ['buyer', 'model', 'agency', 'admin'] })
  @IsOptional()
  @IsEnum(['buyer', 'model', 'agency', 'admin'])
  role?: string;

  @ApiPropertyOptional({ description: 'Solo usuarios verificados', example: true })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: ['active', 'suspended', 'banned', 'pending_verification'] })
  @IsOptional()
  @IsEnum(['active', 'suspended', 'banned', 'pending_verification'])
  status?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por texto (nombre, email, username)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * DTO para suspender usuario
 */
export class SuspendUserDto {
  @ApiProperty({ description: 'Razón de la suspensión', example: 'Violación de términos de servicio' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ description: 'Duración de la suspensión en días', example: 7 })
  @IsOptional()
  durationDays?: number;
}

/**
 * DTO para banear usuario
 */
export class BanUserDto {
  @ApiProperty({ description: 'Razón del baneo', example: 'Violación grave de términos de servicio' })
  @IsString()
  reason: string;
}











