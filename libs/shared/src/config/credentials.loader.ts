import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Credentials } from './credentials.interface';

// Cargar variables de entorno desde archivo .env si existe
// Esta función se ejecuta cuando se importa el módulo
function loadEnvFile() {
  const env = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
  
  // Intentar múltiples rutas posibles
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
  
  // Intentar cargar .env por defecto
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

// Cargar al importar el módulo
loadEnvFile();

/**
 * Carga las credenciales desde variables de entorno o archivos JSON según el ambiente
 * Prioridad: Variables de entorno > Archivos JSON
 * 
 * @param environment - Ambiente: 'dev', 'staging', 'prod'
 * @returns Objeto con todas las credenciales
 * @throws Error si no se pueden cargar las credenciales
 */
export function loadCredentials(environment: string = 'dev'): Credentials {
  // Normalizar el nombre del ambiente
  const env = environment.toLowerCase();
  
  // Validar que sea un ambiente válido
  const validEnvironments = ['dev', 'development', 'staging', 'prod', 'production'];
  if (!validEnvironments.includes(env)) {
    throw new Error(`Ambiente inválido: ${environment}. Debe ser: dev, staging, o prod`);
  }

  // Mapear nombres alternativos
  const envMap: Record<string, string> = {
    'development': 'dev',
    'production': 'prod',
  };
  const normalizedEnv = envMap[env] || env;

  // Intentar cargar desde variables de entorno primero
  const envCredentials = loadFromEnvironment();
  if (envCredentials) {
    return envCredentials;
  }

  // Si no hay variables de entorno, cargar desde archivo JSON
  return loadFromFile(normalizedEnv);
}

/**
 * Carga credenciales desde variables de entorno
 */
function loadFromEnvironment(): Credentials | null {
  // Debug: Verificar si las variables están cargadas
  const hasRegion = !!process.env.AWS_REGION;
  const hasAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
  
  // Verificar si tenemos las variables mínimas de AWS
  if (!hasRegion || !hasAccessKey || !hasSecretKey) {
    // Si estamos en modo debug, mostrar qué falta
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
    const credentials: Credentials = {
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
        chatsTable: process.env.DYNAMODB_CHATS_TABLE || '',
        contractsTable: process.env.DYNAMODB_CONTRACTS_TABLE || '',
        contractProposalsTable: process.env.DYNAMODB_CONTRACT_PROPOSALS_TABLE || '',
        postsTable: process.env.DYNAMODB_POSTS_TABLE || '',
        packsTable: process.env.DYNAMODB_PACKS_TABLE || '',
        verificationsTable: process.env.DYNAMODB_VERIFICATIONS_TABLE || '',
        coursesTable: process.env.DYNAMODB_COURSES_TABLE || '',
        notificationsTable: process.env.DYNAMODB_NOTIFICATIONS_TABLE || '',
        analyticsEventsTable: process.env.DYNAMODB_ANALYTICS_EVENTS_TABLE || '',
        userModelRelationsTable: process.env.DYNAMODB_USER_MODEL_RELATIONS_TABLE || '',
        modelAgencyRelationsTable: process.env.DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE || '',
        agencyAgencyRelationsTable: process.env.DYNAMODB_AGENCY_AGENCY_RELATIONS_TABLE || '',
        // Nuevas tablas para sistema de Follow/Likes/Comments
        userFollowsTable: process.env.DYNAMODB_USER_FOLLOWS_TABLE || '',
        postLikesTable: process.env.DYNAMODB_POST_LIKES_TABLE || '',
        postCommentsTable: process.env.DYNAMODB_POST_COMMENTS_TABLE || '',
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

    // Validar estructura básica
    validateCredentials(credentials);
    return credentials;
  } catch (error) {
    // Si falla la validación, retornar null para intentar cargar desde archivo
    return null;
  }
}

/**
 * Carga credenciales desde archivo JSON
 */
function loadFromFile(normalizedEnv: string): Credentials {
  // Ruta al archivo de credenciales
  // Desde libs/shared/src/config, necesitamos ir 4 niveles arriba
  const credentialsPath = path.resolve(
    __dirname,
    '../../../..',
    'config',
    'credentials',
    `credentials.${normalizedEnv}.json`
  );

  // Verificar que el archivo existe
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Archivo de credenciales no encontrado: ${credentialsPath}\n` +
      `Por favor, crea el archivo copiando config/credentials/credentials.example.json\n` +
      `y renombrándolo a credentials.${normalizedEnv}.json\n` +
      `O configura las variables de entorno según .env.example`
    );
  }

  try {
    // Leer y parsear el archivo
    const fileContent = fs.readFileSync(credentialsPath, 'utf-8');
    const credentials = JSON.parse(fileContent) as Credentials;

    // Validar estructura básica
    validateCredentials(credentials);

    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Error al parsear el archivo de credenciales ${credentialsPath}: ${error.message}\n` +
        `Verifica que el JSON sea válido.`
      );
    }
    throw new Error(
      `Error al cargar credenciales desde ${credentialsPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Valida que las credenciales tengan la estructura mínima requerida
 * Permite valores vacíos para campos opcionales (como S3 buckets que pueden no existir aún)
 */
function validateCredentials(credentials: any): asserts credentials is Credentials {
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

  // Validar campos críticos de AWS
  if (!credentials.aws || !credentials.aws.region) {
    throw new Error('AWS region es requerida en credenciales');
  }

  if (!credentials.aws.accessKeyId || !credentials.aws.secretAccessKey) {
    throw new Error('AWS accessKeyId y secretAccessKey son requeridos');
  }

  // Validar Cognito (crítico para autenticación)
  if (!credentials.cognito || !credentials.cognito.userPoolId || !credentials.cognito.clientId) {
    throw new Error('Cognito userPoolId y clientId son requeridos');
  }

  // Validar DynamoDB (al menos las tablas principales)
  if (!credentials.dynamodb || !credentials.dynamodb.usersTable) {
    throw new Error('DynamoDB usersTable es requerida');
  }

  // S3 buckets pueden estar vacíos (se crearán después)
  // EventBridge, SNS, SES pueden tener valores por defecto
}

/**
 * Obtiene las credenciales desde variables de entorno (útil para Lambda)
 * Si no están disponibles, carga desde archivo
 */
export function getCredentials(): Credentials {
  // En Lambda, preferir variables de entorno si están disponibles
  const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev';
  
  // Si estamos en Lambda y las credenciales vienen de Secrets Manager,
  // se pueden cargar desde variables de entorno
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // En Lambda, las credenciales pueden venir de Secrets Manager
    // Por ahora, cargamos desde archivo (en producción usar Secrets Manager)
    return loadCredentials(environment);
  }

  return loadCredentials(environment);
}

/**
 * Helper para obtener solo las credenciales de AWS
 */
export function getAWSCredentials(credentials?: Credentials) {
  const creds = credentials || getCredentials();
  return {
    region: creds.aws.region,
    credentials: {
      accessKeyId: creds.aws.accessKeyId,
      secretAccessKey: creds.aws.secretAccessKey,
    },
  };
}

/**
 * Helper para obtener configuración de DynamoDB
 */
export function getDynamoDBConfig(credentials?: Credentials) {
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

/**
 * Helper para obtener configuración de S3
 */
export function getS3Config(credentials?: Credentials) {
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



