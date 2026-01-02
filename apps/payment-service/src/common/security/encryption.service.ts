import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import { AWSClientFactory } from '@bravas/shared';

/**
 * Servicio de encriptación usando AWS KMS
 * Utilizado para encriptar datos sensibles antes de almacenarlos en DynamoDB
 * 
 * CRÍTICO: Todos los datos sensibles deben estar encriptados en reposo
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private kmsClient: KMSClient;
  private readonly keyId: string;

  constructor(private configService: ConfigService) {
    this.kmsClient = AWSClientFactory.createKMSClient() as KMSClient;
    const projectName = process.env.PROJECT_NAME || 'bravas';
    this.keyId = this.configService.get<string>('KMS_KEY_ID') || 
                 this.configService.get<string>('AWS_KMS_KEY_ID') || 
                 `alias/${projectName}-payment-encryption`;
  }

  /**
   * Encripta datos sensibles usando AWS KMS
   * Retorna el texto encriptado en base64
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      const command = new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(plaintext, 'utf-8'),
      });

      const response = await this.kmsClient.send(command);
      
      if (!response.CiphertextBlob) {
        throw new Error('KMS no retornó CiphertextBlob');
      }

      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error: any) {
      this.logger.error('Error al encriptar datos', error.stack);
      throw new Error(`Error de encriptación: ${error.message}`);
    }
  }

  /**
   * Desencripta datos usando AWS KMS
   * Recibe texto encriptado en base64
   */
  async decrypt(ciphertextBase64: string): Promise<string> {
    try {
      const ciphertextBlob = Buffer.from(ciphertextBase64, 'base64');

      const command = new DecryptCommand({
        CiphertextBlob: ciphertextBlob,
      });

      const response = await this.kmsClient.send(command);
      
      if (!response.Plaintext) {
        throw new Error('KMS no retornó Plaintext');
      }

      return Buffer.from(response.Plaintext).toString('utf-8');
    } catch (error: any) {
      this.logger.error('Error al desencriptar datos', error.stack);
      throw new Error(`Error de desencriptación: ${error.message}`);
    }
  }

  /**
   * Encripta un objeto completo (útil para encriptar datos estructurados)
   */
  async encryptObject<T extends Record<string, any>>(obj: T): Promise<string> {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * Desencripta un objeto completo
   */
  async decryptObject<T extends Record<string, any>>(encryptedData: string): Promise<T> {
    const decrypted = await this.decrypt(encryptedData);
    return JSON.parse(decrypted) as T;
  }
}

