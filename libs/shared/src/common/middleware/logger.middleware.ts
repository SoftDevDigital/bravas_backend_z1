import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware para logging de requests
 * Registra todas las peticiones HTTP con información relevante
 * Incluye Request ID para trazabilidad
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // Excluir rutas de Swagger y recursos estáticos del logging
    const isSwaggerRoute = 
      req.originalUrl.startsWith('/api-docs') ||
      req.originalUrl.startsWith('/openapi.json') ||
      req.originalUrl.startsWith('/swagger-ui') ||
      req.originalUrl.startsWith('/favicon.ico');

    if (isSwaggerRoute) {
      return next();
    }

    // Generar o usar Request ID existente
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    
    // Agregar Request ID al request para uso en toda la aplicación
    (req as any).requestId = requestId;
    
    // Agregar Request ID al header de respuesta
    res.setHeader('X-Request-ID', requestId);

    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();
    const logger = this.logger; // Capturar el logger para usarlo en el closure

    // Log request con Request ID
    this.logger.log(`[${requestId}] ${method} ${originalUrl} - ${ip} - ${userAgent}`);

    // Interceptar respuesta para loggear tiempo de respuesta
    const originalSend = res.send;
    res.send = function (body: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      if (statusCode >= 400) {
        logger.error(
          `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          {
            requestId,
            method,
            url: originalUrl,
            statusCode,
            duration,
            ip,
            userId: (req as any).user?.userId,
          },
        );
      } else {
        logger.log(
          `[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
        );
      }

      return originalSend.call(this, body);
    };

    next();
  }
}


