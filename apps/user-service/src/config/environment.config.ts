/**
 * Configuración de variables de entorno para desarrollo y producción
 * Todas las configuraciones deben funcionar en ambos entornos
 */

export interface EnvironmentConfig {
  // Entorno
  environment: 'dev' | 'staging' | 'prod';
  isProduction: boolean;
  isDevelopment: boolean;

  // Servicio
  serviceName: string;
  serviceVersion: string;
  port: number;

  // AWS
  aws: {
    region: string;
    dynamodb: {
      usersTable: string;
      userProfilesTable: string;
      verificationsTable: string;
      cacheTable: string;
      paymentsTable?: string;
    };
    s3: {
      avatarsBucket: string;
      documentsBucket: string;
    };
    cognito: {
      userPoolId: string;
      clientId: string;
    };
  };

  // Caché
  cache: {
    enabled: boolean;
    defaultTTL: number; // segundos
    userProfileTTL: number;
    marketplaceTTL: number;
    statsTTL: number;
  };

  // Rate Limiting
  rateLimit: {
    enabled: boolean;
    public: { requests: number; windowMs: number };
    authenticated: { requests: number; windowMs: number };
    upload: { requests: number; windowMs: number };
    admin: { requests: number; windowMs: number };
  };

  // Logging
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    format: 'json' | 'pretty';
  };
}

/**
 * Cargar configuración según el entorno
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const environment = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'dev') as 'dev' | 'staging' | 'prod';
  const isProduction = environment === 'prod';
  const isDevelopment = environment === 'dev';

  // Configuración base
  const baseConfig: Partial<EnvironmentConfig> = {
    environment,
    isProduction,
    isDevelopment,
    serviceName: process.env.SERVICE_NAME || 'user-service',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    port: parseInt(process.env.PORT || '3001', 10),
  };

  // Configuración de AWS (desde variables de entorno o credentials)
  const awsConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    dynamodb: {
      usersTable: process.env.DYNAMODB_USERS_TABLE || 'bravas-users-dev',
      userProfilesTable: process.env.DYNAMODB_USER_PROFILES_TABLE || 'bravas-user-profiles-dev',
      verificationsTable: process.env.DYNAMODB_VERIFICATIONS_TABLE || 'bravas-verifications-dev',
      cacheTable: process.env.DYNAMODB_CACHE_TABLE || (isProduction ? 'bravas-cache-prod' : 'bravas-cache-dev'),
      paymentsTable: process.env.DYNAMODB_PAYMENTS_TABLE,
    },
    s3: {
      avatarsBucket: process.env.S3_AVATARS_BUCKET || 'bravas-avatars-dev',
      documentsBucket: process.env.S3_DOCUMENTS_BUCKET || 'bravas-documents-dev',
    },
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID || '',
      clientId: process.env.COGNITO_CLIENT_ID || '',
    },
  };

  // Configuración de caché
  const cacheConfig = {
    enabled: process.env.CACHE_ENABLED !== 'false', // Habilitado por defecto
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10), // 5 minutos
    userProfileTTL: parseInt(process.env.CACHE_USER_PROFILE_TTL || '300', 10), // 5 minutos
    marketplaceTTL: parseInt(process.env.CACHE_MARKETPLACE_TTL || '120', 10), // 2 minutos
    statsTTL: parseInt(process.env.CACHE_STATS_TTL || '600', 10), // 10 minutos
  };

  // Configuración de rate limiting (diferente para dev y prod)
  const rateLimitConfig = {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false', // Habilitado por defecto
    public: isProduction
      ? { requests: 100, windowMs: 60000 } // 100 req/min en prod
      : { requests: 200, windowMs: 60000 }, // 200 req/min en dev
    authenticated: isProduction
      ? { requests: 200, windowMs: 60000 } // 200 req/min en prod
      : { requests: 500, windowMs: 60000 }, // 500 req/min en dev
    upload: isProduction
      ? { requests: 10, windowMs: 60000 } // 10 req/min en prod
      : { requests: 20, windowMs: 60000 }, // 20 req/min en dev
    admin: isProduction
      ? { requests: 500, windowMs: 60000 } // 500 req/min en prod
      : { requests: 1000, windowMs: 60000 }, // 1000 req/min en dev
  };

  // Configuración de logging
  const loggingConfig = {
    level: (process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')) as EnvironmentConfig['logging']['level'],
    format: (isProduction ? 'json' : 'pretty') as EnvironmentConfig['logging']['format'],
  };

  return {
    ...baseConfig,
    aws: awsConfig,
    cache: cacheConfig,
    rateLimit: rateLimitConfig,
    logging: loggingConfig,
  } as EnvironmentConfig;
}

/**
 * Validar que todas las variables de entorno requeridas estén presentes
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): void {
  const required = [
    'aws.dynamodb.usersTable',
    'aws.dynamodb.userProfilesTable',
    'aws.s3.avatarsBucket',
  ];

  const missing: string[] = [];

  if (!config.aws.dynamodb.usersTable) missing.push('DYNAMODB_USERS_TABLE');
  if (!config.aws.dynamodb.userProfilesTable) missing.push('DYNAMODB_USER_PROFILES_TABLE');
  if (!config.aws.s3.avatarsBucket) missing.push('S3_AVATARS_BUCKET');

  if (missing.length > 0) {
    throw new Error(
      `Variables de entorno faltantes: ${missing.join(', ')}. ` +
      `Configura estas variables en .env.${config.environment} o como variables de entorno del sistema.`
    );
  }
}

















