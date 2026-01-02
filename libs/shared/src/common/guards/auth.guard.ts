/**
 * Guards de autenticación base
 * Estos guards se pueden extender en cada servicio según necesidades específicas
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard base de autenticación
 * Verifica que el request tenga un token JWT válido
 * 
 * NOTA: Este es un guard básico. Cada servicio deberá implementar
 * su propia lógica de validación de tokens (Cognito, JWT, etc.)
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Verificar que existe un token en el header
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      throw new UnauthorizedException('No se proporcionó token de autenticación');
    }

    // Extraer el token (formato: "Bearer <token>")
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new UnauthorizedException('Formato de token inválido');
    }

    // Agregar el token al request para uso posterior
    request.token = token;
    
    // La validación real del token se hará en cada servicio
    // usando el SDK de Cognito o JWT según corresponda
    return true;
  }
}

/**
 * NOTA: RolesGuard avanzado está en ./roles.guard.ts
 * Este archivo solo contiene AuthGuard básico
 */




