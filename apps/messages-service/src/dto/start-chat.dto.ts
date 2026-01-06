import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartChatDto {
  @ApiProperty({
    description: 'ID del usuario con quien iniciar el chat',
    example: 'user_1234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'El ID del usuario es requerido' })
  otherUserId: string;
}
















