import { IsOptional, IsString, IsDateString, IsEnum, IsObject, IsEmail, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@bravas/shared';
import { Transform, Exclude } from 'class-transformer';

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
    description: 'Alias único del usuario (formato @ejemplo)',
    example: '@juan_perez',
    minLength: 2,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El alias debe tener al menos 2 caracteres' })
  @MaxLength(30, { message: 'El alias no puede exceder 30 caracteres' })
  @Matches(/^@[a-zA-Z0-9_]+$/, { message: 'El alias debe comenzar con @ y solo puede contener letras, números y guiones bajos (ej: @juan_perez)' })
  @Transform(({ value }) => {
    // Normalizar: asegurar que empiece con @ y en minúsculas
    if (value) {
      const trimmed = value.trim().toLowerCase();
      return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    }
    return value;
  })
  alias?: string;

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
    description: 'Preferencias del usuario (objeto JSON). En multipart/form-data debe enviarse como string JSON.',
    example: {
      theme: 'dark',
      language: 'es',
      notifications: {
        messages: true,
        contracts: true,
        transfers: true,
        payments: true,
        general: true,
      },
    },
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si viene como string (multipart/form-data), parsearlo a objeto
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        // Si no es JSON válido, retornar el valor original para que falle la validación
        return value;
      }
    }
    // Si ya es un objeto, retornarlo tal cual
    return value;
  })
  @IsObject({ message: 'preferences must be an object' })
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    notifications?: {
      messages?: boolean;
      contracts?: boolean;
      transfers?: boolean;
      payments?: boolean;
      general?: boolean;
    };
    [key: string]: any; // Permitir otras preferencias
  };

  // Nota: El campo 'avatar' NO debe estar aquí como propiedad del DTO
  // Solo debe venir como archivo en multipart/form-data usando @UploadedFile()
  // El ValidationPipe con whitelist: true eliminará automáticamente cualquier campo 'avatar' del body

  // Campos específicos por rol se agregarán según necesidades
}









