import { IsEmail, IsString, MinLength, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@bravas/shared';

/**
 * DTO para registro de usuarios
 * Simplificado - solo campos esenciales
 */
export class RegisterDto {
  @ApiProperty({
    description: 'Email del usuario (debe ser único)',
    example: 'usuario@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 8 caracteres)',
    example: 'Password123!',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Rol del usuario en la plataforma. Solo se pueden registrar roles públicos: user, model, agency',
    enum: UserRole,
    example: UserRole.MODEL,
    enumName: 'UserRole',
  })
  @IsEnum(UserRole, { 
    message: 'El rol debe ser uno de: user, model, agency. Los roles administrativos (admin, support, moderator) no se pueden registrar públicamente.' 
  })
  role: UserRole;

  @ApiProperty({
    description: 'Fecha de nacimiento en formato YYYY-MM-DD (debe ser mayor de edad)',
    example: '2000-01-01',
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser válida (YYYY-MM-DD)' })
  birthDate: string;

  @ApiPropertyOptional({
    description: 'Código de país ISO (opcional)',
    example: 'AR',
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  country?: string;
}

