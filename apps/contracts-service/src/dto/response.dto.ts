import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Datos de la respuesta',
  })
  data?: T;

  @ApiPropertyOptional({
    description: 'Mensaje descriptivo',
    example: 'Operación completada exitosamente',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Información de paginación',
  })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore?: boolean;
    cursor?: string;
  };
}

export class ContractDto {
  @ApiProperty({ description: 'ID del contrato (alias: id para frontend)' })
  id: string;

  @ApiProperty({ description: 'ID del contrato (original)' })
  contractId: string;

  @ApiProperty({ description: 'ID de la agencia' })
  agencyId: string;

  @ApiProperty({ description: 'ID de la modelo' })
  modelId: string;

  @ApiPropertyOptional({ description: 'ID del chat asociado' })
  chatId?: string;

  @ApiPropertyOptional({ description: 'Nombre de la agencia' })
  agencyName?: string;

  @ApiPropertyOptional({ description: 'Username de la agencia' })
  agencyUsername?: string;

  @ApiPropertyOptional({ description: 'Logo de la agencia' })
  agencyLogo?: string;

  @ApiPropertyOptional({ description: 'Nombre de la modelo' })
  modelName?: string;

  @ApiPropertyOptional({ description: 'Username de la modelo' })
  modelUsername?: string;

  @ApiPropertyOptional({ description: 'Avatar de la modelo' })
  modelAvatar?: string;

  @ApiProperty({ description: 'Porcentaje para la modelo' })
  modelPercentage: number;

  @ApiProperty({ description: 'Porcentaje para la agencia' })
  agencyPercentage: number;

  @ApiProperty({ description: 'Estado del contrato' })
  status: 'active' | 'termination_requested' | 'terminated' | 'cancelled';

  @ApiProperty({ description: 'Fecha de inicio (ISO string, el frontend lo parsea a Date)' })
  startDate: string;

  @ApiPropertyOptional({ description: 'Fecha de terminación (ISO string, el frontend lo parsea a Date)' })
  terminationDate?: string;

  @ApiPropertyOptional({ description: 'Ganancias totales' })
  totalEarnings?: number;

  @ApiPropertyOptional({ description: 'URL del PDF del contrato' })
  pdfUrl?: string;
}

export class ContractProposalDto {
  @ApiProperty({ description: 'ID de la propuesta (alias: id para frontend)' })
  id: string;

  @ApiProperty({ description: 'ID de la propuesta (original)' })
  proposalId: string;

  @ApiProperty({ description: 'ID de la agencia' })
  agencyId: string;

  @ApiProperty({ description: 'ID de la modelo' })
  modelId: string;

  @ApiPropertyOptional({ description: 'ID del chat donde se envió la propuesta' })
  chatId?: string;

  @ApiPropertyOptional({ description: 'Nombre de la agencia' })
  agencyName?: string;

  @ApiPropertyOptional({ description: 'Username de la agencia' })
  agencyUsername?: string;

  @ApiPropertyOptional({ description: 'Logo de la agencia' })
  agencyLogo?: string;

  @ApiProperty({ description: 'Porcentaje para la modelo' })
  modelPercentage: number;

  @ApiProperty({ description: 'Porcentaje para la agencia' })
  agencyPercentage: number;

  @ApiProperty({ description: 'Estado de la propuesta' })
  status: 'pending' | 'accepted' | 'rejected' | 'expired';

  @ApiProperty({ description: 'Fecha de creación (ISO string, el frontend lo parsea a Date)' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'URL del PDF de la propuesta' })
  pdfUrl?: string;

  @ApiPropertyOptional({ description: 'Data URI del PDF' })
  pdfDataUri?: string;
}

