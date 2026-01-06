import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Rate Limiting Middleware para Payment Service
 * Límites más estrictos debido a la naturaleza crítica de las transacciones
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly isProduction: boolean;
  private readonly rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  // Límites estrictos para endpoints de pago
  private readonly limits = {
    payment: {
      dev: { requests: 30, windowMs: 60000 }, // 30 req/min en dev
      prod: { requests: 20, windowMs: 60000 }, // 20 req/min en prod
    },
    webhook: {
      dev: { requests: 100, windowMs: 60000 }, // 100 req/min en dev
      prod: { requests: 200, windowMs: 60000 }, // 200 req/min en prod (Stripe puede enviar muchos)
    },
    subscription: {
      dev: { requests: 20, windowMs: 60000 }, // 20 req/min en dev
      prod: { requests: 10, windowMs: 60000 }, // 10 req/min en prod
    },
    withdrawal: {
      dev: { requests: 10, windowMs: 60000 }, // 10 req/min en dev
      prod: { requests: 5, windowMs: 60000 }, // 5 req/min en prod
    },
    default: {
      dev: { requests: 100, windowMs: 60000 },
      prod: { requests: 50, windowMs: 60000 },
    },
  };

  constructor(private configService: ConfigService) {
    this.isProduction = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev') === 'production';

    // Limpiar entradas expiradas cada minuto
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.rateLimitStore.entries()) {
        if (now > value.resetTime) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 60000);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const path = req.path.toLowerCase();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Determinar tipo de endpoint
    let endpointType: keyof typeof this.limits = 'default';
    if (path.includes('/webhook')) {
      endpointType = 'webhook';
    } else if (path.includes('/payment') || path.includes('/tip') || path.includes('/ppv')) {
      endpointType = 'payment';
    } else if (path.includes('/subscription')) {
      endpointType = 'subscription';
    } else if (path.includes('/withdrawal') || path.includes('/payout')) {
      endpointType = 'withdrawal';
    }

    const limit = this.limits[endpointType][this.isProduction ? 'prod' : 'dev'];
    const key = `${ip}:${endpointType}`;
    const now = Date.now();

    const current = this.rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      // Nueva ventana de tiempo
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
    } else {
      // Incrementar contador
      current.count++;
      
      if (current.count > limit.requests) {
        // Rate limit excedido
        const retryAfter = Math.ceil((current.resetTime - now) / 1000);
        res.setHeader('X-RateLimit-Limit', limit.requests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(current.resetTime).toISOString());
        res.setHeader('Retry-After', retryAfter.toString());
        
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Rate limit excedido. Máximo ${limit.requests} requests por minuto. Intenta de nuevo en ${retryAfter} segundos.`,
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Agregar headers de rate limit
    const currentData = this.rateLimitStore.get(key)!;
    res.setHeader('X-RateLimit-Limit', limit.requests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.requests - currentData.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(currentData.resetTime).toISOString());

    next();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}






















