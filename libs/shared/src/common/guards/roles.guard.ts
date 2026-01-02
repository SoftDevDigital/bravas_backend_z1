/**
 * Guards avanzados para roles y relaciones
 * Maneja permisos basados en roles y relaciones entre usuarios
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole, isAdminRole, getAdminLevel, hasAdminLevel } from '../dto/base.dto';

// Re-exportar helpers para uso externo
export { isAdminRole, getAdminLevel, hasAdminLevel };

/**
 * Guard para verificar roles específicos
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly allowedRoles: UserRole[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const userRole = user.role as UserRole;

    if (!this.allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `No tienes permisos para acceder a este recurso. Roles permitidos: ${this.allowedRoles.join(', ')}`
      );
    }

    return true;
  }
}

/**
 * Guard para verificar nivel de admin
 */
@Injectable()
export class AdminLevelGuard implements CanActivate {
  constructor(private readonly requiredLevel: number) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const userRole = user.role as UserRole;

    if (!isAdminRole(userRole)) {
      throw new ForbiddenException('Este recurso requiere permisos de administrador');
    }

    if (!hasAdminLevel(userRole, this.requiredLevel)) {
      throw new ForbiddenException(
        `Este recurso requiere nivel de admin ${this.requiredLevel} o superior`
      );
    }

    return true;
  }
}

/**
 * Guard para verificar que el usuario puede acceder a recursos de otro usuario
 * Basado en relaciones entre roles
 */
@Injectable()
export class RelationshipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const targetUserId = request.params.id || request.params.userId;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const userRole = user.role as UserRole;
    const userId = user.userId || user.id;

    // Si es el mismo usuario, siempre puede acceder
    if (userId === targetUserId) {
      return true;
    }

    // Admins pueden acceder a todo (según nivel)
    if (isAdminRole(userRole)) {
      const level = getAdminLevel(userRole);
      // Super Admin (nivel 3) puede acceder a todo
      if (level === 3) {
        return true;
      }
      // Otros admins pueden acceder según sus permisos específicos
      // Esto se puede extender según necesidades
    }

    // Support puede acceder a usuarios para ayudar
    if (userRole === UserRole.SUPPORT) {
      return true;
    }

    // Para otros casos, se debe verificar la relación específica
    // Esto se implementará en cada servicio según las relaciones
    // Por ahora, solo el mismo usuario o admin puede acceder
    throw new ForbiddenException('No tienes permisos para acceder a este recurso');
  }
}

/**
 * Decorator para usar múltiples guards
 */
export function UseRoleGuards(...guards: any[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Esto se implementará según necesidades específicas
  };
}

