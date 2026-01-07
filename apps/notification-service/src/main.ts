import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './notification.module';
import { ServerlessApp } from '@bravas/shared/serverless';
import { IoAdapter } from '@nestjs/platform-socket.io';

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
    module: NotificationModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Notification Service API',
      description: `
# 📚 Documentación - Notification Service

## 🎯 Descripción General

El **Notification Service** gestiona todas las notificaciones de la plataforma BRAVAS. Proporciona endpoints para:

- ✅ Notificaciones in-app (mensajes, contratos, pagos, verificaciones, etc.)
- ✅ Listar notificaciones del usuario
- ✅ Marcar notificaciones como leídas
- ✅ Contador de notificaciones no leídas
- ✅ Filtrado por tipo y estado

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Tipos de Notificaciones

- **message**: Nuevo mensaje recibido
- **contract**: Actualización de contrato (propuesta, aceptación, etc.)
- **transfer**: Solicitud de transferencia
- **payment**: Pago recibido o procesado
- **verification**: Estado de verificación
- **general**: Notificación general
- **subscription**: Actualización de suscripción
- **content**: Nuevo contenido disponible
- **system**: Notificación del sistema

## 🚀 Características Principales

### ✨ Funcionalidades
- Notificaciones en tiempo real (preparado para integración con WebSockets)
- Paginación eficiente
- Filtrado por tipo y estado
- TTL automático (90 días por defecto)
- Integración con otros servicios para crear notificaciones automáticas

### ⚡ Optimización
- Índices GSI optimizados en DynamoDB
- Paginación eficiente
- Contador de no leídas optimizado

### 🔒 Seguridad
- Validación de acceso a notificaciones
- Verificación de permisos por usuario
- Rate limiting
      `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
      apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3006}`,
    },
  });

  const nestApp = await app.createApp();
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    // Habilitar WebSockets para desarrollo local
    nestApp.useWebSocketAdapter(new IoAdapter(nestApp));
    
    const port = process.env.PORT || 3006; // Puerto 3006 para Notification Service
    await nestApp.listen(port);
    console.log(`🚀 Notification Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
    console.log(`🔌 WebSocket Gateway: ws://localhost:${port}/notifications`);
  }
}

bootstrap();

