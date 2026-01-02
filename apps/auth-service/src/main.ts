import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { ServerlessApp } from '@bravas/shared/serverless';

// Cargar .env.dev antes de inicializar la app
const env = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
const envPath = path.resolve(process.cwd(), `.env.${env}`);
if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`📄 Cargando variables desde: ${envPath}`);
}

/**
 * Bootstrap para desarrollo local
 */
async function bootstrap() {
  const app = new ServerlessApp({
    module: AuthModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Auth Service API',
      description: 'Documentación completa del servicio de autenticación de BRAVAS Platform',
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
    },
  });

  const nestApp = await app.createApp();
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    await nestApp.listen(port);
    console.log(`🚀 Auth Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();
