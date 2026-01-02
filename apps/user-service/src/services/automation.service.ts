import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  SNSClient,
  PublishCommand,
} from '@aws-sdk/client-sns';
// Rekognition y Textract - importación condicional
let RekognitionClientClass: any;
let DetectModerationLabelsCommand: any;
let DetectFacesCommand: any;
let CompareFacesCommand: any;
let TextractClientClass: any;
let AnalyzeIDCommand: any;
let DetectDocumentTextCommand: any;

try {
  const rekognition = require('@aws-sdk/client-rekognition');
  RekognitionClientClass = rekognition.RekognitionClient;
  DetectModerationLabelsCommand = rekognition.DetectModerationLabelsCommand;
  DetectFacesCommand = rekognition.DetectFacesCommand;
  CompareFacesCommand = rekognition.CompareFacesCommand;
} catch (e) {
  // Rekognition no instalado
}

try {
  const textract = require('@aws-sdk/client-textract');
  TextractClientClass = textract.TextractClient;
  AnalyzeIDCommand = textract.AnalyzeIDCommand;
  DetectDocumentTextCommand = textract.DetectDocumentTextCommand;
} catch (e) {
  // Textract no instalado
}
import { AWSClientFactory, loadCredentials } from '@bravas/shared';

/**
 * Servicio de Automatización con AWS
 * 
 * Automatiza todas las tareas manuales usando servicios de AWS:
 * - Verificación automática de documentos (Textract)
 * - Moderación automática de imágenes (Rekognition)
 * - Notificaciones automáticas (SNS/SES)
 * - Procesamiento automático de eventos (EventBridge)
 * - Actualización automática de estadísticas (DynamoDB Streams)
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private eventBridgeClient: EventBridgeClient;
  private snsClient: SNSClient;
  private rekognitionClient: any;
  private textractClient: any;
  private credentials: ReturnType<typeof loadCredentials>;

  constructor(private configService: ConfigService) {
    this.credentials = loadCredentials();
    this.eventBridgeClient = AWSClientFactory.createEventBridgeClient();
    this.snsClient = AWSClientFactory.createSNSClient();
    
    // Inicializar Rekognition si está disponible
    if (RekognitionClientClass) {
      try {
        this.rekognitionClient = new RekognitionClientClass({
          region: this.credentials.aws.region,
          credentials: {
            accessKeyId: this.credentials.aws.accessKeyId,
            secretAccessKey: this.credentials.aws.secretAccessKey,
          },
        });
      } catch (error) {
        this.logger.warn('Error inicializando Rekognition:', error);
      }
    }
    
    // Inicializar Textract si está disponible
    if (TextractClientClass) {
      try {
        this.textractClient = new TextractClientClass({
          region: this.credentials.aws.region,
          credentials: {
            accessKeyId: this.credentials.aws.accessKeyId,
            secretAccessKey: this.credentials.aws.secretAccessKey,
          },
        });
      } catch (error) {
        this.logger.warn('Error inicializando Textract:', error);
      }
    }
  }

  /**
   * Automatizar verificación de documentos
   * Usa Textract para extraer información y Rekognition para comparar selfies
   */
  /**
   * Automatizar verificación de documentos
   * Requiere: @aws-sdk/client-rekognition y @aws-sdk/client-textract
   */
  async automateDocumentVerification(
    verificationId: string,
    userId: string,
    documentS3Key: string,
    selfieS3Key: string,
    selfieWithIdS3Key?: string
  ): Promise<{
    success: boolean;
    confidence: number;
    extractedData?: any;
    faceMatch?: boolean;
    recommendations: string[];
  }> {
    try {
      if (!this.textractClient || !this.rekognitionClient) {
        throw new Error('Rekognition y Textract no están disponibles. Instalar: @aws-sdk/client-rekognition @aws-sdk/client-textract');
      }

      const bucket = this.credentials.s3.verificationDocsBucket;
      
      // 1. Extraer información del documento con Textract
      const documentAnalysis = await this.textractClient.send(
        new AnalyzeIDCommand({
          DocumentPages: [
            {
              S3Object: {
                Bucket: bucket,
                Name: documentS3Key,
              },
            },
          ],
        })
      );

      // 2. Detectar texto en el documento (fallback)
      const textDetection = await this.textractClient.send(
        new DetectDocumentTextCommand({
          Document: {
            S3Object: {
              Bucket: bucket,
              Name: documentS3Key,
            },
          },
        })
      );

      // 3. Comparar selfie con foto del documento usando Rekognition
      let faceMatch = false;
      let faceMatchConfidence = 0;

      if (selfieWithIdS3Key) {
        const faceComparison = await this.rekognitionClient.send(
          new CompareFacesCommand({
            SourceImage: {
              S3Object: {
                Bucket: bucket,
                Name: selfieS3Key,
              },
            },
            TargetImage: {
              S3Object: {
                Bucket: bucket,
                Name: selfieWithIdS3Key,
              },
            },
            SimilarityThreshold: 80,
          })
        );

        if (faceComparison.FaceMatches && faceComparison.FaceMatches.length > 0) {
          faceMatch = true;
          faceMatchConfidence = faceComparison.FaceMatches[0].Similarity || 0;
        }
      } else {
        // Comparar selfie con documento
        const selfieFaces = await this.rekognitionClient.send(
          new DetectFacesCommand({
            Image: {
              S3Object: {
                Bucket: bucket,
                Name: selfieS3Key,
              },
            },
            Attributes: ['ALL'],
          })
        );

        const documentFaces = await this.rekognitionClient.send(
          new DetectFacesCommand({
            Image: {
              S3Object: {
                Bucket: bucket,
                Name: documentS3Key,
              },
            },
            Attributes: ['ALL'],
          })
        );

        if (selfieFaces.Faces && documentFaces.Faces) {
          // Comparar caras
          const comparison = await this.rekognitionClient.send(
            new CompareFacesCommand({
              SourceImage: {
                S3Object: {
                  Bucket: bucket,
                  Name: selfieS3Key,
                },
              },
              TargetImage: {
                S3Object: {
                  Bucket: bucket,
                  Name: documentS3Key,
                },
              },
              SimilarityThreshold: 80,
            })
          );

          if (comparison.FaceMatches && comparison.FaceMatches.length > 0) {
            faceMatch = true;
            faceMatchConfidence = comparison.FaceMatches[0].Similarity || 0;
          }
        }
      }

      // 4. Extraer datos del documento
      const extractedData: any = {};
      if (documentAnalysis.IdentityDocuments && documentAnalysis.IdentityDocuments.length > 0) {
        const doc = documentAnalysis.IdentityDocuments[0];
        if (doc.DocumentIndex !== undefined && documentAnalysis.IdentityDocuments[doc.DocumentIndex]) {
          const fields = documentAnalysis.IdentityDocuments[doc.DocumentIndex].IdentityDocumentFields || [];
          fields.forEach((field) => {
            if (field.Type && field.ValueDetection) {
              extractedData[field.Type.Text] = field.ValueDetection.Text;
            }
          });
        }
      }

      // 5. Calcular confianza general
      const confidence = this.calculateVerificationConfidence(
        documentAnalysis,
        faceMatchConfidence,
        textDetection
      );

      // 6. Generar recomendaciones
      const recommendations = this.generateRecommendations(
        confidence,
        faceMatch,
        extractedData
      );

      // 7. Publicar evento con resultados
      await this.publishEvent('verification.automated', {
        verificationId,
        userId,
        confidence,
        faceMatch,
        extractedData,
        recommendations,
      });

      // 8. Si la confianza es alta, aprobar automáticamente
      if (confidence >= 90 && faceMatch) {
        await this.publishEvent('verification.auto-approved', {
          verificationId,
          userId,
          confidence,
        });
      }

      return {
        success: true,
        confidence,
        extractedData,
        faceMatch,
        recommendations,
      };
    } catch (error: any) {
      this.logger.error(`Error en verificación automática: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Automatizar moderación de imágenes
   * Usa Rekognition para detectar contenido inapropiado
   */
  /**
   * Automatizar moderación de imágenes
   * Requiere: @aws-sdk/client-rekognition
   */
  async automateImageModeration(
    imageS3Key: string,
    bucket: string,
    imageType: 'avatar' | 'content' | 'verification'
  ): Promise<{
    approved: boolean;
    moderationLabels: any[];
    confidence: number;
    reason?: string;
  }> {
    try {
      if (!this.rekognitionClient) {
        throw new Error('Rekognition no está disponible. Instalar: @aws-sdk/client-rekognition');
      }

      // Detectar contenido inapropiado
      const moderationResult = await this.rekognitionClient.send(
        new DetectModerationLabelsCommand({
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: imageS3Key,
            },
          },
          MinConfidence: 50, // Umbral de confianza
        })
      );

      const labels = moderationResult.ModerationLabels || [];
      const highConfidenceLabels = labels.filter(
        (label) => (label.Confidence || 0) >= 80
      );

      // Verificar si hay contenido inapropiado
      const inappropriateCategories = [
        'Explicit Nudity',
        'Violence',
        'Visually Disturbing',
        'Rude Gestures',
        'Drugs',
        'Tobacco',
        'Alcohol',
      ];

      const hasInappropriateContent = highConfidenceLabels.some((label) =>
        inappropriateCategories.includes(label.Name || '')
      );

      // Detectar caras para verificación
      let hasFaces = false;
      if (imageType === 'verification' || imageType === 'avatar') {
        const faceDetection = await this.rekognitionClient.send(
          new DetectFacesCommand({
            Image: {
              S3Object: {
                Bucket: bucket,
                Name: imageS3Key,
              },
            },
            Attributes: ['ALL'],
          })
        );

        hasFaces = (faceDetection.Faces?.length || 0) > 0;
      }

      const approved = !hasInappropriateContent && (imageType !== 'verification' || hasFaces);

      // Publicar evento
      await this.publishEvent('moderation.completed', {
        imageS3Key,
        bucket,
        imageType,
        approved,
        moderationLabels: labels.map((l) => ({
          name: l.Name,
          confidence: l.Confidence,
        })),
      });

      return {
        approved,
        moderationLabels: labels,
        confidence: highConfidenceLabels[0]?.Confidence || 0,
        reason: hasInappropriateContent
          ? 'Contenido inapropiado detectado'
          : imageType === 'verification' && !hasFaces
          ? 'No se detectó una cara en la imagen'
          : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Error en moderación automática: ${error.message}`, error.stack);
      // En caso de error, aprobar por defecto (revisión manual)
      return {
        approved: true,
        moderationLabels: [],
        confidence: 0,
        reason: 'Error en moderación automática, requiere revisión manual',
      };
    }
  }

  /**
   * Automatizar notificaciones
   * Usa SNS para notificaciones en tiempo real
   */
  async automateNotification(
    userId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      const topicArn = this.credentials.sns.notificationEventsTopic;
      
      if (!topicArn) {
        this.logger.warn('SNS topic no configurado, saltando notificación');
        return;
      }

      await this.snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify({
            userId,
            type,
            data,
            timestamp: new Date().toISOString(),
          }),
          MessageAttributes: {
            type: {
              DataType: 'String',
              StringValue: type,
            },
            userId: {
              DataType: 'String',
              StringValue: userId,
            },
          },
        })
      );

      this.logger.log(`Notificación automática enviada: ${type} para usuario ${userId}`);
    } catch (error: any) {
      this.logger.error(`Error enviando notificación: ${error.message}`, error.stack);
    }
  }

  /**
   * Publicar evento en EventBridge
   * Automatiza workflows basados en eventos
   */
  async publishEvent(
    eventType: string,
    detail: any
  ): Promise<void> {
    try {
      const eventBusName = this.credentials.eventbridge.eventBusName || 'default';
      
      await this.eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: 'bravas.user-service',
              DetailType: eventType,
              Detail: JSON.stringify(detail),
              EventBusName: eventBusName !== 'default' ? eventBusName : undefined,
            },
          ],
        })
      );

      this.logger.log(`Evento publicado: ${eventType}`);
    } catch (error: any) {
      this.logger.error(`Error publicando evento: ${error.message}`, error.stack);
    }
  }

  /**
   * Calcular confianza de verificación
   */
  private calculateVerificationConfidence(
    documentAnalysis: any,
    faceMatchConfidence: number,
    textDetection: any
  ): number {
    let confidence = 0;

    // Confianza por extracción de datos del documento (40%)
    if (documentAnalysis.IdentityDocuments && documentAnalysis.IdentityDocuments.length > 0) {
      confidence += 40;
    }

    // Confianza por detección de texto (20%)
    if (textDetection.Blocks && textDetection.Blocks.length > 0) {
      confidence += 20;
    }

    // Confianza por coincidencia de caras (40%)
    if (faceMatchConfidence > 0) {
      confidence += (faceMatchConfidence / 100) * 40;
    }

    return Math.min(100, Math.round(confidence));
  }

  /**
   * Generar recomendaciones basadas en análisis
   */
  private generateRecommendations(
    confidence: number,
    faceMatch: boolean,
    extractedData: any
  ): string[] {
    const recommendations: string[] = [];

    if (confidence < 70) {
      recommendations.push('La confianza de verificación es baja, se requiere revisión manual');
    }

    if (!faceMatch) {
      recommendations.push('No se pudo verificar la coincidencia de caras');
    }

    if (!extractedData || Object.keys(extractedData).length === 0) {
      recommendations.push('No se pudieron extraer datos del documento');
    }

    if (confidence >= 90 && faceMatch) {
      recommendations.push('Verificación automática exitosa, puede ser aprobada automáticamente');
    }

    return recommendations;
  }

  /**
   * Automatizar procesamiento de imágenes subidas
   * Se activa automáticamente cuando se sube una imagen a S3
   */
  async processUploadedImage(
    bucket: string,
    key: string,
    imageType: 'avatar' | 'content' | 'verification'
  ): Promise<void> {
    try {
      // 1. Moderar imagen automáticamente
      const moderationResult = await this.automateImageModeration(
        key,
        bucket,
        imageType
      );

      // 2. Si no está aprobada, notificar y bloquear
      if (!moderationResult.approved) {
        await this.publishEvent('image.rejected', {
          bucket,
          key,
          imageType,
          reason: moderationResult.reason,
          moderationLabels: moderationResult.moderationLabels,
        });

        // Notificar al usuario
        const userId = this.extractUserIdFromKey(key);
        if (userId) {
          await this.automateNotification(userId, 'image_rejected', {
            reason: moderationResult.reason,
            imageType,
          });
        }
      } else {
        // 3. Si está aprobada, publicar evento de aprobación
        await this.publishEvent('image.approved', {
          bucket,
          key,
          imageType,
        });
      }
    } catch (error: any) {
      this.logger.error(`Error procesando imagen: ${error.message}`, error.stack);
    }
  }

  /**
   * Extraer userId de la key de S3
   */
  private extractUserIdFromKey(key: string): string | null {
    // Formato esperado: avatars/{userId}/... o verifications/{userId}/...
    const match = key.match(/\/([^\/]+)\//);
    return match ? match[1] : null;
  }
}

