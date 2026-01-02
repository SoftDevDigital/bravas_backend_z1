/**
 * Esquema de Base de Datos DynamoDB para Messages Service
 * 
 * Tablas principales:
 * 1. chats - Conversaciones entre usuarios
 * 2. messages - Mensajes individuales
 */

export interface ChatRecord {
  // Partition Key
  chatId: string; // PK: chat_{userId1}_{userId2} (ordenado alfabéticamente)
  
  // Sort Key (para GSI)
  createdAt: string; // ISO timestamp
  
  // Participantes
  participant1Id: string; // Usuario 1 (menor ID alfabéticamente)
  participant2Id: string; // Usuario 2 (mayor ID alfabéticamente)
  
  // Información del chat
  lastMessageId?: string; // ID del último mensaje
  lastMessageAt?: string; // Timestamp del último mensaje
  lastMessagePreview?: string; // Vista previa del último mensaje
  
  // Contadores de no leídos
  unreadCount1: number; // No leídos para participant1
  unreadCount2: number; // No leídos para participant2
  
  // Metadatos
  participant1Name?: string; // Nombre del participante 1 (caché)
  participant1Avatar?: string; // Avatar del participante 1 (caché)
  participant2Name?: string; // Nombre del participante 2 (caché)
  participant2Avatar?: string; // Avatar del participante 2 (caché)
  
  // Estado
  isActive: boolean; // Si el chat está activo
  archivedBy1?: boolean; // Si participant1 archivó el chat
  archivedBy2?: boolean; // Si participant2 archivó el chat
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  
  // TTL (opcional, para limpieza automática de chats inactivos)
  ttl?: number; // Unix timestamp para expiración (ej: 1 año de inactividad)
}

export interface MessageRecord {
  // Partition Key
  messageId: string; // PK: msg_{timestamp}_{random}
  
  // Sort Key
  createdAt: string; // ISO timestamp
  
  // Referencias
  chatId: string; // GSI: chatId-createdAt-index
  senderId: string; // GSI: senderId-createdAt-index
  
  // Contenido del mensaje
  type: 'text' | 'paid_image' | 'contract_pdf' | 'contract_proposal' | 
        'agency_transfer_request' | 'model_transfer_proposal';
  
  // Contenido según tipo
  content?: string; // Para tipo "text"
  imageUrl?: string; // Para tipo "paid_image"
  price?: number; // Para tipo "paid_image" (en centavos)
  
  // Datos de contrato (para tipos contract_*)
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
    pdfUrl?: string; // URL del PDF en S3
    pdfDataUri?: string; // Base64 del PDF (temporal)
    contractDate?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  };
  
  // Datos de transferencia (para tipos transfer_*)
  transferData?: {
    transferId?: string;
    requestingAgencyId?: string;
    requestingAgencyName?: string;
    currentAgencyId?: string;
    currentAgencyName?: string;
    modelId?: string;
    modelName?: string;
    modelPhotos?: string[];
    transferAmount?: number; // En centavos
    bravasCommission?: number;
    netAmount?: number;
    transferNotes?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  };
  
  // Información de pago (para paid_image)
  paymentId?: string; // ID del pago en payment-service
  paymentStatus?: 'pending' | 'succeeded' | 'failed';
  
  // Estado de lectura
  read: boolean;
  readAt?: string; // Timestamp cuando se leyó
  
  // Metadatos
  metadata?: {
    [key: string]: any;
  };
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  
  // TTL (opcional, para limpieza automática de mensajes antiguos)
  ttl?: number; // Unix timestamp para expiración (ej: 2 años)
}

/**
 * Helper para generar chatId consistente
 * Ordena los IDs alfabéticamente para garantizar unicidad
 */
export function generateChatId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `chat_${sorted[0]}_${sorted[1]}`;
}

/**
 * Helper para determinar qué participante es (1 o 2)
 */
export function getParticipantNumber(
  chatId: string,
  userId: string
): 1 | 2 {
  const parts = chatId.split('_');
  const participant1Id = parts[1];
  return userId === participant1Id ? 1 : 2;
}







