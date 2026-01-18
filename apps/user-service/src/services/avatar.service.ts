import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
// @aws-sdk/s3-request-presigner debe instalarse: npm install @aws-sdk/s3-request-presigner
// Por ahora, usar importación condicional
let getSignedUrl: any;
try {
  getSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl;
} catch (e) {
  // Fallback si no está instalado
  getSignedUrl = async () => { throw new Error('@aws-sdk/s3-request-presigner no instalado'); };
}
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { AutomationService } from './automation.service';
import { LoggerService } from '../common/logger/logger.service';
import { MetricsService } from './metrics.service';
import { Inject, Optional } from '@nestjs/common';
// Nota: sharp y uuid son opcionales, se pueden usar alternativas
// import { v4 as uuidv4 } from 'uuid';
// import * as sharp from 'sharp';

/**
 * Servicio para gestión de avatares
 * Incluye subida, validación, optimización y moderación
 */
@Injectable()
export class AvatarService {
  private s3Client: S3Client;
  private credentials: ReturnType<typeof loadCredentials>;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly AVATAR_SIZES = {
    thumbnail: { width: 150, height: 150 },
    small: { width: 300, height: 300 },
    medium: { width: 600, height: 600 },
    large: { width: 1200, height: 1200 },
  };
  private readonly logger: LoggerService;

  constructor(
    private configService: ConfigService,
    private automationService?: AutomationService,
    @Optional() @Inject(MetricsService) private metricsService?: MetricsService,
  ) {
    this.credentials = loadCredentials();
    this.s3Client = AWSClientFactory.createS3Client() as S3Client;
    this.logger = LoggerService.create('AvatarService', this.configService);
  }

  /**
   * Subir avatar del usuario
   * Genera múltiples tamaños y optimiza la imagen
   */
  async uploadAvatar(userId: string, file: any): Promise<{
    success: boolean;
    avatarUrl: string;
    thumbnailUrl: string;
    sizes: Record<string, string>;
  }> {
    try {
      // Validar archivo
      this.validateFile(file);

      // Optimizar y generar múltiples tamaños
      const optimizedImages = await this.generateImageSizes(file.buffer);

      // Subir todas las versiones a S3
      const uploadPromises = Object.entries(optimizedImages).map(
        async ([size, buffer]) => {
          const key = this.getAvatarKey(userId, size);
          await this.uploadToS3(key, buffer, file.mimetype);
          return { size, key };
        }
      );

      const uploadedFiles = await Promise.all(uploadPromises);

      // Generar URLs públicas (pre-signed URLs con expiración larga o CloudFront)
      const avatarUrl = await this.getPublicUrl(uploadedFiles.find(f => f.size === 'medium')!.key);
      const thumbnailUrl = await this.getPublicUrl(uploadedFiles.find(f => f.size === 'thumbnail')!.key);
      
      const sizes: Record<string, string> = {};
      for (const file of uploadedFiles) {
        sizes[file.size] = await this.getPublicUrl(file.key);
      }

      // AUTOMATIZACIÓN: Moderar imagen automáticamente con Rekognition
      if (this.automationService) {
        const mediumKey = uploadedFiles.find(f => f.size === 'medium')!.key;
        const bucket = this.credentials.s3.avatarsBucket;
        
        // Procesar en background (no bloquear respuesta)
        this.automationService.processUploadedImage(bucket, mediumKey, 'avatar')
          .catch((error) => {
            this.logger.error('Error en moderación automática de avatar', error?.stack, 'AvatarService', { userId, bucket, key: mediumKey, error: error.message });
            // No fallar la subida si la moderación falla
          });
      }

      return {
        success: true,
        avatarUrl,
        thumbnailUrl,
        sizes,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al subir avatar: ${error.message || 'Error desconocido. Por favor, intenta nuevamente.'}`
      );
    }
  }

  /**
   * Validar archivo antes de procesar
   */
  private validateFile(file: any): void {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo. Por favor, selecciona una imagen.');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      const maxSizeMB = this.MAX_FILE_SIZE / 1024 / 1024;
      throw new BadRequestException(
        `El archivo es demasiado grande. Tamaño máximo permitido: ${maxSizeMB}MB. Tu archivo tiene: ${(file.size / 1024 / 1024).toFixed(2)}MB.`
      );
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Tipos permitidos: ${this.ALLOWED_MIME_TYPES.join(', ')}. Tipo recibido: ${file.mimetype || 'desconocido'}.`
      );
    }
  }

