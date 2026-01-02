"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWSClientFactory = void 0;
exports.calculateSecretHash = calculateSecretHash;
exports.validateAge = validateAge;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_sns_1 = require("@aws-sdk/client-sns");
const client_ses_1 = require("@aws-sdk/client-ses");
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client_kms_1 = require("@aws-sdk/client-kms");
const credentials_loader_1 = require("../config/credentials.loader");
class AWSClientFactory {
    static createCognitoClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        const client = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
        return client;
    }
    static createDynamoDBClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        return new client_dynamodb_1.DynamoDBClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
    }
    static createDynamoDBDocumentClient(config) {
        const client = this.createDynamoDBClient();
        const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client, {
            marshallOptions: {
                removeUndefinedValues: true,
            },
            ...config,
        });
        return docClient;
    }
    static createS3Client(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        const client = new client_s3_1.S3Client({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
        return client;
    }
    static createSNSClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        return new client_sns_1.SNSClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
    }
    static createSESClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        return new client_ses_1.SESClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
    }
    static createEventBridgeClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        return new client_eventbridge_1.EventBridgeClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
    }
    static createSecretsManagerClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        return new client_secrets_manager_1.SecretsManagerClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
    }
    static createKMSClient(config) {
        const awsConfig = (0, credentials_loader_1.getAWSCredentials)();
        return new client_kms_1.KMSClient({
            region: awsConfig.region,
            credentials: awsConfig.credentials,
            ...config,
        });
    }
}
exports.AWSClientFactory = AWSClientFactory;
function calculateSecretHash(username, clientId, clientSecret) {
    const crypto = require('crypto');
    return crypto
        .createHmac('SHA256', clientSecret)
        .update(username + clientId)
        .digest('base64');
}
function validateAge(birthDate) {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        return age - 1 >= 18;
    }
    return age >= 18;
}
//# sourceMappingURL=aws-clients.js.map