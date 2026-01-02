import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Respuesta estándar de éxito
 */
export class SuccessResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Mensaje descriptivo de la operación',
    example: 'Operación completada exitosamente',
  })
  message?: string;
}

/**
 * Respuesta de registro exitoso
 */
export class RegisterResponseDto extends SuccessResponseDto {
  @ApiProperty({
    description: 'ID único del usuario creado',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  userId: string;

  @ApiProperty({
    description: 'Email del usuario registrado',
    example: 'usuario@example.com',
  })
  email: string;
}

/**
 * Tokens de autenticación
 */
export class AuthTokensDto {
  @ApiProperty({
    description: 'Token de acceso JWT (usar en header Authorization: Bearer <token>)',
    example: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token de refresh para obtener nuevos tokens',
    example: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token de identidad JWT',
    example: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
  })
  idToken: string;

  @ApiProperty({
    description: 'Tiempo de expiración del token en segundos',
    example: 3600,
  })
  expiresIn: number;

  @ApiPropertyOptional({
    description: 'ID único de la sesión (para gestión de multi-sesión)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  sessionId?: string;
}

/**
 * Respuesta de login exitoso
 */
export class LoginResponseDto extends SuccessResponseDto {
  @ApiProperty({
    description: 'Datos de autenticación con tokens',
    type: AuthTokensDto,
  })
  data: AuthTokensDto;
}

/**
 * Información del usuario actual
 */
export class UserInfoDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Username en Cognito',
    example: 'usuario@example.com',
  })
  username: string;

  @ApiProperty({
    description: 'Atributos del usuario en Cognito',
    type: [Object],
    example: [
      { Name: 'email', Value: 'usuario@example.com' },
      { Name: 'custom:role', Value: 'model' },
    ],
  })
  attributes: Array<{ Name: string; Value: string }>;
}

/**
 * Respuesta de información del usuario
 */
export class GetMeResponseDto extends SuccessResponseDto {
  @ApiProperty({
    description: 'Información del usuario autenticado',
    type: UserInfoDto,
  })
  data: UserInfoDto;
}

/**
 * Respuesta de error estándar
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código de estado HTTP',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Mensaje de error',
    example: 'Error de validación',
  })
  message: string | string[];

  @ApiProperty({
    description: 'Timestamp del error',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Ruta donde ocurrió el error',
    example: '/api/v1/auth/register',
  })
  path: string;
}

