import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@bravas/shared';

/**
 * DTO para reenviar el código OTP
 */
export class ResendOTPDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@example.com',
    type: String,
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({
    description: 'Rol del usuario',
    example: UserRole.MODEL,
    enum: UserRole,
    enumName: 'UserRole',
  })
  @IsEnum(UserRole, {
    message: 'El rol debe ser uno de: model, agency, user, admin',
  })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: UserRole;
}
































