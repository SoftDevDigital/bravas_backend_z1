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
    example: {
      modelId: 'model_123',
      modelName: 'Ana Martínez',
      modelUsername: '@ana_model',
      modelAvatar: 'https://cdn.bravas.com/avatars/model123.jpg',
      agencyId: 'agency_456',
      agencyName: 'Model Agency Pro',
      contractType: 'con_pago',
      modelPercentage: 88,
      agencyPercentage: 12,
      bravasCommission: 12,
      advancePayment: 50000,
      notes: 'Contrato con compromiso de 3 meses',
      status: 'pending',
    },
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
    modelAvatar?: string;
    agencyId?: string;
    agencyName?: string;
    contractType?: 'sin_pago' | 'con_pago';
    modelPercentage?: number;
    agencyPercentage?: number;
    bravasCommission?: number;
    advancePayment?: number;
    notes?: string;
    pdfUrl?: string;
    pdfDataUri?: string;
    contractDate?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  };

  @ApiPropertyOptional({
    description: 'Datos de transferencia (para tipos transfer_*)',
    type: Object,
    additionalProperties: true,
    example: {
      modelId: 'model_123',
      modelName: 'Ana Martínez',
      modelUsername: '@ana_model',
      modelAvatar: 'https://cdn.bravas.com/avatars/model123.jpg',
      requestingAgencyId: 'agency_456',
      requestingAgencyName: 'New Agency',
      fromAgency: 'New Agency',
      currentAgencyId: 'agency_789',
      currentAgencyName: 'Current Agency',
      toAgency: 'Current Agency',
      transferAmount: 100000,
      requestedAmount: 100000,
      bravasCommission: 12000,
      netAmount: 88000,
      modelPart: 44000,
      agencyPart: 44000,
      transferNotes: 'Solicitud de transferencia de contrato',
      notes: 'Solicitud de transferencia de contrato',
      status: 'pending',
    },
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
    fromAgency?: string; // Alias de requestingAgencyName para compatibilidad con frontend
    currentAgencyId?: string;
    currentAgencyName?: string;
    toAgency?: string; // Alias de currentAgencyName para compatibilidad con frontend
    modelId?: string;
    modelName?: string;
    modelUsername?: string;
    modelAvatar?: string;
    modelPhotos?: string[];
    transferAmount?: number; // Monto total en centavos
    requestedAmount?: number; // Alias de transferAmount
    bravasCommission?: number; // Comisión de Bravas en centavos
    netAmount?: number; // Monto neto después de comisión Bravas
    modelPart?: number; // Parte del modelo en centavos
    agencyPart?: number; // Parte de la agencia en centavos
    transferNotes?: string;
    notes?: string; // Alias de transferNotes
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

