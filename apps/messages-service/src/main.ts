import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { MessagesModule } from './messages.module';
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
    module: MessagesModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Messages Service API',
      description: `
# 📚 Documentación - Messages Service

## 🎯 Descripción General

El **Messages Service** gestiona toda la comunicación entre usuarios de la plataforma BRAVAS. Proporciona endpoints para:

- ✅ Chats entre usuarios (buyer-model, agency-model, agency-agency)
- ✅ Mensajes de texto
- ✅ Imágenes pagadas (paid_image)
- ✅ Contratos de representación (contract_pdf, contract_proposal)
- ✅ Solicitudes de transferencia (agency_transfer_request, model_transfer_proposal)
- ✅ Notificaciones de mensajes no leídos

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Tipos de Mensajes

- **text**: Mensaje de texto simple
- **paid_image**: Imagen pagada (requiere integración con payment-service)
- **contract_pdf**: Contrato PDF de representación
- **contract_proposal**: Propuesta de contrato
- **agency_transfer_request**: Solicitud de transferencia entre agencias
- **model_transfer_proposal**: Propuesta de transferencia a modelo

## 🚀 Características Principales

### ✨ Funcionalidades
- Chats automáticos entre usuarios
- Contadores de mensajes no leídos
- Paginación eficiente (cursor-based)
- Soporte para múltiples tipos de mensajes
- Integración con payment-service para imágenes pagadas

### ⚡ Optimización
- Índices GSI optimizados en DynamoDB
- Paginación cursor-based para mejor rendimiento
- Caché de información de participantes

### 🔒 Seguridad
- Validación de acceso a chats
- Verificación de permisos por usuario
- Rate limiting (pendiente de implementar)
      `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
    },
  });

  const nestApp = await app.createApp();
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3003; // Puerto 3003 para Messages Service
    await nestApp.listen(port);
    console.log(`🚀 Messages Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();