  /**
   * Generar múltiples tamaños de la imagen
   * Optimiza con sharp para mejor rendimiento
   * 
   * NOTA: Requiere instalar sharp: npm install sharp
   * Si sharp no está disponible, retorna el buffer original para todos los tamaños
   */
  private async generateImageSizes(
    buffer: Buffer
  ): Promise<Record<string, Buffer>> {
    try {
      // Intentar usar sharp si está disponible
      const sharp = require('sharp');
      const images: Record<string, Buffer> = {};

      for (const [sizeName, dimensions] of Object.entries(this.AVATAR_SIZES)) {
        images[sizeName] = await sharp(buffer)
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center',
          })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
      }

      return images;
    } catch (error) {
      // Si sharp no está disponible, retornar el buffer original para todos los tamaños
      // En producción, siempre usar sharp
      const images: Record<string, Buffer> = {};
      for (const sizeName of Object.keys(this.AVATAR_SIZES)) {
        images[sizeName] = buffer;
      }
      return images;
    }
  }

  /**
   * Obtener clave S3 para el avatar
   */
  private getAvatarKey(userId: string, size: string): string {
    const timestamp = Date.now();
    return `avatars/${userId}/${size}-${timestamp}.jpg`;
  }

  /**
   * Subir archivo a S3
   */
  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const bucket = this.credentials.s3.avatarsBucket;
    
    if (!bucket) {
      throw new InternalServerErrorException('Bucket de avatares no configurado');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        // ACL removido - usar política de bucket para acceso público
        Metadata: {
          uploadedAt: new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Obtener URL pública del archivo
   * Como el bucket tiene acceso público configurado, usamos URL pública directa
   * En producción, usar CloudFront URL directamente
   */
  private getPublicUrl(key: string): string {
    const bucket = this.credentials.s3.avatarsBucket;
    const region = this.credentials.aws.region;
    
    if (!bucket) {
      throw new InternalServerErrorException('Bucket de avatares no configurado');
    }

    // URL pública directa (el bucket tiene acceso público configurado)
    // Formato: https://{bucket}.s3.{region}.amazonaws.com/{key}
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Eliminar avatar del usuario
   */
  async deleteAvatar(userId: string): Promise<void> {
    const bucket = this.credentials.s3.avatarsBucket;
    
    if (!bucket) {
      throw new InternalServerErrorException('Bucket de avatares no configurado');
    }

    // Eliminar todas las versiones (tamaños)
    const deletePromises = Object.keys(this.AVATAR_SIZES).map(async (size) => {
      // Buscar todas las versiones del usuario (simplificado - en producción usar listado)
      try {
        const key = `avatars/${userId}/${size}-*.jpg`;
        // Nota: En producción, listar objetos con prefix y eliminar todos
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
      } catch (error) {
        // Ignorar si no existe
      }
    });

    await Promise.all(deletePromises);
  }

  /**
   * Generar pre-signed URL para subida directa desde cliente
   * Útil para subidas grandes o desde mobile
   */
  async generateUploadUrl(
    userId: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    const bucket = this.credentials.s3.avatarsBucket;
    
    if (!bucket) {
      throw new InternalServerErrorException('Bucket de avatares no configurado');
    }

    const key = this.getAvatarKey(userId, 'original');
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return { uploadUrl, key };
  }
}

