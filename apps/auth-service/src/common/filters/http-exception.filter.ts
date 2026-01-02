import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones HTTP
 * Proporciona respuestas de error consistentes y estructuradas
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Construir respuesta de error estructurada
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : { message: exceptionResponse }),
    };

    // Log del error
    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} Error: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `HTTP ${status} Client Error: ${exception.message}`,
        `${request.method} ${request.url}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}

/**
 * Filtro global para todas las excepciones (incluyendo las no HTTP)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Error interno del servidor';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    // Log del error
    this.logger.error(
      `Unhandled Exception: ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
      `${request.method} ${request.url}`,
    );

    response.status(status).json(errorResponse);
  }
}

