import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, PaginationDto } from '@bravas/shared';

/**
 * DTO para listar usuarios con filtros
 */
export class ListUsersDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por rol',
    enum: UserRole,
    example: UserRole.MODEL,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filtrar por país',
    example: 'AR',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de verificación',
    example: true,
  })
  @IsOptional()
  verified?: boolean;

  @ApiPropertyOptional({
    description: 'Buscar por nombre o email',
    example: 'juan',
  })
  @IsOptional()
  @IsString()
  search?: string;
}






























