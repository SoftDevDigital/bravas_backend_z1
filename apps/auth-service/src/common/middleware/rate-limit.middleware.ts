import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Rate Limiting Middleware para Auth Service
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

  // Configuración de límites por tipo de endpoint (más estrictos para auth)
  private readonly limits = {
    register: {
      dev: { requests: 10, windowMs: 60000 }, // 10 req/min en dev (prevenir spam de registros)
      prod: { requests: 5, windowMs: 60000 }, // 5 req/min en prod
    },
    login: {
      dev: { requests: 20, windowMs: 60000 }, // 20 req/min en dev (prevenir brute force)
      prod: { requests: 10, windowMs: 60000 }, // 10 req/min en prod
    },
    otp: {
      dev: { requests: 5, windowMs: 60000 }, // 5 req/min en dev (resend-otp ya tiene rate limiting interno)
      prod: { requests: 3, windowMs: 60000 }, // 3 req/min en prod
    },
    refresh: {
      dev: { requests: 30, windowMs: 60000 }, // 30 req/min en dev
      prod: { requests: 20, windowMs: 60000 }, // 20 req/min en prod
    },
    authenticated: {
      dev: { requests: 200, windowMs: 60000 }, // 200 req/min en dev
      prod: { requests: 100, windowMs: 60000 }, // 100 req/min en prod
    },
    public: {
      dev: { requests: 100, windowMs: 60000 }, // 100 req/min en dev
      prod: { requests: 50, windowMs: 60000 }, // 50 req/min en prod
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
  private getEndpointType(path: string, method: string): 'register' | 'login' | 'otp' | 'refresh' | 'authenticated' | 'public' {
    // Endpoints de registro (más estrictos para prevenir spam)
    if (path.includes('/register') && method === 'POST') {
      return 'register';
    }

    // Endpoints de login (proteger contra brute force)
    if (path.includes('/login') && method === 'POST') {
      return 'login';
    }

    // Endpoints de OTP (verify-otp, resend-otp)
    if (path.includes('/verify-otp') || path.includes('/resend-otp')) {
      return 'otp';
    }

    // Endpoints de refresh token
    if (path.includes('/refresh') && method === 'POST') {
      return 'refresh';
    }

    // Endpoints autenticados (GET /auth/me, GET /auth/sessions, etc.)
    if (path.includes('/auth/me') || path.includes('/auth/sessions')) {
      return 'authenticated';
    }

    // Por defecto, endpoints públicos
    return 'public';
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

    // Si hay email en el body (para login/register), usar email
    if (req.body?.email) {
      return `email:${req.body.email}`;
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















