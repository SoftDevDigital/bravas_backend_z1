import { Injectable, LoggerService as NestLoggerService, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Logger estructurado para Payment Service
 * Logs críticos para auditoría de transacciones financieras
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
    this.serviceName = process.env.SERVICE_NAME || 'payment-service';
    this.context = context;
  }

  /**
   * Factory method para crear logger con contexto
   */
  static create(context: string, configService: ConfigService): LoggerService {
    return new LoggerService(configService, context);
  }

  log(message: string, context?: string, meta?: Record<string, any>) {
    this.writeLog('info', message, context, meta);
  }

  error(message: string, trace?: string, context?: string, meta?: Record<string, any>) {
    this.writeLog('error', message, context, { ...meta, trace });
  }

  warn(message: string, context?: string, meta?: Record<string, any>) {
    this.writeLog('warn', message, context, meta);
  }

  debug(message: string, context?: string, meta?: Record<string, any>) {
    if (!this.isProduction) {
      this.writeLog('debug', message, context, meta);
    }
  }

  verbose(message: string, context?: string, meta?: Record<string, any>) {
    if (!this.isProduction) {
      this.writeLog('verbose', message, context, meta);
    }
  }

  /**
   * Log crítico para transacciones financieras
   * Siempre se registra, incluso en producción
   */
  logTransaction(
    transactionId: string,
    type: string,
    status: 'success' | 'failed' | 'pending',
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ) {
    this.writeLog('info', `Transaction ${status}`, 'transaction', {
      transactionId,
      type,
      status,
      amount,
      currency,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  private writeLog(
    level: 'info' | 'error' | 'warn' | 'debug' | 'verbose',
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    const logContext = context || this.context || 'PaymentService';
    const timestamp = new Date().toISOString();

    if (this.isProduction) {
      // En producción: JSON estructurado para CloudWatch
      const logEntry = {
        level: level.toUpperCase(),
        timestamp,
        service: this.serviceName,
        context: logContext,
        message,
        ...meta,
      };
      console.log(JSON.stringify(logEntry));
    } else {
      // En desarrollo: logs legibles con colores
      const metaStr = meta ? ` ${JSON.stringify(meta, null, 2)}` : '';
      const colorCode = this.getColorCode(level);
      console.log(
        `\x1b[${colorCode}m[${level.toUpperCase()}]\x1b[0m [${logContext}] ${message}${metaStr}`,
      );
    }
  }

  private getColorCode(level: string): string {
    const colors: Record<string, string> = {
      info: '36', // Cyan
      error: '31', // Red
      warn: '33', // Yellow
      debug: '90', // Gray
      verbose: '90', // Gray
    };
    return colors[level] || '0';
  }
}





















