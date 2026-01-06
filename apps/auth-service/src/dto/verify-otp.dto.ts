import { IsNotEmpty, IsString, Length, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@bravas/shared';

/**
 * DTO para verificar el código OTP enviado por email
 */
export class VerifyOTPDto {
  @ApiProperty({
    description: 'Email del usuario que recibió el código OTP',
    example: 'usuario@example.com',
    type: String,
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsString({ message: 'El email debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @ApiProperty({
    description: 'Rol del usuario',
    example: UserRole.MODEL,
    enum: UserRole,
    enumName: 'UserRole',
  })
  @IsEnum(UserRole, { message: 'El rol debe ser uno de: model, agency, user, admin' })
  @IsNotEmpty({ message: 'El rol es requerido' })
  role: UserRole;

  @ApiProperty({
    description: 'Código OTP de 6 dígitos enviado por email',
    example: '123456',
    type: String,
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: 'El OTP debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El OTP es requerido' })
  @Length(6, 6, { message: 'El OTP debe tener exactamente 6 dígitos' })
  otp: string;
}































