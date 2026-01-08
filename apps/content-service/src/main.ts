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

El **Content Service** gestiona el contenido de la plataforma BRAVAS, incluyendo posts, packs de contenido, y todas las interacciones sociales. Proporciona endpoints para:

- ✅ Crear, editar y eliminar posts
- ✅ Crear, editar y eliminar packs de contenido
- ✅ **Feed personalizado** (posts de modelos seguidos para usuarios USER)
- ✅ **Sistema de Likes** (dar/quitar like a posts, ver likes)
- ✅ **Sistema de Comentarios** (comentar en posts, ver comentarios)
- ✅ **Packs comprados** (ver historial de packs comprados)
- ✅ Subir imágenes a S3
- ✅ Listar contenido (feed global, perfil de usuario)
- ✅ Integración con payment-service para packs pagos

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Funcionalidades Principales

### Posts
- **Crear post**: Publicar texto e imágenes
- **Listar posts**: Ver feed global o posts de un usuario específico
- **Feed personalizado**: Para usuarios USER, ver posts de modelos que siguen
- **Editar post**: Modificar contenido de posts propios
- **Eliminar post**: Eliminar posts propios

### Interacciones Sociales
- **Dar Like**: \`POST /content/posts/:postId/like\`
- **Quitar Like**: \`DELETE /content/posts/:postId/like\`
- **Ver Likes**: \`GET /content/posts/:postId/likes\` (lista de usuarios que dieron like)
- **Comentar**: \`POST /content/posts/:postId/comments\`
- **Ver Comentarios**: \`GET /content/posts/:postId/comments\` (lista paginada de comentarios)

### Packs
- **Crear pack**: Modelos pueden crear packs de contenido con precio
- **Listar packs**: Ver packs de un modelo
- **Ver packs comprados**: \`GET /content/packs/purchased\` (historial para compradores)
- **Editar pack**: Modificar packs propios
- **Eliminar pack**: Eliminar packs propios
- **Comprar pack**: Integración con payment-service

### Feed Personalizado (Rol USER)
- **GET /content/feed**: Feed personalizado con posts de modelos seguidos
- Solo disponible para usuarios con rol USER
- Incluye paginación con cursor
- Si no sigues a ningún modelo, retorna feed vacío

## 🚀 Características

### ✨ Funcionalidades
- Almacenamiento de imágenes en S3
- Moderación de contenido automática
- Estadísticas en tiempo real (likes, comentarios)
- Feed personalizado basado en seguimientos
- Integración con payment-service para ventas de packs
- Paginación eficiente con cursor

### ⚡ Optimización
- Índices GSI optimizados en DynamoDB
- Paginación con cursor para feeds grandes
- Cache de estadísticas frecuentes

### 🔒 Seguridad
- Validación de permisos (solo el autor puede editar/eliminar)
- Moderación de contenido automática
- Validación de roles (feed personalizado solo para USER)
- Rate limiting

## 📖 Endpoints Principales

### Posts
- \`GET /content/posts\` - Listar posts (feed global o de usuario)
- \`GET /content/feed\` - Feed personalizado (solo USER)
- \`POST /content/posts\` - Crear nuevo post
- \`GET /content/posts/:postId\` - Ver post específico
- \`PUT /content/posts/:postId\` - Editar post
- \`DELETE /content/posts/:postId\` - Eliminar post

### Likes
- \`POST /content/posts/:postId/like\` - Dar like a un post
- \`DELETE /content/posts/:postId/like\` - Quitar like
- \`GET /content/posts/:postId/likes\` - Ver usuarios que dieron like

### Comentarios
- \`POST /content/posts/:postId/comments\` - Comentar en un post
- \`GET /content/posts/:postId/comments\` - Ver comentarios de un post

### Packs
- \`GET /content/packs\` - Listar packs (de un modelo)
- \`GET /content/packs/purchased\` - Ver packs comprados (compradores)
- \`POST /content/packs\` - Crear pack (modelos)
- \`GET /content/packs/:packId\` - Ver pack específico
- \`POST /content/packs/:packId/purchase\` - Comprar pack
            `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
      apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3005}`,
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
















