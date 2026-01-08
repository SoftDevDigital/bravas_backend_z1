import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { PaymentModule } from './payment.module';
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
    module: PaymentModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Payment Service API',
      description: `
# 📚 Documentación - Payment Service

## 🎯 Descripción General

El **Payment Service** gestiona todos los pagos, suscripciones y transacciones financieras de la plataforma BRAVAS. Proporciona endpoints para:

- ✅ Procesar pagos (tips, PPV, packs)
- ✅ Gestión de suscripciones (crear, cancelar, listar)
- ✅ **Historial de movimientos** (compras, suscripciones, tips)
- ✅ **Gestión de suscripciones del usuario** (ver suscripciones activas/canceladas, cancelar)
- ✅ Crear y gestionar retiros (payouts)
- ✅ Integración con Stripe Connect para marketplace

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Funcionalidades Principales

### Pagos
- **Procesar pago**: Tips, PPV (Pay-Per-View), pagos únicos
- **Ver pago específico**: Obtener detalles de un pago por ID
- **Pagos de usuario**: Listar todos los pagos de un usuario

### Historial de Movimientos (Buyers)
- **GET /payments/me/movements**: Historial completo de transacciones
- Filtros disponibles:
  - \`type=purchases\` - Solo compras (packs, PPV)
  - \`type=subscriptions\` - Solo suscripciones
  - \`type=tips\` - Solo tips enviados
  - \`type=all\` - Todas las transacciones (default)
- Paginación: \`page\` y \`limit\` parameters

### Suscripciones
- **Crear suscripción**: Suscribirse a un modelo
- **GET /payments/me/subscriptions**: Ver mis suscripciones
  - Filtros: \`status=active\`, \`status=canceled\`, \`status=all\`
- **PUT /payments/subscriptions/:id/cancel**: Cancelar suscripción activa

### Retiros (Payouts)
- **Crear retiro**: Modelos y agencias pueden solicitar retiros
- **Calcular balance disponible**: Ver monto disponible para retirar

## 🚀 Características

### ✨ Funcionalidades
- Integración completa con Stripe Connect
- Distribución automática de pagos (plataforma, creador, agencia)
- Idempotencia garantizada (previene pagos duplicados)
- Auditoría completa de todas las transacciones
- Notificaciones automáticas al procesar pagos

### ⚡ Optimización
- Índices GSI optimizados en DynamoDB
- Paginación eficiente
- Búsqueda rápida por usuario y fecha

### 🔒 Seguridad
- Validación de permisos
- Verificación de identidad con Stripe
- Manejo seguro de tokens y secretos
- Rate limiting

## 📖 Endpoints Principales

### Pagos
- \`POST /payments\` - Procesar un pago (tip, PPV, etc.)
- \`GET /payments/:paymentId\` - Ver pago específico
- \`GET /payments/user/:userId\` - Ver pagos de un usuario

### Historial de Movimientos
- \`GET /payments/me/movements\` - Historial completo con filtros

### Suscripciones
- \`POST /payments/subscriptions\` - Crear suscripción
- \`GET /payments/me/subscriptions\` - Ver mis suscripciones
- \`PUT /payments/subscriptions/:id/cancel\` - Cancelar suscripción

### Retiros
- \`POST /payments/payouts\` - Crear retiro
- \`GET /payments/creator/:recipientId/balance\` - Ver balance disponible
      `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
      apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3002}`,
    },
  });

  const nestApp = await app.createApp();
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3002;
    await nestApp.listen(port);
    console.log(`🚀 Payment Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();























