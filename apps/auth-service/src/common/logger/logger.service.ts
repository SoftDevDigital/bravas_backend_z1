import { Injectable, LoggerService as NestLoggerService, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Logger estructurado para desarrollo y producción
 * En desarrollo: logs en consola con colores
 * En producción: logs en formato JSON para CloudWatch
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly isProduction: boolean;
  private readonly serviceName: string;
  private readonly context?: string;

  constructor(
    private configService: ConfigService,
    @Optional() context?: string,
  ) {
    this.isProduction = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev') === 'production';
    this.serviceName = process.env.SERVICE_NAME || 'auth-service';
    this.context = context;
  }

  /**
   * Log de información
   */
  log(message: string, context?: string, meta?: Record<string, any>) {
    this.writeLog('info', message, context, meta);
  }

  /**
   * Log de error
   */
  error(message: string, trace?: string, context?: string, meta?: Record<string, any>) {
    this.writeLog('error', message, context, { ...meta, trace });
  }

  /**
   * Log de advertencia
   */
  warn(message: string, context?: string, meta?: Record<string, any>) {
    this.writeLog('warn', message, context, meta);
  }

  /**
   * Log de debug (solo en desarrollo)
   */
  debug(message: string, context?: string, meta?: Record<string, any>) {
    if (!this.isProduction) {
      this.writeLog('debug', message, context, meta);
    }
  }

  /**
   * Log de verbose (solo en desarrollo)
   */
  verbose(message: string, context?: string, meta?: Record<string, any>) {
    if (!this.isProduction) {
      this.writeLog('verbose', message, context, meta);
    }
  }

  /**
   * Escribir log en formato apropiado según el entorno
   */
  private writeLog(
    level: 'info' | 'error' | 'warn' | 'debug' | 'verbose',
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    const logContext = context || this.context || 'Application';
    const timestamp = new Date().toISOString();
    const requestId = meta?.requestId || 'N/A';
    const userId = meta?.userId || meta?.email || 'N/A';

    if (this.isProduction) {
      // Producción: JSON estructurado para CloudWatch
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        service: this.serviceName,
        context: logContext,
        message,
        requestId,
        userId,
        ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
      };

      // En producción, usar console.log para que CloudWatch lo capture
      console.log(JSON.stringify(logEntry));
    } else {
      // Desarrollo: Logs legibles con colores
      const colorMap: Record<string, string> = {
        info: '\x1b[36m', // Cyan
        error: '\x1b[31m', // Red
        warn: '\x1b[33m', // Yellow
        debug: '\x1b[35m', // Magenta
        verbose: '\x1b[90m', // Gray
      };
      const reset = '\x1b[0m';
      const color = colorMap[level] || '';

      const prefix = `${color}[${level.toUpperCase()}]${reset} [${logContext}]`;
      const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

      console.log(`${prefix} ${message}${metaStr}`);
    }
  }

  /**
   * Crear logger con contexto específico
   */
  static create(context: string, configService: ConfigService): LoggerService {
    return new LoggerService(configService, context);
  }
}





















