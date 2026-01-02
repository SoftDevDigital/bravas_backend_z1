import { IsOptional, IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO para aplicar a una agencia (modelo postulándose)
 */
export class ApplyAgencyDto {
  @ApiProperty({
    description: 'Mensaje de postulación',
    example: 'Me interesa formar parte de su agencia...',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10, { message: 'El mensaje debe tener al menos 10 caracteres' })
  @MaxLength(1000, { message: 'El mensaje no puede exceder 1000 caracteres' })
  @Transform(({ value }) => value?.trim())
  message: string;
}

/**
 * DTO para proponer representación (agencia proponiendo a modelo)
 */
export class ProposeRepresentationDto {
  @ApiProperty({
    description: 'Mensaje de propuesta',
    example: 'Nos gustaría representarte...',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10, { message: 'El mensaje debe tener al menos 10 caracteres' })
  @MaxLength(1000, { message: 'El mensaje no puede exceder 1000 caracteres' })
  @Transform(({ value }) => value?.trim())
  message: string;

  @ApiPropertyOptional({
    description: 'Términos de la representación',
    example: 'Comisión del 20%, exclusividad...',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Los términos no pueden exceder 2000 caracteres' })
  @Transform(({ value }) => value?.trim())
  terms?: string;
}

/**
 * DTO para contactar otra agencia
 */
export class ContactAgencyDto {
  @ApiProperty({
    description: 'Mensaje de contacto',
    example: 'Estamos interesados en negociar...',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(10, { message: 'El mensaje debe tener al menos 10 caracteres' })
  @MaxLength(1000, { message: 'El mensaje no puede exceder 1000 caracteres' })
  @Transform(({ value }) => value?.trim())
  message: string;

  @ApiPropertyOptional({
    description: 'Tipo de relación',
    example: 'negotiation',
    enum: ['negotiation', 'partnership', 'model_transfer'],
  })
  @IsOptional()
  @IsEnum(['negotiation', 'partnership', 'model_transfer'])
  relationType?: string;
}





