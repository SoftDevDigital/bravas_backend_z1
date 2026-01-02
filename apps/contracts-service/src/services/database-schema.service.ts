/**
 * Esquema de Base de Datos DynamoDB para Contracts Service
 * 
 * Tablas principales:
 * 1. contracts - Contratos activos de representación
 * 2. contract_proposals - Propuestas de contrato (pendientes)
 */

export interface ContractRecord {
  // Partition Key
  contractId: string; // PK: contract_{agencyId}_{modelId}_{timestamp}
  
  // Sort Key (para GSI)
  createdAt: string; // ISO timestamp
  
  // Participantes
  agencyId: string; // ID de la agencia
  modelId: string; // ID de la modelo
  
  // Integración con Messages Service
  chatId?: string; // ID del chat asociado a la propuesta original
  
  // Información de participantes (caché)
  agencyName?: string;
  agencyUsername?: string;
  agencyLogo?: string;
  modelName?: string;
  modelUsername?: string;
  modelAvatar?: string;
  
  // Términos del contrato
  modelPercentage: number; // Porcentaje para la modelo (50-70%)
  agencyPercentage: number; // Porcentaje para la agencia (30-50%)
  bravasCommission: number; // Comisión de Bravas (12%)
  
  // Estado del contrato
  status: 'active' | 'termination_requested' | 'terminated' | 'cancelled';
  
  // Fechas
  startDate: string; // ISO timestamp - Fecha de inicio
  terminationRequestDate?: string; // ISO timestamp - Fecha de solicitud de terminación
  terminationDate?: string; // ISO timestamp - Fecha de terminación (startDate + 15 días)
  endDate?: string; // ISO timestamp - Fecha de finalización real
  
  // Estadísticas
  totalEarnings?: number; // Ganancias totales generadas (en centavos)
  totalPayments?: number; // Número de pagos procesados
  
  // PDF del contrato
  pdfUrl?: string; // URL del PDF en S3
  pdfDataUri?: string; // Data URI del PDF (para envío inicial)
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  
  // TTL (opcional, para limpieza automática de contratos terminados)
  ttl?: number; // Unix timestamp para expiración (ej: 1 año después de terminación)
}

export interface ContractProposalRecord {
  // Partition Key
  proposalId: string; // PK: proposal_{agencyId}_{modelId}_{timestamp}
  
  // Sort Key (para GSI)
  createdAt: string; // ISO timestamp
  
  // Participantes
  agencyId: string; // ID de la agencia que propone
  modelId: string; // ID de la modelo
  
  // Integración con Messages Service
  chatId?: string; // ID del chat donde se envió la propuesta
  
  // Información de participantes (caché)
  agencyName?: string;
  agencyUsername?: string;
  agencyLogo?: string;
  modelName?: string;
  modelUsername?: string;
  modelAvatar?: string;
  
  // Términos de la propuesta
  modelPercentage: number; // Porcentaje propuesto para la modelo (50-70%)
  agencyPercentage: number; // Porcentaje propuesto para la agencia (30-50%)
  bravasCommission: number; // Comisión de Bravas (12%)
  
  // Estado de la propuesta
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  
  // Fechas
  expiresAt?: string; // ISO timestamp - Fecha de expiración (opcional, ej: 30 días)
  respondedAt?: string; // ISO timestamp - Fecha de respuesta
  contractId?: string; // ID del contrato creado si fue aceptada
  
  // PDF de la propuesta (opcional)
  pdfUrl?: string; // URL del PDF en S3
  pdfDataUri?: string; // Data URI del PDF
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  
  // TTL (opcional, para limpieza automática de propuestas expiradas)
  ttl?: number; // Unix timestamp para expiración
}

/**
 * Helper para generar contractId
 */
export function generateContractId(agencyId: string, modelId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const sortedIds = [agencyId, modelId].sort();
  return `contract_${sortedIds[0]}_${sortedIds[1]}_${ts}`;
}

/**
 * Helper para generar proposalId
 */
export function generateProposalId(agencyId: string, modelId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `proposal_${agencyId}_${modelId}_${ts}`;
}

