import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiting Middleware
 * Limita la cantidad de requests por IP y endpoint
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequests = 100; // 100 requests por ventana
  private readonly windowMs = 60000; // 1 minuto

  use(req: Request, res: Response, next: NextFunction) {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();
    const record = this.rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      // Nueva ventana de tiempo
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      next();
      return;
    }

    if (record.count >= this.maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Demasiadas solicitudes. Por favor, intenta más tarde.',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
    this.rateLimitMap.set(key, record);
    next();
  }
}















