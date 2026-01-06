/**
 * Template de handler Lambda para servicios NestJS
 * 
 * Este archivo muestra cómo crear un handler Lambda que use NestJS
 * Copiar y adaptar para cada función Lambda
 */

import { Handler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import serverless from 'serverless-http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';

// Cache de la aplicación NestJS para evitar cold starts
let cachedApp: any;

/**
 * Inicializa la aplicación NestJS
 */
async function bootstrap() {
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  
  // Configuración global
  app.setGlobalPrefix('api');
  app.enableCors();
  
  await app.init();
  
  cachedApp = serverless(expressApp);
  return cachedApp;
}

/**
 * Handler Lambda genérico
 * 
 * @param event - Evento de API Gateway
 * @param context - Contexto de Lambda
 * @returns Respuesta de API Gateway
 */
export const handler: Handler = async (
  event: APIGatewayProxyEvent,
  context: any
): Promise<APIGatewayProxyResult> => {
  const app = await bootstrap();
  return app(event, context);
};

/**
 * Handler específico para una función
 * Útil cuando cada endpoint es una función Lambda separada
 */
export const registerUser: Handler = async (
  event: APIGatewayProxyEvent,
  context: any
): Promise<APIGatewayProxyResult> => {
  const app = await bootstrap();
  return app(event, context);
};





































