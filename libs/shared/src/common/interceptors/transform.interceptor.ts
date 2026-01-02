import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor para transformar respuestas exitosas
 * Envuelve todas las respuestas en un formato estándar
 * Incluye Request ID para trazabilidad
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = (request as any).requestId || 'N/A';

    return next.handle().pipe(
      map((data) => {
        // Si la respuesta ya tiene el formato estándar, agregar requestId si no existe
        if (data && typeof data === 'object' && 'success' in data) {
          if (!data.requestId) {
            data.requestId = requestId;
          }
          return data;
        }

        // Envolver en formato estándar con Request ID
        return {
          success: true,
          data,
          requestId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}












