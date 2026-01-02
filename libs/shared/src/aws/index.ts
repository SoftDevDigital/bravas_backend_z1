/**
 * AWS Clients y Helpers
 * Exporta todos los clientes y utilidades de AWS
 */

// Exportar tipos de AWS SDK para que TypeScript los resuelva correctamente
export type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
export type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
export type { S3Client } from '@aws-sdk/client-s3';
export type { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
export type { SNSClient } from '@aws-sdk/client-sns';
export type { SESClient } from '@aws-sdk/client-ses';
export type { EventBridgeClient } from '@aws-sdk/client-eventbridge';
export type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Exportar clientes y helpers
export * from './aws-clients';












