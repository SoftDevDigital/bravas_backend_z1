import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SanitizationService } from '../../services/sanitization.service';

/**
 * Interceptor para sanitizar inputs automáticamente
 * Limpia datos de entrada para prevenir XSS
 */
@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  constructor(private readonly sanitizationService: SanitizationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Sanitizar body
    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizationService.sanitizeObject(request.body);
    }

    // Sanitizar query params (solo strings)
    if (request.query) {
      for (const key in request.query) {
        if (typeof request.query[key] === 'string') {
          request.query[key] = this.sanitizationService.sanitizeString(request.query[key]);
        }
      }
    }

    // Sanitizar params (solo strings)
    if (request.params) {
      for (const key in request.params) {
        if (typeof request.params[key] === 'string') {
          request.params[key] = this.sanitizationService.sanitizeString(request.params[key]);
        }
      }
    }

    return next.handle();
  }
}























