import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ContractsModule } from './contracts.module';
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
    module: ContractsModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Contracts Service API',
      description: `
# 📚 Documentación - Contracts Service

## 🎯 Descripción General

El **Contracts Service** gestiona los contratos de representación entre agencias y modelos en la plataforma BRAVAS. Proporciona endpoints para:

- ✅ Crear propuestas de contrato (agencia → modelo)
- ✅ Aceptar/rechazar propuestas (modelo)
- ✅ Gestionar contratos activos
- ✅ Solicitar terminación de contratos (con 15 días de preaviso)
- ✅ Listar contratos y propuestas

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Funcionalidades Principales

### Propuestas de Contrato
- **Crear propuesta**: Las agencias pueden crear propuestas de contrato hacia modelos
- **Aceptar propuesta**: Las modelos pueden aceptar propuestas y crear contratos activos
- **Rechazar propuesta**: Las modelos pueden rechazar propuestas

### Contratos Activos
- **Listar contratos**: Ver todos los contratos activos del usuario
- **Obtener contrato**: Ver detalles de un contrato específico
- **Solicitar terminación**: Las modelos pueden solicitar terminación (15 días de preaviso)

## 🚀 Características

### ✨ Funcionalidades
- División automática de ingresos según porcentajes acordados
- Integración con payment-service para distribución de pagos
- Integración con messages-service para notificaciones
- Validación de roles (agencia/modelo)

### ⚡ Optimización
- Índices GSI optimizados en DynamoDB
- Caché de información de participantes

### 🔒 Seguridad
- Validación de acceso a contratos
- Verificación de permisos por rol
- Rate limiting
            `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
      apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3004}`,
    },
  });

  const nestApp = await app.createApp();

  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3004; // Puerto 3004
    await nestApp.listen(port);
    console.log(`🚀 Contracts Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();

