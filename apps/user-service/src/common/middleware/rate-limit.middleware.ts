import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Rate Limiting Middleware
 * Configuración diferente para desarrollo y producción
 * 
 * En desarrollo: Límites más permisivos
 * En producción: Límites estrictos según tipo de endpoint
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly isProduction: boolean;
  private readonly rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  // Configuración de límites por tipo de endpoint
  private readonly limits = {
    public: {
      dev: { requests: 200, windowMs: 60000 }, // 200 req/min en dev
      prod: { requests: 100, windowMs: 60000 }, // 100 req/min en prod
    },
    authenticated: {
      dev: { requests: 500, windowMs: 60000 }, // 500 req/min en dev
      prod: { requests: 200, windowMs: 60000 }, // 200 req/min en prod
    },
    upload: {
      dev: { requests: 20, windowMs: 60000 }, // 20 req/min en dev
      prod: { requests: 10, windowMs: 60000 }, // 10 req/min en prod
    },
    admin: {
      dev: { requests: 1000, windowMs: 60000 }, // 1000 req/min en dev
      prod: { requests: 500, windowMs: 60000 }, // 500 req/min en prod
    },
  };

  constructor(private configService: ConfigService) {
    this.isProduction = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev') === 'production';

    // Limpiar entradas expiradas cada minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Determinar tipo de endpoint
    const endpointType = this.getEndpointType(req.path, req.method);
    const limit = this.limits[endpointType][this.isProduction ? 'prod' : 'dev'];

    // Obtener identificador único (IP o userId)
    const identifier = this.getIdentifier(req);

    // Verificar rate limit
    const key = `${identifier}:${endpointType}`;
    const current = this.rateLimitStore.get(key) || { count: 0, resetTime: Date.now() + limit.windowMs };

    // Si la ventana expiró, resetear
    if (Date.now() > current.resetTime) {
      current.count = 0;
      current.resetTime = Date.now() + limit.windowMs;
    }

    // Incrementar contador
    current.count++;

    // Verificar si excedió el límite
    if (current.count > limit.requests) {
      const retryAfter = Math.ceil((current.resetTime - Date.now()) / 1000);
      
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', limit.requests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(current.resetTime).toISOString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit excedido. Límite: ${limit.requests} requests por ${limit.windowMs / 1000} segundos. Intenta nuevamente en ${retryAfter} segundos.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Guardar estado actualizado
    this.rateLimitStore.set(key, current);

    // Agregar headers de rate limit
    res.setHeader('X-RateLimit-Limit', limit.requests.toString());
    res.setHeader('X-RateLimit-Remaining', (limit.requests - current.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(current.resetTime).toISOString());

    next();
  }

  /**
   * Determinar tipo de endpoint para aplicar límite apropiado
   */
  private getEndpointType(path: string, method: string): 'public' | 'authenticated' | 'upload' | 'admin' {
    // Endpoints de subida
    if (path.includes('/avatar') && method === 'POST') {
      return 'upload';
    }
    if (path.includes('/verification') && method === 'POST') {
      return 'upload';
    }

    // Endpoints de admin
    if (path.includes('/users/stats') || path.includes('/users/:id/approve') || path.includes('/users/:id/verify-payment')) {
      return 'admin';
    }

    // Endpoints públicos (sin autenticación)
    if (path.match(/^\/users\/models$/) || path.match(/^\/users\/agencies$/) || path.match(/^\/users\/[^\/]+$/)) {
      return 'public';
    }

    // Por defecto, endpoints autenticados
    return 'authenticated';
  }

  /**
   * Obtener identificador único para rate limiting
   */
  private getIdentifier(req: Request): string {
    // Si hay usuario autenticado, usar userId
    const reqAny = req as any;
    if (reqAny.user?.userId) {
      return `user:${reqAny.user.userId}`;
    }

    // Si hay token, intentar extraer userId
    if (req.headers.authorization) {
      // En producción, usar IP como fallback
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    }

    // Por defecto, usar IP
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  }

  /**
   * Limpiar entradas expiradas del store
   */
  private cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Limpiar recursos al destruir
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimitStore.clear();
  }
}

