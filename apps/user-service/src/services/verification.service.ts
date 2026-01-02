import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
// @aws-sdk/s3-request-presigner debe instalarse: npm install @aws-sdk/s3-request-presigner
let getSignedUrl: any;
try {
  getSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl;
} catch (e) {
  getSignedUrl = async () => { throw new Error('@aws-sdk/s3-request-presigner no instalado'); };
}
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { v4 as uuidv4 } from 'uuid';
import { AutomationService } from './automation.service';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Servicio de verificación de identidad
 * Maneja selfies, documentos y verificación de modelos/agencias
 */
@Injectable()
export class VerificationService {
  private dynamoClient: DynamoDBDocumentClient;
  private s3Client: S3Client;
  private credentials: ReturnType<typeof loadCredentials>;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  private readonly logger: LoggerService;

  constructor(
    private configService: ConfigService,
    private automationService?: AutomationService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient();
    this.s3Client = AWSClientFactory.createS3Client();
    this.logger = LoggerService.create('VerificationService', this.configService);
  }

  /**
   * Iniciar proceso de verificación
   * Crea registro y genera URLs pre-signed para subir documentos
   */
  async initiateVerification(userId: string, documentType: string): Promise<{
    verificationId: string;
    uploadUrls: {
      selfie: string;
      documentFront: string;
      documentBack?: string;
      selfieWithId?: string;
    };
    expiresIn: number;
  }> {
    try {
      // Verificar que el usuario existe
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        })
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      // Verificar que no tenga una verificación pendiente
      const existingVerification = await this.getPendingVerification(userId);
      if (existingVerification) {
        throw new BadRequestException(
          'Ya tienes una verificación pendiente. Espera a que sea revisada antes de iniciar una nueva verificación.'
        );
      }

