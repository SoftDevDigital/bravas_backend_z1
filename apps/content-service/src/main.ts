import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ContentModule } from './content.module';
import { ServerlessApp } from '@bravas/shared';

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
    module: ContentModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Content Service API',
      description: `
# 📚 Documentación - Content Service

## 🎯 Descripción General

El **Content Service** gestiona el contenido de la plataforma BRAVAS, incluyendo posts y packs de contenido. Proporciona endpoints para:

- ✅ Crear, editar y eliminar posts
- ✅ Crear, editar y eliminar packs de contenido
- ✅ Subir imágenes a S3
- ✅ Listar contenido (feed, perfil)
- ✅ Integración con payment-service para packs pagos

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Funcionalidades Principales

### Posts
- **Crear post**: Publicar texto e imágenes
- **Listar posts**: Ver feed o posts de un usuario
- **Editar post**: Modificar contenido de posts propios
- **Eliminar post**: Eliminar posts propios

### Packs
- **Crear pack**: Modelos pueden crear packs de contenido con precio
- **Listar packs**: Ver packs de un modelo
- **Editar pack**: Modificar packs propios
- **Eliminar pack**: Eliminar packs propios
- **Comprar pack**: Integración con payment-service

## 🚀 Características

### ✨ Funcionalidades
- Almacenamiento de imágenes en S3
- Moderación de contenido
- Estadísticas de likes y comentarios
- Integración con payment-service para ventas de packs

### ⚡ Optimización
- Índices GSI optimizados en DynamoDB
- Paginación para feeds grandes

### 🔒 Seguridad
- Validación de permisos (solo el autor puede editar/eliminar)
- Moderación de contenido
- Rate limiting
            `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
    },
  });

  const nestApp = await app.createApp();

  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3005; // Puerto 3005
    await nestApp.listen(port);
    console.log(`🚀 Content Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();













