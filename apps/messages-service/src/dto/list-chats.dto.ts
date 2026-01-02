import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListChatsDto {
  @ApiPropertyOptional({
    description: 'Página (paginación)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Incluir solo chats con mensajes no leídos',
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Incluir chats archivados',
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean = false;
}







