import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { LoggerService } from '../common/logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Servicio para gestión de archivos en S3
 * Maneja subida y eliminación de imágenes para posts y packs
 */
@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private credentials: ReturnType<typeof loadCredentials>;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly logger: LoggerService;

  constructor(private configService: ConfigService) {
    this.credentials = loadCredentials();
    this.s3Client = AWSClientFactory.createS3Client() as S3Client;
    this.logger = LoggerService.create('S3Service', this.configService);
  }

  /**
   * Subir imagen de post a S3
   */
  async uploadPostImage(userId: string, file: Buffer, mimeType: string): Promise<{
    imageUrl: string;
    imageKey: string;
  }> {
    try {
      this.validateFile(file, mimeType);

      const imageKey = `posts/${userId}/${uuidv4()}.${this.getExtensionFromMimeType(mimeType)}`;
      const bucket = this.credentials.s3.contentBucket;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: imageKey,
          Body: file,
          ContentType: mimeType,
          ACL: 'private', // Privado por defecto, usar CloudFront o pre-signed URLs
        }),
      );

      // Generar URL pública (en producción usar CloudFront)
      const imageUrl = this.getPublicUrl(bucket, imageKey);

      this.logger.log('Imagen de post subida exitosamente', 'uploadPostImage', {
        userId,
        imageKey,
        bucket,
      });

      return { imageUrl, imageKey };
    } catch (error: any) {
      this.logger.error('Error al subir imagen de post', error?.stack, 'uploadPostImage', {
        userId,
        error: error.message,
      });
      throw new InternalServerErrorException(
        `Error al subir imagen: ${error.message || 'Error desconocido'}`
      );
    }
  }

  /**
   * Subir imagen de pack a S3
   */
  async uploadPackImage(modelId: string, file: Buffer, mimeType: string): Promise<{
    imageUrl: string;
    imageKey: string;
  }> {
    try {
      this.validateFile(file, mimeType);

      const imageKey = `packs/${modelId}/${uuidv4()}.${this.getExtensionFromMimeType(mimeType)}`;
      const bucket = this.credentials.s3.contentBucket;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: imageKey,
          Body: file,
          ContentType: mimeType,
          ACL: 'private',
        }),
      );

      const imageUrl = this.getPublicUrl(bucket, imageKey);

      this.logger.log('Imagen de pack subida exitosamente', 'uploadPackImage', {
        modelId,
        imageKey,
        bucket,
      });

      return { imageUrl, imageKey };
    } catch (error: any) {
      this.logger.error('Error al subir imagen de pack', error?.stack, 'uploadPackImage', {
        modelId,
        error: error.message,
      });
      throw new InternalServerErrorException(
        `Error al subir imagen: ${error.message || 'Error desconocido'}`
      );
    }
  }

  /**
   * Eliminar imagen de S3
   */
  async deleteImage(imageKey: string): Promise<void> {
    try {
      const bucket = this.credentials.s3.contentBucket;

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: imageKey,
        }),
      );

      this.logger.log('Imagen eliminada de S3', 'deleteImage', { imageKey, bucket });
    } catch (error: any) {
      this.logger.error('Error al eliminar imagen de S3', error?.stack, 'deleteImage', {
        imageKey,
        error: error.message,
      });
      // No lanzar error, solo loguear (puede que la imagen ya no exista)
    }
  }

  /**
   * Validar archivo antes de subir
   */
  private validateFile(file: Buffer, mimeType: string): void {
    if (!file || file.length === 0) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (file.length > this.MAX_FILE_SIZE) {
      const maxSizeMB = this.MAX_FILE_SIZE / 1024 / 1024;
      throw new BadRequestException(
        `El archivo es demasiado grande. Tamaño máximo: ${maxSizeMB}MB`
      );
    }

    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Tipos permitidos: ${this.ALLOWED_MIME_TYPES.join(', ')}`
      );
    }
  }

  /**
   * Obtener extensión desde MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    return mimeToExt[mimeType] || 'jpg';
  }

  /**
   * Generar URL pública (en producción usar CloudFront)
   */
  private getPublicUrl(bucket: string, key: string): string {
    const region = this.credentials.aws.region;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}















