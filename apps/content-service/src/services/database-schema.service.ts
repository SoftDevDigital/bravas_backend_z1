/**
 * Esquema de Base de Datos DynamoDB para Content Service
 * 
 * Tablas principales:
 * 1. posts - Publicaciones de usuarios (texto e imágenes)
 * 2. packs - Packs de contenido de modelos
 */

export interface PostRecord {
  // Partition Key
  postId: string; // PK: post_{userId}_{timestamp}
  
  // Sort Key (para GSI)
  createdAt: string; // ISO timestamp
  
  // Autor
  userId: string; // ID del usuario que creó el post
  userRole: 'buyer' | 'model' | 'agency'; // Rol del autor
  
  // Información enriquecida del autor (se obtiene de user-service)
  authorName?: string; // Nombre del autor
  authorUsername?: string; // Username del autor
  authorAvatar?: string; // Avatar del autor
  
  // Contenido
  description?: string; // Texto del post
  imageUrl?: string; // URL de la imagen en S3
  imageKey?: string; // Key de la imagen en S3 (para eliminación)
  
  // Estadísticas
  likesCount: number; // Número de likes
  commentsCount: number; // Número de comentarios
  
  // Estado
  status: 'active' | 'deleted' | 'hidden'; // Estado del post
  
  // Moderación
  moderated?: boolean; // Si fue moderado
  moderationStatus?: 'approved' | 'rejected' | 'pending'; // Estado de moderación
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  
  // TTL (opcional, para limpieza automática de posts eliminados)
  ttl?: number; // Unix timestamp para expiración
}

export interface PackRecord {
  // Partition Key
  packId: string; // PK: pack_{modelId}_{timestamp}
  
  // Sort Key (para GSI)
  createdAt: string; // ISO timestamp
  
  // Propietario
  modelId: string; // ID del modelo que creó el pack
  
  // Información enriquecida del modelo (se obtiene de user-service)
  modelName?: string; // Nombre del modelo
  modelUsername?: string; // Username del modelo
  modelAvatar?: string; // Avatar del modelo
  
  // Información del pack
  name: string; // Nombre del pack
  description?: string; // Descripción del pack
  price: number; // Precio en centavos (ej: 3500 = $35.00)
  
  // Contenido
  imageUrl: string; // URL de la imagen de portada en S3
  imageKey: string; // Key de la imagen en S3 (para eliminación)
  contentUrls?: string[]; // URLs de las imágenes/videos del pack en S3
  contentKeys?: string[]; // Keys del contenido en S3 (para eliminación)
  
  // Estadísticas
  salesCount: number; // Número de ventas
  totalRevenue: number; // Ingresos totales en centavos
  
  // Estado
  status: 'active' | 'deleted' | 'hidden'; // Estado del pack
  
  // Moderación
  moderated?: boolean; // Si fue moderado
  moderationStatus?: 'approved' | 'rejected' | 'pending'; // Estado de moderación
  
  // Auditoría
  createdAtTimestamp: number; // Unix timestamp
  updatedAtTimestamp: number;
  
  // TTL (opcional, para limpieza automática de packs eliminados)
  ttl?: number; // Unix timestamp para expiración
}

/**
 * Helper para generar postId
 */
export function generatePostId(userId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `post_${userId}_${ts}`;
}

/**
 * Helper para generar packId
 */
export function generatePackId(modelId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `pack_${modelId}_${ts}`;
}

/**
 * Esquema para likes de posts
 */
export interface PostLikeRecord {
  // Partition Key
  postId: string;
  
  // Sort Key
  userId: string; // ID del usuario que dio like
  
  // Metadatos
  createdAt: string; // ISO timestamp
  createdAtTimestamp: number; // Unix timestamp
}

/**
 * Esquema para comentarios de posts
 */
export interface PostCommentRecord {
  // Partition Key
  commentId: string; // PK: comment_{postId}_{timestamp}
  
  // Sort Key (para GSI)
  postId: string;
  createdAt: string; // ISO timestamp
  
  // Autor
  userId: string; // ID del usuario que comentó
  userRole: 'buyer' | 'model' | 'agency';
  
  // Información enriquecida del autor
  authorName?: string;
  authorAvatar?: string;
  
  // Contenido
  content: string; // Texto del comentario
  
  // Estado
  status: 'active' | 'deleted' | 'hidden';
  
  // Auditoría
  createdAtTimestamp: number;
  updatedAtTimestamp: number;
}

/**
 * Helper para generar commentId
 */
export function generateCommentId(postId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `comment_${postId}_${ts}`;
}


