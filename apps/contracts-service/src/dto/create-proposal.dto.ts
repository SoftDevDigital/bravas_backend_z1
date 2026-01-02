import { IsString, IsNumber, IsOptional, IsUrl, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProposalDto {
  @ApiProperty({
    description: 'ID de la modelo a quien se propone el contrato',
    example: 'user_model123',
  })
  @IsString()
  modelId: string;

  @ApiProperty({
    description: 'Porcentaje para la modelo (debe estar entre 50 y 70)',
    example: 60,
    minimum: 50,
    maximum: 70,
  })
  @IsNumber()
  @Min(50, { message: 'El porcentaje de la modelo debe ser al menos 50%' })
  @Max(70, { message: 'El porcentaje de la modelo no puede exceder 70%' })
  modelPercentage: number;

  @ApiPropertyOptional({
    description: 'URL del PDF de la propuesta en S3',
    example: 'https://s3.amazonaws.com/bravas-contracts/proposal_123.pdf',
  })
  @IsUrl({}, { message: 'La URL del PDF debe ser válida' })
  @IsOptional()
  pdfUrl?: string;

  @ApiPropertyOptional({
    description: 'Data URI del PDF de la propuesta (para envío inicial)',
    example: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMy...',
  })
  @IsString()
  @IsOptional()
  pdfDataUri?: string;

  @ApiPropertyOptional({
    description: 'ID del chat donde se envía la propuesta (integración con Messages Service)',
    example: 'chat_agency123_model456_1234567890',
  })
  @IsString()
  @IsOptional()
  chatId?: string;
}

