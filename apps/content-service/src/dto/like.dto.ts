import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para dar like a un post
 * Nota: El postId generalmente se pasa en la URL, no en el body
 */
export class LikePostDto {
  @ApiPropertyOptional({
    description: 'ID del post (opcional si se pasa en la URL)',
    example: 'post_123',
    type: String,
  })
  @IsOptional()
  @IsString()
  postId?: string;
}

/**
 * DTO para crear comentario en un post
 */
export class CreateCommentDto {
  @ApiProperty({
    description: 'Contenido del comentario. Máximo 1000 caracteres. Será sanitizado automáticamente.',
    example: '¡Excelente contenido! Me encantó 😍',
    maxLength: 1000,
    minLength: 1,
    type: String,
  })
  @IsString()
  @IsNotEmpty({ message: 'El contenido del comentario no puede estar vacío' })
  @MaxLength(1000, { message: 'El comentario no puede exceder 1000 caracteres' })
  content: string;
}


