import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../common/filters/exception.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { RequestLoggerMiddleware } from '../common/middleware/logger.middleware';
import { setupSwagger, SwaggerConfigOptions } from '../documentation';

/**
 * Opciones para crear una aplicación NestJS serverless
 */
export interface ServerlessAppOptions {
  module: any;
  globalPrefix?: string;
  enableCors?: boolean;
  enableSwagger?: boolean;
  swaggerConfig?: SwaggerConfigOptions;
  corsOrigin?: string | string[];
}

/**
 * Clase helper para crear aplicaciones NestJS optimizadas para Lambda
 * Incluye configuración común: CORS, validación, manejo de errores, etc.
 */
export class ServerlessApp {
  private app!: NestExpressApplication;
  private expressApp!: express.Application;

  constructor(private options: ServerlessAppOptions) {}

  /**
   * Crea y configura la aplicación NestJS
   */
  async createApp(): Promise<NestExpressApplication> {
    this.expressApp = express();
    const adapter = new ExpressAdapter(this.expressApp);

    this.app = await NestFactory.create<NestExpressApplication>(
      this.options.module,
      adapter,
      {
        logger: ['error', 'warn', 'log'],
      },
    );

    // Security headers
    this.app.use(helmet());

    // Compression middleware (gzip)
    this.app.use(compression({
      level: 6, // Nivel de compresión (1-9, 6 es un buen balance)
      threshold: 1024, // Solo comprimir respuestas mayores a 1KB
      filter: (req, res) => {
        // No comprimir si el cliente no lo soporta
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Usar compresión estándar
        return compression.filter(req, res);
      },
    }));

    // CORS
    if (this.options.enableCors !== false) {
      this.app.enableCors({
        origin: this.options.corsOrigin || '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
        credentials: true,
      });
    }

    // Global prefix
    if (this.options.globalPrefix) {
      this.app.setGlobalPrefix(this.options.globalPrefix);
    }

    // Global validation pipe
    this.app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global exception filter
    this.app.useGlobalFilters(new GlobalExceptionFilter());

    // Global interceptor para transformar respuestas
    this.app.useGlobalInterceptors(new TransformInterceptor());

    // Request logger middleware
    const loggerMiddleware = new RequestLoggerMiddleware();
    this.app.use(loggerMiddleware.use.bind(loggerMiddleware));

    // Swagger documentation (solo en desarrollo o si está habilitado)
    if (this.options.enableSwagger !== false) {
      const isProduction = process.env.NODE_ENV === 'production';
      // En producción, solo habilitar si está explícitamente configurado
      if (!isProduction || this.options.enableSwagger === true) {
        setupSwagger(this.app, {
          ...this.options.swaggerConfig,
          environment: isProduction ? 'prod' : 'dev',
          globalPrefix: this.options.globalPrefix, // Pasar el globalPrefix a Swagger
        });
      }
    }

    await this.app.init();
    return this.app;
  }

  /**
   * Obtiene la aplicación NestJS creada
   */
  getApp(): NestExpressApplication {
    return this.app;
  }

  /**
   * Obtiene la instancia de Express (útil para serverless-http)
   */
  getExpressApp(): express.Application {
    return this.expressApp;
  }

  /**
   * Cierra la aplicación
   */
  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }
}

