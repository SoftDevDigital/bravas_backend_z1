import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AdminServiceModule } from './admin-service.module';
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
    module: AdminServiceModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: true,
    swaggerConfig: {
      title: 'BRAVAS Admin Service API',
      description: `
# 📚 Documentación - Admin Service

## 🎯 Descripción General

El **Admin Service** proporciona funcionalidades administrativas para la gestión de la plataforma BRAVAS. Proporciona endpoints para:

- ✅ Gestión de usuarios (aprobar, suspender, banear, verificar)
- ✅ Moderación de contenido (posts, packs, stories)
- ✅ Gestión de pagos y transacciones
- ✅ Reportes y estadísticas de la plataforma
- ✅ Configuración de la plataforma
- ✅ Gestión de roles y permisos

## 🔐 Autenticación

Todos los endpoints requieren autenticación JWT y rol de administrador. Incluye el token en el header:

\`\`\`
Authorization: Bearer {jwt_token}
\`\`\`

## 📋 Funcionalidades Principales

### Gestión de Usuarios
- **Aprobar usuarios**: Aprobar manualmente usuarios pendientes de verificación
- **Suspender usuarios**: Suspender temporalmente cuentas de usuarios
- **Banear usuarios**: Banear permanentemente cuentas
- **Verificar usuarios**: Marcar usuarios como verificados
- **Listar usuarios**: Obtener listas de usuarios con filtros

### Moderación de Contenido
- **Aprobar contenido**: Aprobar posts, packs o stories pendientes
- **Rechazar contenido**: Rechazar contenido que no cumple políticas
- **Ocultar contenido**: Ocultar contenido sin eliminarlo
- **Eliminar contenido**: Eliminar contenido de la plataforma

### Gestión de Pagos
- **Ver transacciones**: Ver todas las transacciones de la plataforma
- **Reembolsos**: Procesar reembolsos manuales
- **Estadísticas de pagos**: Obtener estadísticas de ingresos

### Reportes y Estadísticas
- **Estadísticas generales**: Usuarios, contenido, pagos
- **Reportes de actividad**: Actividad diaria, semanal, mensual
- **Métricas de crecimiento**: Crecimiento de usuarios y contenido

## 🚀 Características Principales

### ✨ Funcionalidades
- Control total de la plataforma
- Integración con todos los servicios principales
- Reportes en tiempo real
- Moderación eficiente

### ⚡ Optimización
- Consultas optimizadas
- Caché de estadísticas
- Paginación eficiente

### 🔒 Seguridad
- Validación de roles de administrador
- Logs de todas las acciones administrativas
- Rate limiting estricto
      `.trim(),
      version: '1.0.0',
      path: '/api-docs',
      environment: (process.env.ENVIRONMENT as 'dev' | 'prod') || 'dev',
    },
  });

  const nestApp = await app.createApp();
  
  // Solo escuchar en desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3007; // Puerto 3007 para Admin Service
    await nestApp.listen(port);
    console.log(`🚀 Admin Service running on: http://localhost:${port}/api/v1`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  }
}

bootstrap();
