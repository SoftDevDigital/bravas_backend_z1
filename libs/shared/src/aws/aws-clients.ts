import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderClientConfig,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBClient,
  DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { SNSClient, SNSClientConfig } from '@aws-sdk/client-sns';
import { SESClient, SESClientConfig } from '@aws-sdk/client-ses';
import {
  EventBridgeClient,
  EventBridgeClientConfig,
} from '@aws-sdk/client-eventbridge';
import {
  SecretsManagerClient,
  SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import {
  KMSClient,
  KMSClientConfig,
} from '@aws-sdk/client-kms';
import { getAWSCredentials } from '../config/credentials.loader';

/**
 * Factory para crear clientes de AWS
 * Centraliza la creación de clientes con las credenciales correctas
 */
export class AWSClientFactory {
  /**
   * Crea un cliente de Cognito
   */
  static createCognitoClient(
    config?: Partial<CognitoIdentityProviderClientConfig>
  ): CognitoIdentityProviderClient {
    const awsConfig = getAWSCredentials();
    const client = new CognitoIdentityProviderClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
    // Asegurar que TypeScript reconozca el tipo correcto
    return client as CognitoIdentityProviderClient;
  }

  /**
   * Crea un cliente de DynamoDB
   */
  static createDynamoDBClient(
    config?: Partial<DynamoDBClientConfig>
  ): DynamoDBClient {
    const awsConfig = getAWSCredentials();
    return new DynamoDBClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
  }

  /**
   * Crea un cliente de DynamoDB Document Client
   */
  static createDynamoDBDocumentClient(
    config?: Parameters<typeof DynamoDBDocumentClient.from>[1]
  ): DynamoDBDocumentClient {
    const client = this.createDynamoDBClient();
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
      ...config,
    });
    // Asegurar que TypeScript reconozca el tipo correcto
    return docClient as DynamoDBDocumentClient;
  }

  /**
   * Crea un cliente de S3
   */
  static createS3Client(config?: Partial<S3ClientConfig>): S3Client {
    const awsConfig = getAWSCredentials();
    const client = new S3Client({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
    // Asegurar que TypeScript reconozca el tipo correcto
    return client as S3Client;
  }

  /**
   * Crea un cliente de SNS
   */
  static createSNSClient(config?: Partial<SNSClientConfig>): SNSClient {
    const awsConfig = getAWSCredentials();
    return new SNSClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
  }

  /**
   * Crea un cliente de SES
   */
  static createSESClient(config?: Partial<SESClientConfig>): SESClient {
    const awsConfig = getAWSCredentials();
    return new SESClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
  }

  /**
   * Crea un cliente de EventBridge
   */
  static createEventBridgeClient(
    config?: Partial<EventBridgeClientConfig>
  ): EventBridgeClient {
    const awsConfig = getAWSCredentials();
    return new EventBridgeClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
  }

  /**
   * Crea un cliente de Secrets Manager
   */
  static createSecretsManagerClient(
    config?: Partial<SecretsManagerClientConfig>
  ): SecretsManagerClient {
    const awsConfig = getAWSCredentials();
    return new SecretsManagerClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
  }

  /**
   * Crea un cliente de KMS
   */
  static createKMSClient(config?: Partial<KMSClientConfig>): KMSClient {
    const awsConfig = getAWSCredentials();
    return new KMSClient({
      region: awsConfig.region,
      credentials: awsConfig.credentials,
      ...config,
    });
  }
}

/**
 * Helper para calcular secret hash de Cognito
 */
export function calculateSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): string {
  const crypto = require('crypto');
  return crypto
    .createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

/**
 * Helper para validar edad (mayoría de edad)
 */
export function validateAge(birthDate: Date | string): boolean {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 >= 18;
  }
  
  return age >= 18;
}

