/**
 * Esquema de Base de Datos DynamoDB para Payment Service
 * 
 * CRÍTICO: Diseño optimizado para consultas frecuentes y escalabilidad
 * 
 * Tablas principales:
 * 1. payments - Transacciones principales
 * 2. subscriptions - Suscripciones recurrentes
 * 3. payouts - Retiros de creadores
 * 4. payment-distributions - Distribución de pagos (Bravas, agencias, modelos)
 * 5. idempotency-keys - Prevención de transacciones duplicadas
 */

export interface PaymentRecord {
  // Partition Key
  paymentId: string; // PK: payment_{timestamp}_{random}
  
  // Sort Key (para GSI)
  createdAt: string; // ISO timestamp
  
  // Identificadores
  userId: string; // Usuario que realiza el pago
  recipientId: string; // Creador/Modelo que recibe
  agencyId?: string; // Agencia (si aplica)
  
  // Información de Stripe
  stripePaymentIntentId: string; // ID de Stripe PaymentIntent
  stripeChargeId?: string; // ID de Stripe Charge
  stripeCustomerId: string; // ID de Stripe Customer
  
  // Monto y moneda
  amount: number; // Monto en centavos (ej: 1999 = $19.99)
  currency: string; // 'usd'
  platformFee: number; // Comisión de Bravas en centavos
  recipientAmount: number; // Monto que recibe el creador en centavos
  agencyFee?: number; // Comisión de agencia en centavos (si aplica)
  
  // Tipo de transacción
  type: 'subscription' | 'tip' | 'ppv' | 'one-time';
  subscriptionId?: string; // Si es parte de una suscripción
  
  // Estado
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  failureReason?: string; // Razón del fallo si status = 'failed'
  
  // Metadatos
  metadata?: {
    contentId?: string; // Para PPV
    messageId?: string; // Para tips en mensajes
    description?: string;
    [key: string]: any;
  };
  
  // Distribución de pagos
  distribution: {
    bravas: number; // Monto para Bravas
    recipient: number; // Monto para creador/modelo
    agency?: number; // Monto para agencia (si aplica)
  };
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  processedAt?: number; // Cuando se procesó exitosamente
  
  // TTL (opcional, para limpieza automática de registros antiguos)
  ttl?: number; // Unix timestamp para expiración (ej: 7 años)
}

export interface SubscriptionRecord {
  // Partition Key
  subscriptionId: string; // PK: sub_{userId}_{recipientId}
  
  // Sort Key
  createdAt: string;
  
  // Identificadores
  userId: string; // Usuario suscriptor
  recipientId: string; // Creador/Modelo
  agencyId?: string;
  
  // Información de Stripe
  stripeSubscriptionId: string; // ID de Stripe Subscription
  stripeCustomerId: string;
  stripePriceId: string; // ID del plan/precio en Stripe
  
  // Plan
  planType: 'basic' | 'premium' | 'vip';
  amount: number; // Monto mensual en centavos
  currency: string;
  
  // Estado
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: number; // Unix timestamp
  currentPeriodEnd: number; // Unix timestamp
  cancelAtPeriodEnd: boolean;
  canceledAt?: number;
  
  // Distribución
  distribution: {
    bravas: number;
    recipient: number;
    agency?: number;
  };
  
  // Auditoría
  createdAtTimestamp: number;
  updatedAtTimestamp: number;
  
  // TTL
  ttl?: number;
}

export interface PayoutRecord {
  // Partition Key
  payoutId: string; // PK: payout_{recipientId}_{timestamp}
  
  // Sort Key
  createdAt: string;
  
  // Identificadores
  recipientId: string; // Creador/Modelo que recibe
  agencyId?: string;
  
  // Información de Stripe
  stripePayoutId: string; // ID de Stripe Payout
  stripeAccountId: string; // Stripe Connect Account ID
  
  // Monto
  amount: number; // Monto en centavos
  currency: string;
  
  // Estado
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'canceled';
  failureReason?: string;
  
  // Transacciones incluidas
  paymentIds: string[]; // IDs de pagos incluidos en este retiro
  
  // Fechas
  estimatedArrivalDate?: number; // Unix timestamp
  arrivalDate?: number; // Cuando llegó realmente
  
  // Auditoría
  createdAtTimestamp: number;
  updatedAtTimestamp: number;
  
  // TTL
  ttl?: number;
}

export interface PaymentDistributionRecord {
  // Partition Key
  distributionId: string; // PK: dist_{paymentId}
  
  // Sort Key
  createdAt: string;
  
  // Referencias
  paymentId: string;
  subscriptionId?: string;
  
  // Distribución detallada
  totalAmount: number; // Monto total en centavos
  bravas: {
    amount: number;
    percentage: number; // Ej: 20 = 20%
  };
  recipient: {
    recipientId: string;
    amount: number;
    percentage: number;
  };
  agency?: {
    agencyId: string;
    amount: number;
    percentage: number;
  };
  
  // Estado
  status: 'pending' | 'distributed' | 'failed';
  distributedAt?: number;
  
  // Auditoría
  createdAtTimestamp: number;
  updatedAtTimestamp: number;
}

export interface IdempotencyKeyRecord {
  // Partition Key
  idempotencyKey: string; // Clave única de idempotencia
  
  // Respuesta cacheada
  response: {
    statusCode: number;
    body: any;
  };
  
  // Metadatos
  requestHash: string; // Hash de la request para validación
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp (24 horas)
  
  // TTL para limpieza automática
  ttl: number;
}

/**
 * Índices Globales Secundarios (GSI) necesarios:
 * 
 * GSI1: userId-createdAt-index
 * - Partition Key: userId
 * - Sort Key: createdAt
 * - Uso: Obtener historial de pagos de un usuario
 * 
 * GSI2: recipientId-createdAt-index
 * - Partition Key: recipientId
 * - Sort Key: createdAt
 * - Uso: Obtener ingresos de un creador
 * 
 * GSI3: status-createdAt-index
 * - Partition Key: status
 * - Sort Key: createdAt
 * - Uso: Procesar pagos pendientes, reportes
 * 
 * GSI4: stripePaymentIntentId-index
 * - Partition Key: stripePaymentIntentId
 * - Uso: Buscar por ID de Stripe (webhooks)
 */














