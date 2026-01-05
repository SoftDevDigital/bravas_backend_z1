import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as path from 'path';

/**
 * Módulo de configuración que carga variables de entorno
 * Compatible con archivos .env y variables de entorno del sistema
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      // Cargar archivo .env según el ambiente
      envFilePath: [
        `.env.${process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev'}`,
        '.env',
      ],
      isGlobal: true, // Disponible en toda la aplicación
      expandVariables: true, // Permite usar ${VAR} en .env
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}

































