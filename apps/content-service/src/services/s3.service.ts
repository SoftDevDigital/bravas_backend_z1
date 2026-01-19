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
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (para videos)
  private readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (para imágenes)
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  private readonly ALLOWED_MIME_TYPES = [
    ...this.ALLOWED_IMAGE_TYPES,
    ...this.ALLOWED_VIDEO_TYPES,
  ];
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
   * Subir contenido de pack (imágenes y videos) a S3
   */
  async uploadPackContent(
    modelId: string,
    packId: string,
    file: Buffer,
    mimeType: string,
  ): Promise<{
    contentUrl: string;
    contentKey: string;
    type: 'image' | 'video';
  }> {
    try {
      // Validar archivo (permite imágenes y videos)
      this.validatePackContent(file, mimeType);

      const isVideo = this.ALLOWED_VIDEO_TYPES.includes(mimeType);
      const type = isVideo ? 'video' : 'image';
      const extension = this.getExtensionFromMimeType(mimeType);
      const contentKey = `packs/${modelId}/${packId}/content/${uuidv4()}.${extension}`;
      const bucket = this.credentials.s3.contentBucket;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: contentKey,
          Body: file,
          ContentType: mimeType,
          ACL: 'private',
        }),
      );

      const contentUrl = this.getPublicUrl(bucket, contentKey);

      this.logger.log('Contenido de pack subido exitosamente', 'uploadPackContent', {
        modelId,
        packId,
        contentKey,
        type,
        bucket,
      });

      return { contentUrl, contentKey, type };
    } catch (error: any) {
      this.logger.error('Error al subir contenido de pack', error?.stack, 'uploadPackContent', {
        modelId,
        packId,
        error: error.message,
      });
      throw new InternalServerErrorException(
        `Error al subir contenido: ${error.message || 'Error desconocido'}`
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
   * Validar archivo antes de subir (solo imágenes)
   */
  private validateFile(file: Buffer, mimeType: string): void {
    if (!file || file.length === 0) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (file.length > this.MAX_IMAGE_SIZE) {
      const maxSizeMB = this.MAX_IMAGE_SIZE / 1024 / 1024;
      throw new BadRequestException(
        `El archivo es demasiado grande. Tamaño máximo: ${maxSizeMB}MB`
      );
    }

    if (!this.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Tipos permitidos: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }
  }

  /**
   * Validar contenido de pack (imágenes y videos)
   */
  private validatePackContent(file: Buffer, mimeType: string): void {
    if (!file || file.length === 0) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const isVideo = this.ALLOWED_VIDEO_TYPES.includes(mimeType);
    const maxSize = isVideo ? this.MAX_FILE_SIZE : this.MAX_IMAGE_SIZE;
    const maxSizeMB = maxSize / 1024 / 1024;

    if (file.length > maxSize) {
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
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
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
















