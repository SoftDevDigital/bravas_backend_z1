import { Handler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import serverless from 'serverless-http';
import { ServerlessApp } from '@bravas/shared';
import { ContentModule } from './content.module';

// Cache de la aplicación para evitar cold starts
let cachedHandler: any;

/**
 * Inicializa la aplicación NestJS para Lambda
 */
async function bootstrap() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const app = new ServerlessApp({
    module: ContentModule,
    globalPrefix: 'api/v1',
    enableCors: true,
    enableSwagger: false, // Deshabilitar Swagger en Lambda
  });

  await app.createApp();
  const expressApp = app.getExpressApp();

  cachedHandler = serverless(expressApp);
  return cachedHandler;
}

/**
 * Handler Lambda principal
 * Maneja todas las rutas del Content Service
 */
export const handler: Handler = async (
  event: APIGatewayProxyEvent,
  context: any
): Promise<APIGatewayProxyResult> => {
  const app = await bootstrap();
  return app(event, context);
};















