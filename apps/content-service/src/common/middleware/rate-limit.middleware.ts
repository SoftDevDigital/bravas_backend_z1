import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Rate Limiting Middleware
 * Configuración diferente para desarrollo y producción
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly isProduction: boolean;
  private readonly rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  // Configuración de límites por tipo de endpoint
  private readonly limits = {
    public: {
      dev: { requests: 200, windowMs: 60000 },
      prod: { requests: 100, windowMs: 60000 },
    },
    authenticated: {
      dev: { requests: 500, windowMs: 60000 },
      prod: { requests: 200, windowMs: 60000 },
    },
    upload: {
      dev: { requests: 20, windowMs: 60000 },
      prod: { requests: 10, windowMs: 60000 },
    },
    admin: {
      dev: { requests: 1000, windowMs: 60000 },
      prod: { requests: 500, windowMs: 60000 },
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
    const endpointType = this.getEndpointType(req.path, req.method);
    const limit = this.limits[endpointType][this.isProduction ? 'prod' : 'dev'];

    const identifier = this.getIdentifier(req);
    const key = `${identifier}:${endpointType}`;
    const current = this.rateLimitStore.get(key) || { count: 0, resetTime: Date.now() + limit.windowMs };

    if (Date.now() > current.resetTime) {
      current.count = 0;
      current.resetTime = Date.now() + limit.windowMs;
    }

    current.count++;

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

    this.rateLimitStore.set(key, current);

    res.setHeader('X-RateLimit-Limit', limit.requests.toString());
    res.setHeader('X-RateLimit-Remaining', (limit.requests - current.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(current.resetTime).toISOString());

    next();
  }

  private getEndpointType(path: string, method: string): 'public' | 'authenticated' | 'upload' | 'admin' {
    if (path.includes('/admin')) {
      return 'admin';
    }
    if (path.includes('/upload') || method === 'POST' && (path.includes('/posts') || path.includes('/packs'))) {
      return 'upload';
    }
    return 'authenticated';
  }

  private getIdentifier(req: Request): string {
    const reqAny = req as any;
    if (reqAny.user?.userId) {
      return `user:${reqAny.user.userId}`;
    }
    if (req.headers.authorization) {
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    }
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  }

  private cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rateLimitStore.clear();
  }
}













