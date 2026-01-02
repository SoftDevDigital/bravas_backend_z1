import { IsString, IsEnum, IsOptional, IsNumber, IsObject, IsUrl, Min, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MessageType {
  TEXT = 'text',
  PAID_IMAGE = 'paid_image',
  CONTRACT_PDF = 'contract_pdf',
  CONTRACT_PROPOSAL = 'contract_proposal',
  AGENCY_TRANSFER_REQUEST = 'agency_transfer_request',
  MODEL_TRANSFER_PROPOSAL = 'model_transfer_proposal',
}

export class CreateMessageDto {
  @ApiProperty({
    description: 'ID del chat donde se envía el mensaje',
    example: 'chat_user123_user456',
  })
  @IsString()
  chatId: string;

  @ApiProperty({
    description: 'Tipo de mensaje',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiPropertyOptional({
    description: 'Contenido del mensaje (requerido para tipo "text")',
    example: 'Hola, ¿cómo estás?',
    maxLength: 5000,
  })
  @ValidateIf((o) => o.type === MessageType.TEXT)
  @IsString()
  @MaxLength(5000, { message: 'El contenido no puede exceder 5000 caracteres' })
  content?: string;

  @ApiPropertyOptional({
    description: 'URL de la imagen (requerido para tipo "paid_image")',
    example: 'https://cdn.bravas.com/images/photo123.jpg',
  })
  @ValidateIf((o) => o.type === MessageType.PAID_IMAGE)
  @IsUrl({}, { message: 'La URL de la imagen debe ser válida' })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Precio de la imagen en centavos (requerido para tipo "paid_image")',
    example: 1999,
    minimum: 50,
  })
  @ValidateIf((o) => o.type === MessageType.PAID_IMAGE)
  @IsNumber()
  @Min(50, { message: 'El precio mínimo es $0.50 (50 centavos)' })
  price?: number;

  @ApiPropertyOptional({
    description: 'Datos del contrato (para tipos contract_*)',
    type: Object,
    additionalProperties: true,
  })
  @ValidateIf((o) => 
    o.type === MessageType.CONTRACT_PDF || 
    o.type === MessageType.CONTRACT_PROPOSAL
  )
  @IsObject()
  @IsOptional()
  contractData?: {
    contractId?: string;
    modelId?: string;
    modelName?: string;
    modelUsername?: string;
    agencyId?: string;
    agencyName?: string;
    modelPercentage?: number;
    agencyPercentage?: number;
    bravasCommission?: number;
    pdfUrl?: string;
    pdfDataUri?: string;
    contractDate?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  };

  @ApiPropertyOptional({
    description: 'Datos de transferencia (para tipos transfer_*)',
    type: Object,
    additionalProperties: true,
  })
  @ValidateIf((o) => 
    o.type === MessageType.AGENCY_TRANSFER_REQUEST || 
    o.type === MessageType.MODEL_TRANSFER_PROPOSAL
  )
  @IsObject()
  @IsOptional()
  transferData?: {
    transferId?: string;
    requestingAgencyId?: string;
    requestingAgencyName?: string;
    currentAgencyId?: string;
    currentAgencyName?: string;
    modelId?: string;
    modelName?: string;
    modelPhotos?: string[];
    transferAmount?: number;
    bravasCommission?: number;
    netAmount?: number;
    transferNotes?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  };

  @ApiPropertyOptional({
    description: 'Metadatos adicionales',
    type: Object,
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

