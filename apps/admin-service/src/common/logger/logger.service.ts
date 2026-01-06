import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService {
  private readonly logger: Logger;
  private readonly serviceName: string;

  constructor(serviceName: string, configService?: ConfigService) {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
  }

  static create(serviceName: string, configService?: ConfigService): LoggerService {
    return new LoggerService(serviceName, configService);
  }

  log(message: string, context?: string, meta?: Record<string, any>) {
    const logMessage = meta ? `${message} ${JSON.stringify(meta)}` : message;
    this.logger.log(logMessage, context);
  }

  error(message: string, trace?: string, context?: string, meta?: Record<string, any>) {
    const logMessage = meta ? `${message} ${JSON.stringify(meta)}` : message;
    this.logger.error(logMessage, trace, context);
  }

  warn(message: string, context?: string, meta?: Record<string, any>) {
    const logMessage = meta ? `${message} ${JSON.stringify(meta)}` : message;
    this.logger.warn(logMessage, context);
  }

  debug(message: string, context?: string, meta?: Record<string, any>) {
    const logMessage = meta ? `${message} ${JSON.stringify(meta)}` : message;
    this.logger.debug(logMessage, context);
  }
}









