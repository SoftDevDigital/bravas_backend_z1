"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCredentials = loadCredentials;
exports.getCredentials = getCredentials;
exports.getAWSCredentials = getAWSCredentials;
exports.getDynamoDBConfig = getDynamoDBConfig;
exports.getS3Config = getS3Config;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
function loadEnvFile() {
    const env = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
    const possiblePaths = [
        path.resolve(process.cwd(), `.env.${env}`),
        path.resolve(__dirname, '../../../..', `.env.${env}`),
        path.resolve(__dirname, '../../../../..', `.env.${env}`),
    ];
    for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            return;
        }
    }
    const defaultPaths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '../../../..', '.env'),
    ];
    for (const envPath of defaultPaths) {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            return;
        }
    }
}
loadEnvFile();
function loadCredentials(environment = 'dev') {
    const env = environment.toLowerCase();
    const validEnvironments = ['dev', 'development', 'staging', 'prod', 'production'];
    if (!validEnvironments.includes(env)) {
        throw new Error(`Ambiente inválido: ${environment}. Debe ser: dev, staging, o prod`);
    }
    const envMap = {
        'development': 'dev',
        'production': 'prod',
    };
    const normalizedEnv = envMap[env] || env;
    const envCredentials = loadFromEnvironment();
    if (envCredentials) {
        return envCredentials;
    }
    return loadFromFile(normalizedEnv);
}
function loadFromEnvironment() {
    const hasRegion = !!process.env.AWS_REGION;
    const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
    const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
    if (!hasRegion || !hasAccessKey || !hasSecretKey) {
        if (process.env.DEBUG_CONFIG === 'true') {
            console.log('Debug - Variables de entorno:', {
                AWS_REGION: hasRegion,
                AWS_ACCESS_KEY_ID: hasAccessKey,
                AWS_SECRET_ACCESS_KEY: hasSecretKey,
            });
        }
        return null;
    }
    try {
        const credentials = {
            aws: {
                region: process.env.AWS_REGION || '',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                accountId: process.env.AWS_ACCOUNT_ID || '',
            },
            cognito: {
                userPoolId: process.env.COGNITO_USER_POOL_ID || '',
                clientId: process.env.COGNITO_CLIENT_ID || '',
                clientSecret: process.env.COGNITO_CLIENT_SECRET || '',
            },
            dynamodb: {
                usersTable: process.env.DYNAMODB_USERS_TABLE || '',
                userProfilesTable: process.env.DYNAMODB_USER_PROFILES_TABLE || '',
                userSessionsTable: process.env.DYNAMODB_USER_SESSIONS_TABLE || '',
                contentTable: process.env.DYNAMODB_CONTENT_TABLE || '',
                paymentsTable: process.env.DYNAMODB_PAYMENTS_TABLE || '',
                subscriptionsTable: process.env.DYNAMODB_SUBSCRIPTIONS_TABLE || '',
                payoutsTable: process.env.DYNAMODB_PAYOUTS_TABLE || '',
                paymentDistributionsTable: process.env.DYNAMODB_PAYMENT_DISTRIBUTIONS_TABLE || '',
                idempotencyTable: process.env.DYNAMODB_IDEMPOTENCY_TABLE || '',
                paymentProofsTable: process.env.DYNAMODB_PAYMENT_PROOFS_TABLE || '',
                commissionsTable: process.env.DYNAMODB_COMMISSIONS_TABLE || '',
                messagesTable: process.env.DYNAMODB_MESSAGES_TABLE || '',
                verificationsTable: process.env.DYNAMODB_VERIFICATIONS_TABLE || '',
                coursesTable: process.env.DYNAMODB_COURSES_TABLE || '',
                notificationsTable: process.env.DYNAMODB_NOTIFICATIONS_TABLE || '',
                analyticsEventsTable: process.env.DYNAMODB_ANALYTICS_EVENTS_TABLE || '',
                userModelRelationsTable: process.env.DYNAMODB_USER_MODEL_RELATIONS_TABLE || '',
                modelAgencyRelationsTable: process.env.DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE || '',
                agencyAgencyRelationsTable: process.env.DYNAMODB_AGENCY_AGENCY_RELATIONS_TABLE || '',
            },
            s3: {
                avatarsBucket: process.env.S3_AVATARS_BUCKET || '',
                contentBucket: process.env.S3_CONTENT_BUCKET || '',
                verificationDocsBucket: process.env.S3_VERIFICATION_DOCS_BUCKET || '',
                paymentProofsBucket: process.env.S3_PAYMENT_PROOFS_BUCKET || '',
                coursesBucket: process.env.S3_COURSES_BUCKET || '',
            },
            eventbridge: {
                eventBusName: process.env.EVENTBRIDGE_BUS_NAME || '',
            },
            sns: {
                userEventsTopic: process.env.SNS_USER_EVENTS_TOPIC || '',
                paymentEventsTopic: process.env.SNS_PAYMENT_EVENTS_TOPIC || '',
                contentEventsTopic: process.env.SNS_CONTENT_EVENTS_TOPIC || '',
                notificationEventsTopic: process.env.SNS_NOTIFICATION_EVENTS_TOPIC || '',
            },
            ses: {
                fromEmail: process.env.SES_FROM_EMAIL || '',
                region: process.env.SES_REGION || process.env.AWS_REGION || '',
            },
            secrets: {
                jwtSecretArn: process.env.SECRETS_JWT_SECRET_ARN || '',
                mercadopagoTokenArn: process.env.SECRETS_MERCADOPAGO_TOKEN_ARN || '',
                stripeSecretKeyArn: process.env.SECRETS_STRIPE_SECRET_KEY_ARN || '',
            },
            payment: {
                mercadopago: {
                    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
                    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
                },
                stripe: {
                    secretKey: process.env.STRIPE_SECRET_KEY || '',
                    publicKey: process.env.STRIPE_PUBLIC_KEY || '',
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
                },
            },
            api: {
                baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
                frontendUrl: process.env.API_FRONTEND_URL || 'http://localhost:3000',
            },
        };
        validateCredentials(credentials);
        return credentials;
    }
    catch (error) {
        return null;
    }
}
function loadFromFile(normalizedEnv) {
    const credentialsPath = path.resolve(__dirname, '../../../..', 'config', 'credentials', `credentials.${normalizedEnv}.json`);
    if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Archivo de credenciales no encontrado: ${credentialsPath}\n` +
            `Por favor, crea el archivo copiando config/credentials/credentials.example.json\n` +
            `y renombrándolo a credentials.${normalizedEnv}.json\n` +
            `O configura las variables de entorno según .env.example`);
    }
    try {
        const fileContent = fs.readFileSync(credentialsPath, 'utf-8');
        const credentials = JSON.parse(fileContent);
        validateCredentials(credentials);
        return credentials;
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Error al parsear el archivo de credenciales ${credentialsPath}: ${error.message}\n` +
                `Verifica que el JSON sea válido.`);
        }
        throw new Error(`Error al cargar credenciales desde ${credentialsPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function validateCredentials(credentials) {
    const requiredFields = [
        'aws',
        'cognito',
        'dynamodb',
        's3',
        'eventbridge',
        'sns',
        'ses',
        'secrets',
        'payment',
        'api',
    ];
    for (const field of requiredFields) {
        if (!credentials[field]) {
            throw new Error(`Campo requerido faltante en credenciales: ${field}`);
        }
    }
    if (!credentials.aws || !credentials.aws.region) {
        throw new Error('AWS region es requerida en credenciales');
    }
    if (!credentials.aws.accessKeyId || !credentials.aws.secretAccessKey) {
        throw new Error('AWS accessKeyId y secretAccessKey son requeridos');
    }
    if (!credentials.cognito || !credentials.cognito.userPoolId || !credentials.cognito.clientId) {
        throw new Error('Cognito userPoolId y clientId son requeridos');
    }
    if (!credentials.dynamodb || !credentials.dynamodb.usersTable) {
        throw new Error('DynamoDB usersTable es requerida');
    }
}
function getCredentials() {
    const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return loadCredentials(environment);
    }
    return loadCredentials(environment);
}
function getAWSCredentials(credentials) {
    const creds = credentials || getCredentials();
    return {
        region: creds.aws.region,
        credentials: {
            accessKeyId: creds.aws.accessKeyId,
            secretAccessKey: creds.aws.secretAccessKey,
        },
    };
}
function getDynamoDBConfig(credentials) {
    const creds = credentials || getCredentials();
    return {
        region: creds.aws.region,
        credentials: {
            accessKeyId: creds.aws.accessKeyId,
            secretAccessKey: creds.aws.secretAccessKey,
        },
        tables: creds.dynamodb,
    };
}
function getS3Config(credentials) {
    const creds = credentials || getCredentials();
    return {
        region: creds.aws.region,
        credentials: {
            accessKeyId: creds.aws.accessKeyId,
            secretAccessKey: creds.aws.secretAccessKey,
        },
        buckets: creds.s3,
    };
}
//# sourceMappingURL=credentials.loader.js.map