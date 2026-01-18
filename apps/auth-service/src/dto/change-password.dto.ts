import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para cambiar contraseña
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual',
    example: 'Password123!',
    format: 'password',
  })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'Nueva contraseña (mínimo 8 caracteres, debe incluir mayúsculas, minúsculas y números)',
    example: 'NewPassword123!',
    format: 'password',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @IsString()
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    {
      message: 'La nueva contraseña debe incluir al menos una letra mayúscula, una letra minúscula y un número',
    },
  )
  newPassword: string;
}
