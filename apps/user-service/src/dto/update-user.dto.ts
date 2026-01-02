import { IsOptional, IsString, IsDateString, IsEnum, IsObject, IsEmail, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@bravas/shared';
import { Transform } from 'class-transformer';

/**
 * DTO para actualizar perfil de usuario
 * Campos actualizables según el rol
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Nombre completo',
    example: 'Juan Pérez',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/, { message: 'El nombre solo puede contener letras, espacios, guiones y apostrofes' })
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Código de país ISO (2 letras)',
    example: 'AR',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'El código de país debe ser un código ISO de 2 letras (ej: AR, US, MX)' })
  @Transform(({ value }) => value?.toUpperCase()?.trim())
  country?: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento (formato YYYY-MM-DD)',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe estar en formato YYYY-MM-DD' })
  @ValidateIf((o) => {
    if (!o.birthDate) return true;
    const date = new Date(o.birthDate);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      return age - 1 >= 18;
    }
    return age >= 18;
  }, { message: 'Debes ser mayor de 18 años' })
  birthDate?: string;

  @ApiPropertyOptional({
    description: 'Biografía/Descripción',
    example: 'Soy un modelo profesional...',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La biografía no puede exceder 2000 caracteres' })
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @ApiPropertyOptional({
    description: 'URL del avatar',
    example: 'https://...',
  })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'La URL del avatar debe ser una URL válida (http:// o https://)' })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Preferencias del usuario (objeto JSON)',
    example: { theme: 'dark', language: 'es' },
  })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  // Campos específicos por rol se agregarán según necesidades
}









