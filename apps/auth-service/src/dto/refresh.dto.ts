import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para refresh token
 * GESTIÓN AUTOMÁTICA: Los tokens se sincronizan automáticamente en todas las sesiones
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token obtenido del endpoint de login',
    example: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
  })
  @IsString()
  refreshToken: string;

  @ApiProperty({
    description: 'Email del usuario (requerido para identificar la sesión)',
    example: 'usuario@example.com',
  })
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsString()
  email: string;

  @ApiPropertyOptional({
    description: 'ID de la sesión (opcional, solo para referencia - la sincronización es automática)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}


