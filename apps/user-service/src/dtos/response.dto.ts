import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Información de paginación
 */
export class PaginationDto {
  @ApiProperty({ description: 'Página actual', example: 1 })
  page: number;

  @ApiProperty({ description: 'Límite de resultados por página', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total de resultados', example: 150 })
  total: number;

  @ApiProperty({ description: 'Total de páginas', example: 8 })
  totalPages: number;
}

/**
 * Respuesta estándar de la API
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({ description: 'Indica si la operación fue exitosa', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: 'Datos de la respuesta' })
  data?: T;

  @ApiPropertyOptional({ description: 'Mensaje de la respuesta', example: 'Operación exitosa' })
  message?: string;

  @ApiPropertyOptional({ description: 'Información de paginación' })
  pagination?: PaginationDto;
}

/**
 * Perfil completo de usuario
 */
export class UserProfileDto {
  @ApiProperty({ description: 'ID único del usuario', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Email del usuario', example: 'usuario@example.com' })
  email: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Juan Pérez' })
  fullName: string;

  @ApiProperty({ description: 'Rol del usuario', enum: ['USER', 'MODEL', 'AGENCY', 'ADMIN'], example: 'MODEL' })
  role: string;

  @ApiProperty({ description: 'Estado de verificación', example: true })
  verified: boolean;

  @ApiPropertyOptional({ description: 'URL del avatar', example: 'https://cdn.bravas.com/avatars/user123.jpg' })
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Biografía', example: 'Modelo profesional con 5 años de experiencia' })
  bio?: string;

  @ApiPropertyOptional({ description: 'País (código ISO)', example: 'AR' })
  country?: string;

  @ApiProperty({ description: 'Fecha de creación', example: '2024-01-15T10:30:00Z' })
  createdAt: string;

  @ApiProperty({ description: 'Fecha de última actualización', example: '2024-01-20T14:22:00Z' })
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Perfil extendido con información adicional' })
  profile?: any;
}

/**
 * Perfil de modelo (extendido)
 */
export class ModelProfileDto extends UserProfileDto {
  @ApiPropertyOptional({ description: 'Estado de verificación', example: 'verified' })
  verificationStatus?: string;

  @ApiPropertyOptional({ description: 'Reputación del modelo (0-100)', example: 85 })
  reputation?: number;

  @ApiPropertyOptional({ description: 'Total de ventas', example: 1250 })
  totalSales?: number;

  @ApiPropertyOptional({ description: 'Ganancias totales', example: 12500.50 })
  totalEarnings?: number;

  @ApiPropertyOptional({ description: 'Precio de suscripción mensual', example: 9.99 })
  subscriptionPrice?: number;
}

/**
 * Perfil de agencia (extendido)
 */
export class AgencyProfileDto extends UserProfileDto {
  @ApiPropertyOptional({ description: 'Nombre de la agencia', example: 'Model Agency Pro' })
  agencyName?: string;

  @ApiPropertyOptional({ description: 'Tipo de agencia', example: 'full_service' })
  agencyType?: string;

  @ApiPropertyOptional({ description: 'Total de modelos gestionados', example: 25 })
  totalModels?: number;

  @ApiPropertyOptional({ description: 'Modelos verificados', example: 20 })
  verifiedModels?: number;
}

/**
 * Estadísticas de usuario
 */
export class UserStatsDto {
  @ApiProperty({ description: 'Total de ventas', example: 1250 })
  totalSales: number;

  @ApiProperty({ description: 'Ganancias totales', example: 12500.50 })
  totalEarnings: number;

  @ApiProperty({ description: 'Reputación (0-100)', example: 85 })
  reputation: number;

  @ApiProperty({ description: 'Total de compradores únicos', example: 450 })
  totalBuyers: number;

  @ApiProperty({ description: 'Total de contenido publicado', example: 320 })
  totalContent: number;
}

/**
 * Estadísticas generales de la plataforma
 */
export class PlatformStatsDto {
  @ApiProperty({ description: 'Total de usuarios', example: 10000 })
  totalUsers: number;

  @ApiProperty({ description: 'Total de modelos', example: 2500 })
  totalModels: number;

  @ApiProperty({ description: 'Total de agencias', example: 150 })
  totalAgencies: number;

  @ApiProperty({ description: 'Usuarios verificados', example: 8500 })
  verifiedUsers: number;

  @ApiProperty({ description: 'Verificaciones pendientes', example: 120 })
  pendingVerifications: number;

  @ApiProperty({ description: 'Ingresos totales de la plataforma', example: 500000.00 })
  totalRevenue: number;

  @ApiProperty({ description: 'Total de transacciones', example: 50000 })
  totalTransactions: number;

  @ApiProperty({ description: 'Última actualización', example: '2024-01-20T15:30:00Z' })
  lastUpdated: string;
}

/**
 * Comprador (para modelos)
 */
export class BuyerDto {
  @ApiProperty({ description: 'ID del comprador', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ description: 'Email del comprador', example: 'comprador@example.com' })
  email: string;

  @ApiProperty({ description: 'Nombre completo', example: 'María González' })
  fullName: string;

  @ApiPropertyOptional({ description: 'URL del avatar', example: 'https://cdn.bravas.com/avatars/user456.jpg' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Fecha de primera compra', example: '2024-01-10T12:00:00Z' })
  createdAt: string;
}

/**
 * Modelo gestionado (para agencias)
 */
export class ManagedModelDto {
  @ApiProperty({ description: 'ID del modelo', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ description: 'Email del modelo', example: 'modelo@example.com' })
  email: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana Martínez' })
  fullName: string;

  @ApiPropertyOptional({ description: 'URL del avatar', example: 'https://cdn.bravas.com/avatars/model123.jpg' })
  avatarUrl?: string;

  @ApiProperty({ description: 'Estado de verificación', example: true })
  verified: boolean;

  @ApiProperty({ description: 'Reputación', example: 90 })
  reputation: number;

  @ApiProperty({ description: 'Total de ventas', example: 2500 })
  totalSales: number;

  @ApiProperty({ description: 'Fecha de incorporación', example: '2024-01-05T10:00:00Z' })
  joinedAt: string;
}

