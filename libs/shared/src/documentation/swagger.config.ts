import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { loadCredentials } from '../config';

/**
 * Configuración de Swagger/Scalar para documentación de API
 * Soporta desarrollo y producción
 */
export interface SwaggerConfigOptions {
  title?: string;
  description?: string;
  version?: string;
  path?: string;
  environment?: 'dev' | 'prod';
  apiBaseUrl?: string;
  globalPrefix?: string; // Prefijo global de la API (ej: 'api/v1')
}

/**
 * Configura y genera la documentación Swagger/OpenAPI
 * Compatible con Scalar API Reference
 */
export function setupSwagger(
  app: INestApplication,
  options: SwaggerConfigOptions = {},
): void {
  const credentials = loadCredentials();
  const environment = options.environment || process.env.ENVIRONMENT || 'dev';
  const isDev = environment === 'dev';

  // Obtener el global prefix (de las opciones o de la aplicación)
  const globalPrefix = options.globalPrefix || 
                            (app as any).config?.getGlobalPrefix?.() || 
                            process.env.GLOBAL_PREFIX || 
                            'api/v1';

  // Detectar el puerto del servicio desde la aplicación o variables de entorno
  const servicePort = process.env.PORT || 
                      (app as any).getHttpServer?.()?.address?.()?.port ||
                      '3000';
  
  // URLs base según el entorno (usar el puerto del servicio si no se especifica apiBaseUrl)
  const baseDevUrl = options.apiBaseUrl || 
                     process.env.API_BASE_URL || 
                     `http://localhost:${servicePort}`;
  const baseProdUrl = options.apiBaseUrl || 
                     process.env.API_BASE_URL || 
                     'https://api.bravas.com';
  
  // Construir URLs completas con el prefijo global para los servidores
  // Esto asegura que Swagger apunte a las rutas correctas
  const devUrl = globalPrefix ? `${baseDevUrl}/${globalPrefix}` : baseDevUrl;
  const prodUrl = globalPrefix ? `${baseProdUrl}/${globalPrefix}` : baseProdUrl;

  const config = new DocumentBuilder()
    .setTitle(options.title || 'BRAVAS API Documentation')
    .setDescription(
      options.description ||
        `Documentación completa de la API de BRAVAS Platform.
        
## Entornos Disponibles

- **Desarrollo**: ${devUrl}
- **Producción**: ${prodUrl}

## Autenticación

La mayoría de los endpoints requieren autenticación mediante JWT Bearer Token.
Incluye el token en el header \`Authorization: Bearer <token>\`

## Códigos de Estado

- \`200\` - Éxito
- \`201\` - Creado exitosamente
- \`400\` - Solicitud inválida
- \`401\` - No autenticado
- \`403\` - No autorizado
- \`404\` - No encontrado
- \`409\` - Conflicto (ej: email ya registrado)
- \`500\` - Error interno del servidor

## Notas

- Todos los timestamps están en formato ISO 8601
- Las fechas de nacimiento deben ser en formato YYYY-MM-DD
- Los IDs son UUIDs v4
- Los endpoints marcados como **Público** no requieren autenticación`,
    )
    .setVersion(options.version || '1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa el token JWT obtenido del endpoint /auth/login',
        in: 'header',
      },
      'JWT-auth', // Este nombre se usará en los decoradores @ApiBearerAuth
    )
    .addServer(devUrl, 'Entorno de Desarrollo')
    .addServer(prodUrl, 'Entorno de Producción')
    .addTag('auth', 'Endpoints de autenticación y autorización')
    .addTag('users', 'Gestión de usuarios y perfiles')
    .addTag('content', 'Gestión de contenido (posts, PPV, stories)')
    .addTag('payments', 'Procesamiento de pagos y suscripciones')
    .addTag('admin', 'Endpoints de administración')
    .addTag('notifications', 'Sistema de notificaciones')
    .addTag('analytics', 'Métricas y estadísticas')
    .addTag('courses', 'Cursos de Bravas')
    .setContact('BRAVAS Support', 'https://bravas.com/support', 'support@bravas.com')
    .setLicense('Proprietary', 'https://bravas.com/license')
    .build();

  // Crear documento de Swagger ignorando el globalPrefix para que esté disponible en /api-docs
  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });

  // Configurar Swagger UI con Scalar
  // El path debe ser absoluto (empezar con /) para que no se agregue el globalPrefix
  const swaggerPath = options.path || '/api-docs';
  
  // SwaggerModule.setup() con path absoluto e ignoreGlobalPrefix debería funcionar correctamente
  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: 'BRAVAS API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
      requestSnippetsEnabled: true,
      requestSnippets: {
        generators: {
          curl_bash: {
            title: 'cURL (bash)',
          },
          curl_powershell: {
            title: 'cURL (PowerShell)',
          },
          javascript_fetch: {
            title: 'JavaScript (fetch)',
          },
          node_native: {
            title: 'Node.js (native)',
          },
        },
        defaultExpanded: true,
      },
    },
  });

  // También exponer el JSON de OpenAPI para Scalar
  app.getHttpAdapter().get(`/openapi.json`, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });

  console.log(`📚 Swagger documentation available at: ${baseDevUrl}${swaggerPath}`);
  console.log(`📄 OpenAPI JSON available at: ${baseDevUrl}/openapi.json`);
}

