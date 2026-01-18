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
    console.log('🔍 [ExceptionFilter] INICIO - Excepción capturada:', {
      exceptionType: exception?.constructor?.name || 'Unknown',
      isHttpException: exception instanceof HttpException,
      isError: exception instanceof Error,
      errorMessage: (exception as Error)?.message || 'No message',
    });
    
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let details: any = null;
    
    console.log('🔍 [ExceptionFilter] Request info:', {
      path: request.path,
      method: request.method,
      headersSent: response.headersSent,
    });

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        // Manejar arrays de mensajes (típico de ValidationPipe)
        if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        } else {
          message = responseObj.message || exception.message || message;
        }
        errorCode = responseObj.errorCode || this.getErrorCode(status);
        details = responseObj.details || responseObj.errors || null;
      } else {
        // Si exceptionResponse es null o undefined, usar exception.message
        message = exception.message || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = 'UNKNOWN_ERROR';
    }

    // Asegurar que siempre haya un mensaje
    if (!message || message === 'Internal server error') {
      message = exception instanceof Error ? exception.message : 'Error desconocido';
    }

    console.log('🔍 [ExceptionFilter] Información de error procesada:', {
      status,
      message,
      errorCode,
      hasDetails: !!details,
    });

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
        message: message || 'Error desconocido',
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

    // Asegurar que siempre haya un mensaje
    if (!responseBody.error.message || responseBody.error.message === 'Internal server error') {
      if (exception instanceof Error) {
        responseBody.error.message = exception.message || 'Error desconocido';
      }
    }

    // Log antes de enviar respuesta
    this.logger.debug('Sending error response', {
      status,
      message: responseBody.error.message,
      path: request.path,
    });

    // Asegurar que la respuesta se envíe correctamente
    try {
      // Verificar si la respuesta ya fue enviada
      if (response.headersSent) {
        this.logger.warn('Respuesta ya fue enviada, no se puede enviar error', 'ExceptionFilter', {
          path: request.path,
          status,
          message,
        });
        return;
      }

      // Enviar respuesta
      console.log('🔍 [ExceptionFilter] Enviando respuesta:', {
        status,
        message: responseBody.error.message,
        responseBodyKeys: Object.keys(responseBody),
        responseBodyJSON: JSON.stringify(responseBody),
      });
      
      const responseResult = response.status(status).json(responseBody);
      
      console.log('✅ [ExceptionFilter] Respuesta enviada exitosamente:', {
        responseResult: responseResult || 'undefined',
        headersSent: response.headersSent,
        finished: (response as any).finished,
      });
      
      // Log para debugging
      this.logger.debug('Respuesta de error enviada exitosamente', 'ExceptionFilter', {
        status,
        message: responseBody.error.message,
        path: request.path,
      });
    } catch (sendError: any) {
      this.logger.error('Error al enviar respuesta de error', sendError?.stack, 'ExceptionFilter', {
        originalError: message,
        sendError: sendError?.message,
        headersSent: response.headersSent,
        finished: (response as any).finished,
        writableEnded: (response as any).writableEnded,
      });
      
      // Si la respuesta aún no fue enviada, intentar enviar respuesta mínima
      if (!response.headersSent) {
        try {
          response.status(status).json({
            success: false,
            error: {
              code: errorCode,
              message: message || 'Error al procesar solicitud',
              statusCode: status,
            },
          });
        } catch (secondError) {
          this.logger.error('Error al enviar respuesta mínima', (secondError as Error)?.stack, 'ExceptionFilter');
        }
      }
    }
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




































