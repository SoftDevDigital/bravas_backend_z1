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
 * Filtro global de excepciones
 * Proporciona respuestas de error consistentes en toda la aplicación
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message || message;
        errorCode = responseObj.errorCode || this.getErrorCode(status);
        details = responseObj.details || null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = 'UNKNOWN_ERROR';
    }

    // Log error
    this.logger.error(
      `Exception caught: ${errorCode} - ${message}`,
      {
        errorCode,
        message,
        status,
        path: request.path,
        method: request.method,
        userId: (request as any).user?.userId,
        ip: request.ip,
        stack: process.env.NODE_ENV === 'development' ? (exception as Error).stack : undefined,
      },
    );

    // Construir respuesta de error
    const responseBody: any = {
      success: false,
      error: {
        code: errorCode,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.path,
      },
    };

    if (details) {
      responseBody.error.details = details;
    }

    // Solo incluir stack trace en desarrollo
    if (process.env.NODE_ENV === 'development' && exception instanceof Error && exception.stack) {
      responseBody.error.stack = exception.stack;
    }

    response.status(status).json(responseBody);
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return errorCodes[status] || 'UNKNOWN_ERROR';
  }
}




































