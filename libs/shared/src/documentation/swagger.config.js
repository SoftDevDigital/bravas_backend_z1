"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("../config");
function setupSwagger(app, options = {}) {
    const credentials = (0, config_1.loadCredentials)();
    const environment = options.environment || process.env.ENVIRONMENT || 'dev';
    const isDev = environment === 'dev';
    const devUrl = options.apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:3000';
    const prodUrl = options.apiBaseUrl || process.env.API_BASE_URL || 'https://api.bravas.com';
    const config = new swagger_1.DocumentBuilder()
        .setTitle(options.title || 'BRAVAS API Documentation')
        .setDescription(options.description ||
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
- Los endpoints marcados como **Público** no requieren autenticación`)
        .setVersion(options.version || '1.0.0')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa el token JWT obtenido del endpoint /auth/login',
        in: 'header',
    }, 'JWT-auth')
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    const swaggerPath = options.path || '/api-docs';
    swagger_1.SwaggerModule.setup(swaggerPath, app, document, {
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
    app.getHttpAdapter().get(`/openapi.json`, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(document);
    });
    console.log(`📚 Swagger documentation available at: ${devUrl}${swaggerPath}`);
    console.log(`📄 OpenAPI JSON available at: ${devUrl}/openapi.json`);
}
//# sourceMappingURL=swagger.config.js.map