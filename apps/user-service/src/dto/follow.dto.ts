import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para seguir/dejar de seguir un modelo
 * 
 * Usado en:
 * - POST /users/models/:modelId/follow
 * - DELETE /users/models/:modelId/follow (opcional, también se puede pasar en URL)
 */
export class FollowModelDto {
  @ApiProperty({
    description: 'ID único del modelo a seguir o dejar de seguir',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'El ID del modelo es requerido' })
  modelId: string;
}


