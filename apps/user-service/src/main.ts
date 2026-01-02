import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { UserServiceModule } from './user-service.module';
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
    module: UserServiceModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS User Service API',
      description: `
# 📚 Documentación Completa - User Service

## 🎯 Descripción General

El **User Service** es el servicio central de gestión de usuarios de la plataforma BRAVAS. Proporciona endpoints para:

- ✅ Gestión de perfiles de usuarios (modelos, agencias, usuarios)
- ✅ Marketplace de modelos y agencias
- ✅ Sistema de verificación de identidad
- ✅ Gestión de avatares e imágenes
- ✅ Estadísticas y métricas
- ✅ Relaciones entre usuarios (modelos-agencia)
- ✅ Administración y moderación

## 🔐 Autenticación

La mayoría de endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Roles y Permisos

- **USER**: Usuario normal, puede ver perfiles públicos y gestionar su propio perfil
- **MODEL**: Modelo, puede ver estadísticas, compradores, postularse a agencias
- **AGENCY**: Agencia, puede gestionar modelos, proponer representación
- **ADMIN**: Administrador, acceso completo a todos los endpoints
- **SUPPORT**: Soporte, puede agregar notas a usuarios

## 🚀 Características Principales

### ✨ Automatización AWS
- Verificación automática con Textract y Rekognition
- Moderación automática de imágenes
- Procesamiento en background con Lambda
- Notificaciones automáticas con SNS/SES

### ⚡ Optimización
- Caché de resultados frecuentes
- Paginación eficiente
- Índices optimizados en DynamoDB
- Imágenes optimizadas automáticamente

### 🔒 Seguridad
- Validación de datos automática
- Rate limiting
- Permisos basados en roles
- Almacenamiento seguro en S3

## 📖 Guía de Uso

Para más detalles sobre cada endpoint, consulta la documentación completa en:
\`SWAGGER-DOCUMENTACION-COMPLETA.md\`

## 🆘 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.
      `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
    },
  });

  const nestApp = await app.createApp();
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3001; // Puerto diferente para no conflictuar con auth
    await nestApp.listen(port);
    console.log(`🚀 User Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();
