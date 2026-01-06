import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '@nestjs/config';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: LoggerService;

  constructor(configService?: ConfigService) {
    this.logger = LoggerService.create('HttpExceptionFilter', configService);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || message;
        details = responseObj;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log del error
    if (status >= 500) {
      this.logger.error(
        `Error ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        'HttpExceptionFilter',
        {
          path: request.url,
          method: request.method,
          statusCode: status,
        },
      );
    } else {
      this.logger.warn(`Error ${status}: ${message}`, 'HttpExceptionFilter', {
        path: request.url,
        method: request.method,
        statusCode: status,
      });
    }

    // Respuesta estructurada
    const errorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && typeof details === 'object' ? details : {}),
    };

    response.status(status).json(errorResponse);
  }
}











