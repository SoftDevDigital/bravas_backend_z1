import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// Tipos de AWS Lambda
interface S3EventRecord {
  eventName: string;
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
}

interface S3Event {
  Records: S3EventRecord[];
}

import { AutomationService } from '../services/automation.service';

/**
 * Listener para eventos de S3
 * Se activa automáticamente cuando se suben archivos a S3
 * 
 * Este listener procesa:
 * - Avatares: Moderación automática
 * - Documentos de verificación: Verificación automática
 * - Contenido: Moderación automática
 */
@Injectable()
export class S3EventListener implements OnModuleInit {
  private readonly logger = new Logger(S3EventListener.name);

  constructor(private automationService: AutomationService) {}

  async onModuleInit() {
    this.logger.log('S3 Event Listener inicializado');
  }

  /**
   * Procesar evento de S3
   * Se llama automáticamente desde Lambda cuando hay un evento de S3
   */
  async handleS3Event(event: S3Event): Promise<void> {
    try {
      for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        const eventName = record.eventName;

        this.logger.log(`Procesando evento S3: ${eventName} para ${key}`);

        // Solo procesar objetos creados
        if (eventName.startsWith('ObjectCreated')) {
          await this.processS3Object(bucket, key);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error procesando evento S3: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Procesar objeto de S3 según su tipo
   */
  private async processS3Object(bucket: string, key: string): Promise<void> {
    try {
      // Determinar tipo de imagen según el path
      let imageType: 'avatar' | 'content' | 'verification';

      if (key.startsWith('avatars/')) {
        imageType = 'avatar';
      } else if (key.startsWith('verifications/')) {
        imageType = 'verification';
      } else if (key.startsWith('content/')) {
        imageType = 'content';
      } else {
        this.logger.warn(`Tipo de imagen desconocido para key: ${key}`);
        return;
      }

      // Procesar imagen automáticamente
      await this.automationService.processUploadedImage(bucket, key, imageType);

      // Si es documento de verificación, iniciar verificación automática
      if (imageType === 'verification') {
        await this.processVerificationDocument(bucket, key);
      }
    } catch (error: any) {
      this.logger.error(`Error procesando objeto S3: ${error.message}`, error.stack);
    }
  }

  /**
   * Procesar documento de verificación
   */
  private async processVerificationDocument(bucket: string, key: string): Promise<void> {
    try {
      // Extraer información del path: verifications/{userId}/{verificationId}/{file}
      const pathParts = key.split('/');
      if (pathParts.length >= 3) {
        const userId = pathParts[1];
        const verificationId = pathParts[2];
        const fileName = pathParts[3];

        // Determinar tipo de archivo
        if (fileName.includes('selfie')) {
          // Buscar documento correspondiente
          // En producción, esto se haría consultando DynamoDB
          this.logger.log(`Selfie detectado para verificación ${verificationId}`);
        } else if (fileName.includes('document')) {
          // Iniciar verificación automática cuando todos los archivos estén listos
          this.logger.log(`Documento detectado para verificación ${verificationId}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error procesando documento de verificación: ${error.message}`, error.stack);
    }
  }
}

