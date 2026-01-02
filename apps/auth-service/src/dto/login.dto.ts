import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para login de usuario
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario registrado',
    example: 'usuario@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123!',
    format: 'password',
  })
  @IsString()
  password: string;
}