      // Crear registro de verificación
      const verificationId = uuidv4();
      const verification = {
        verificationId,
        userId,
        documentType,
        status: 'pending_upload',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.credentials.dynamodb.verificationsTable,
          Item: verification,
        })
      );

      // Generar URLs pre-signed para subir documentos
      const uploadUrls = await this.generateUploadUrls(verificationId, userId);

      return {
        verificationId,
        uploadUrls,
        expiresIn: 3600, // 1 hora
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al iniciar verificación: ${error.message}`
      );
    }
  }

  /**
   * Completar verificación después de subir documentos
   */
  async completeVerification(
    userId: string,
    verificationId: string
  ): Promise<{
    success: boolean;
    message: string;
    status: string;
  }> {
    try {
      // Verificar que existe el registro
      const verificationResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.verificationsTable,
          Key: { verificationId },
        })
      );

      if (!verificationResponse.Item) {
        throw new NotFoundException('Verificación no encontrada. Verifica que el ID de verificación sea correcto.');
      }

      const verification = verificationResponse.Item;

      if (verification.userId !== userId) {
        throw new BadRequestException('No tienes permiso para acceder a esta verificación. Solo puedes completar tus propias verificaciones.');
      }

      if (verification.status !== 'pending_upload') {
        throw new BadRequestException(
          `La verificación ya está en estado: ${verification.status}`
        );
      }

      // Verificar que todos los archivos requeridos estén subidos
      const requiredFiles = ['selfie', 'documentFront'];
      const missingFiles = requiredFiles.filter(
        (file) => !verification[`${file}Url`]
      );

      if (missingFiles.length > 0) {
        throw new BadRequestException(
          `Faltan archivos requeridos: ${missingFiles.join(', ')}`
        );
      }

      // Actualizar estado a pending_review
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.verificationsTable,
          Key: { verificationId },
          UpdateExpression:
            'SET #status = :status, #updatedAt = :updatedAt, #submittedAt = :submittedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
            '#submittedAt': 'submittedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'pending_review',
            ':updatedAt': new Date().toISOString(),
            ':submittedAt': new Date().toISOString(),
          },
        })
      );

      // Actualizar estado del usuario
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression:
            'SET #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'pending_verification',
            ':updatedAt': new Date().toISOString(),
          },
        })
      );

      // AUTOMATIZACIÓN: Iniciar verificación automática con Textract y Rekognition
      if (this.automationService) {
        // Obtener URLs de los documentos subidos
        const verification = verificationResponse.Item;
        const documentFrontKey = verification.documentFrontUrl?.split('/').slice(-2).join('/');
        const selfieKey = verification.selfieUrl?.split('/').slice(-2).join('/');
        const selfieWithIdKey = verification.selfieWithIdUrl?.split('/').slice(-2).join('/');

        if (documentFrontKey && selfieKey) {
          // Procesar verificación automática en background
          this.automationService.automateDocumentVerification(
            verificationId,
            userId,
            documentFrontKey,
            selfieKey,
            selfieWithIdKey
          ).then((result) => {
            // Si la confianza es alta, aprobar automáticamente
            if (result.confidence >= 90 && result.faceMatch) {
              // Actualizar estado a approved
              this.completeVerification(userId, verificationId).catch((err) => {
                this.logger.error('Error al completar verificación automática', err?.stack, 'VerificationService', { userId, verificationId, error: err.message });
              });
            }
          }).catch((error) => {
            this.logger.error('Error en verificación automática', error?.stack, 'VerificationService', { userId, verificationId, error: error.message });
            // Continuar con revisión manual si falla
          });
        }
      }

      // Publicar evento para notificar a admins
      if (this.automationService) {
        await this.automationService.publishEvent('verification.submitted', {
          userId,
          verificationId,
        });
      }

      return {
        success: true,
        message:
          'Verificación enviada exitosamente. Será revisada automáticamente y por nuestro equipo.',
        status: 'pending_review',
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al completar verificación: ${error.message}`
      );
    }
  }

  /**
   * Obtener estado de verificación
   */
  async getVerificationStatus(userId: string): Promise<{
    status: string;
    verificationId?: string;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  }> {
    try {
      // Buscar verificación más reciente
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.verificationsTable,
          IndexName: 'userId-index', // Requiere GSI
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          ScanIndexForward: false, // Ordenar por fecha descendente
          Limit: 1,
        })
      );

      if (!response.Items || response.Items.length === 0) {
        return { status: 'not_started' };
      }

      const verification = response.Items[0];
      return {
        status: verification.status,
        verificationId: verification.verificationId,
        submittedAt: verification.submittedAt,
        reviewedAt: verification.reviewedAt,
        rejectionReason: verification.rejectionReason,
      };
    } catch (error: any) {
      // Si no existe el índice, buscar por scan (menos eficiente)
      return { status: 'not_started' };
    }
  }

  /**
   * Obtener verificación pendiente
   */
  private async getPendingVerification(userId: string): Promise<any | null> {
    try {
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.verificationsTable,
          IndexName: 'userId-status-index', // Requiere GSI compuesto
          KeyConditionExpression: 'userId = :userId AND #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':userId': userId,
            ':status': 'pending_upload',
          },
          Limit: 1,
        })
      );

      return response.Items && response.Items.length > 0
        ? response.Items[0]
        : null;
    } catch (error) {
      // Si no existe el índice, retornar null
      return null;
    }
  }

  /**
   * Generar URLs pre-signed para subir documentos
   */
  private async generateUploadUrls(
    verificationId: string,
    userId: string
  ): Promise<{
    selfie: string;
    documentFront: string;
    documentBack?: string;
    selfieWithId?: string;
  }> {
    const bucket = this.credentials.s3.verificationDocsBucket;
    
    if (!bucket) {
      throw new InternalServerErrorException(
        'Bucket de documentos de verificación no configurado'
      );
    }

    const expiresIn = 3600; // 1 hora
    const basePath = `verifications/${userId}/${verificationId}`;

    const generateUrl = async (fileName: string, contentType: string) => {
      const key = `${basePath}/${fileName}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Metadata: {
          userId,
          verificationId,
          uploadedAt: new Date().toISOString(),
        },
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    };

    const [selfie, documentFront, documentBack, selfieWithId] =
      await Promise.all([
        generateUrl('selfie.jpg', 'image/jpeg'),
        generateUrl('document-front.jpg', 'image/jpeg'),
        generateUrl('document-back.jpg', 'image/jpeg').catch(() => undefined),
        generateUrl('selfie-with-id.jpg', 'image/jpeg').catch(() => undefined),
      ]);

    return {
      selfie,
      documentFront,
      documentBack,
      selfieWithId,
    };
  }

  /**
   * Confirmar que un archivo fue subido (webhook desde S3 o callback)
   */
  async confirmFileUpload(
    verificationId: string,
    fileType: 'selfie' | 'documentFront' | 'documentBack' | 'selfieWithId',
    fileUrl: string
  ): Promise<void> {
    await this.dynamoClient.send(
      new UpdateCommand({
        TableName: this.credentials.dynamodb.verificationsTable,
        Key: { verificationId },
        UpdateExpression: `SET ${fileType}Url = :url, #updatedAt = :updatedAt`,
        ExpressionAttributeNames: {
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':url': fileUrl,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  }
}

