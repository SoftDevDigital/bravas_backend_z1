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
      globalPrefix: 'api/v1',
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
- ✅ **Sistema de seguimiento (Follow)** con reglas de negocio:
  - MODEL puede seguir a MODEL, USER y AGENCY
  - USER puede seguir a USER y MODEL (NO puede seguir AGENCY)
  - AGENCY puede seguir a MODEL, USER y AGENCY
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
- **ADMIN**: Administrador, acceso completo a todos los endpoints (incluye ADMIN_LEVEL_1, ADMIN_LEVEL_2, ADMIN_LEVEL_3)
- **SUPPORT**: Soporte, puede agregar notas a usuarios

### ⚙️ Normalización de Roles

**Importante**: Todas las comparaciones de roles son **case-insensitive** y normalizadas automáticamente:
- Los roles se comparan sin importar mayúsculas/minúsculas (user, USER, User son equivalentes)
- Se eliminan espacios en blanco automáticamente
- Esto garantiza compatibilidad con diferentes formatos de tokens JWT

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
- Permisos basados en roles (normalizados y case-insensitive)
- Almacenamiento seguro en S3
- Normalización automática de roles para evitar problemas de compatibilidad

## 📖 Guía de Uso

Para más detalles sobre cada endpoint, consulta la documentación completa en:
SWAGGER-DOCUMENTACION-COMPLETA.md

## 🆘 Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.
      `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
      apiBaseUrl: `http://localhost:${process.env.PORT || 3001}`,
    },
  });

  try {
    console.log('🔄 Creando aplicación NestJS...');
    const nestApp = await app.createApp();
    console.log('✅ Aplicación NestJS creada exitosamente');
    
    // Solo escuchar en desarrollo local
    if (process.env.NODE_ENV !== 'production') {
      const port = process.env.PORT || 3001; // Puerto diferente para no conflictuar con auth
      console.log(`🔌 Iniciando servidor en puerto ${port}...`);
      await nestApp.listen(port);
      console.log(`🚀 User Service running on: http://localhost:${port}/api/v1`);
      console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
    }
  } catch (error) {
    console.error('❌ Error al iniciar la aplicación:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

bootstrap();
