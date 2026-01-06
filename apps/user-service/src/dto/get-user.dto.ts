import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@bravas/shared';

/**
 * DTO para obtener usuario
 */
export class GetUserDto {
  @ApiPropertyOptional({
    description: 'Incluir información extendida del perfil',
    example: true,
  })
  @IsOptional()
  includeProfile?: boolean;
}
































