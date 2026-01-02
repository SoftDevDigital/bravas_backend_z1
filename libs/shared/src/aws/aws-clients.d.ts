import { CognitoIdentityProviderClient, CognitoIdentityProviderClientConfig } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { SNSClient, SNSClientConfig } from '@aws-sdk/client-sns';
import { SESClient, SESClientConfig } from '@aws-sdk/client-ses';
import { EventBridgeClient, EventBridgeClientConfig } from '@aws-sdk/client-eventbridge';
import { SecretsManagerClient, SecretsManagerClientConfig } from '@aws-sdk/client-secrets-manager';
import { KMSClient, KMSClientConfig } from '@aws-sdk/client-kms';
export declare class AWSClientFactory {
    static createCognitoClient(config?: Partial<CognitoIdentityProviderClientConfig>): CognitoIdentityProviderClient;
    static createDynamoDBClient(config?: Partial<DynamoDBClientConfig>): DynamoDBClient;
    static createDynamoDBDocumentClient(config?: Parameters<typeof DynamoDBDocumentClient.from>[1]): DynamoDBDocumentClient;
    static createS3Client(config?: Partial<S3ClientConfig>): S3Client;
    static createSNSClient(config?: Partial<SNSClientConfig>): SNSClient;
    static createSESClient(config?: Partial<SESClientConfig>): SESClient;
    static createEventBridgeClient(config?: Partial<EventBridgeClientConfig>): EventBridgeClient;
    static createSecretsManagerClient(config?: Partial<SecretsManagerClientConfig>): SecretsManagerClient;
    static createKMSClient(config?: Partial<KMSClientConfig>): KMSClient;
}
export declare function calculateSecretHash(username: string, clientId: string, clientSecret: string): string;
export declare function validateAge(birthDate: Date | string): boolean;
