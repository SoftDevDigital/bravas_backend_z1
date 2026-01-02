import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../../services/metrics.service';

/**
 * Interceptor para registrar métricas automáticamente
 * Registra latencia, errores y tamaño de respuestas
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, path, route } = request;
    
    // Obtener endpoint limpio (sin parámetros)
    const endpoint = route?.path || path || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        // Registrar latencia
        const latency = Date.now() - startTime;
        this.metricsService.recordLatency(endpoint, method, latency).catch(() => {
          // Ignorar errores de métricas para no afectar la respuesta
        });

        // Registrar tamaño de respuesta (aproximado)
        if (data) {
          const sizeBytes = JSON.stringify(data).length;
          this.metricsService.recordResponseSize(endpoint, sizeBytes).catch(() => {
            // Ignorar errores de métricas
          });
        }
      }),
      catchError((error) => {
        // Registrar error
        const errorCode = error?.status || error?.code || 'UNKNOWN';
        this.metricsService.recordError(endpoint, method, String(errorCode)).catch(() => {
          // Ignorar errores de métricas
        });

        // Registrar latencia incluso en caso de error
        const latency = Date.now() - startTime;
        this.metricsService.recordLatency(endpoint, method, latency).catch(() => {
          // Ignorar errores de métricas
        });

        return throwError(() => error);
      }),
    );
  }
}














