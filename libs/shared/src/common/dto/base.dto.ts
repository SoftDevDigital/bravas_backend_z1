/**
 * DTOs base para reutilizar en todos los servicios
 */

import { IsOptional, IsString, IsEmail, IsDateString, IsEnum, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO base con campos comunes
 */
export class BaseDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsDateString()
  updatedAt?: string;
}

/**
 * DTO para paginación
 */
export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * Respuesta paginada
 */
export class PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Roles de usuario en BRAVAS Platform
 * 
 * Roles principales:
 * - USER: Comprador/Usuario final
 * - MODEL: Modelo que vende contenido
 * - AGENCY: Agencia que gestiona modelos
 * 
 * Roles administrativos (con niveles):
 * - ADMIN: Administrador (niveles 1-3)
 *   - ADMIN_LEVEL_1: Admin básico
 *   - ADMIN_LEVEL_2: Admin intermedio
 *   - ADMIN_LEVEL_3: Super Admin (máximo poder)
 * 
 * Roles de soporte:
 * - SUPPORT: Soporte técnico/atención al cliente
 * - MODERATOR: Moderador de contenido y mensajes
 */
export enum UserRole {
  // Roles principales
  USER = 'user',           // Comprador/Usuario final
  MODEL = 'model',         // Modelo que vende contenido
  AGENCY = 'agency',       // Agencia que gestiona modelos
  
  // Roles administrativos (con niveles)
  ADMIN_LEVEL_1 = 'admin_level_1',   // Admin básico
  ADMIN_LEVEL_2 = 'admin_level_2',   // Admin intermedio
  ADMIN_LEVEL_3 = 'admin_level_3',   // Super Admin (máximo poder)
  
  // Roles de soporte
  SUPPORT = 'support',     // Soporte técnico/atención al cliente
  MODERATOR = 'moderator', // Moderador de contenido y mensajes
}

/**
 * Niveles de administrador
 */
export enum AdminLevel {
  LEVEL_1 = 1,  // Admin básico
  LEVEL_2 = 2,  // Admin intermedio
  LEVEL_3 = 3,  // Super Admin
}

/**
 * Helper para verificar si un rol es admin
 */
export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN_LEVEL_1 || 
         role === UserRole.ADMIN_LEVEL_2 || 
         role === UserRole.ADMIN_LEVEL_3;
}

/**
 * Helper para obtener el nivel de admin
 */
export function getAdminLevel(role: UserRole): number | null {
  switch (role) {
    case UserRole.ADMIN_LEVEL_1:
      return 1;
    case UserRole.ADMIN_LEVEL_2:
      return 2;
    case UserRole.ADMIN_LEVEL_3:
      return 3;
    default:
      return null;
  }
}

/**
 * Helper para verificar si un admin tiene nivel suficiente
 */
export function hasAdminLevel(role: UserRole, requiredLevel: number): boolean {
  const level = getAdminLevel(role);
  return level !== null && level >= requiredLevel;
}

/**
 * DTO para validar roles
 */
export class RoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}




