import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListMessagesDto {
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
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'ID del mensaje desde el cual empezar (para paginación cursor)',
    example: 'msg_1234567890_abc123',
  })
  @IsOptional()
  @IsString()
  cursor?: string; // Para paginación cursor-based (más eficiente que offset)
}















