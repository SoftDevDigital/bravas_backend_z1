import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { AWSClientFactory } from '@bravas/shared';

/**
 * Servicio de seguridad para manejar secretos de AWS
 * Utiliza AWS Secrets Manager para almacenar API keys de Stripe de forma segura
 * 
 * CRÍTICO: Nunca almacenar secretos en código o variables de entorno sin encriptar
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private secretsManagerClient: SecretsManagerClient;
  private secretsCache: Map<string, string> = new Map();
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hora
  private readonly cacheTimestamps: Map<string, number> = new Map();

  constructor(private configService: ConfigService) {
    this.secretsManagerClient = AWSClientFactory.createSecretsManagerClient() as SecretsManagerClient;
    // Log de configuración para debugging
    if (process.env.DEBUG_SECRETS === 'true') {
      this.logger.debug('SecretsManagerClient inicializado', {
        region: this.secretsManagerClient.config.region,
      });
    }
  }

  async onModuleInit() {
    // Pre-cargar secretos críticos al iniciar
    try {
      await this.getStripeSecretKey();
      // Webhook secret es opcional en desarrollo (se necesita cuando se configuren webhooks)
      try {
        await this.getStripeWebhookSecret();
      } catch (error) {
        if (process.env.NODE_ENV === 'production') {
          // En producción, el webhook secret es crítico
          throw error;
        }
        // En desarrollo, solo loguear warning
        this.logger.warn('Webhook secret no disponible (opcional en desarrollo). Se necesitará cuando se configuren webhooks de Stripe.');
      }
      this.logger.log('Secretos críticos cargados exitosamente');
    } catch (error) {
      this.logger.error('Error al cargar secretos críticos', error);
      throw error;
    }
  }

  /**
   * Obtiene el secreto de Stripe Secret Key desde AWS Secrets Manager
   * Con caché para evitar múltiples llamadas
   */
  async getStripeSecretKey(): Promise<string> {
    const secretName = this.configService.get<string>('STRIPE_SECRET_KEY_SECRET_NAME') || 
                       `${process.env.PROJECT_NAME || 'bravas'}/stripe/secret-key`;
    return this.getSecret(secretName);
  }

  /**
   * Obtiene el secreto de Stripe Webhook Secret desde AWS Secrets Manager
   * En desarrollo, es opcional (solo se necesita cuando se configuren webhooks)
   */
  async getStripeWebhookSecret(): Promise<string> {
    const secretName = this.configService.get<string>('STRIPE_WEBHOOK_SECRET_SECRET_NAME') || 
                       `${process.env.PROJECT_NAME || 'bravas'}/stripe/webhook-secret`;
    
    // En desarrollo, verificar primero si hay una variable de entorno válida
    if (process.env.NODE_ENV !== 'production' || process.env.ENVIRONMENT === 'dev') {
      const envValue = process.env.STRIPE_WEBHOOK_SECRET;
      if (envValue && envValue !== 'PLACEHOLDER_UPDATE_WITH_REAL_SECRET' && envValue !== 'CHANGE_ME') {
        this.logger.debug('Usando variable de entorno STRIPE_WEBHOOK_SECRET (desarrollo)');
        this.secretsCache.set(secretName, envValue);
        this.cacheTimestamps.set(secretName, Date.now());
        return envValue;
      }
    }
    
    try {
      return await this.getSecret(secretName);
    } catch (error) {
      // En desarrollo, si no se encuentra, retornar un valor por defecto
      if (process.env.NODE_ENV !== 'production' || process.env.ENVIRONMENT === 'dev') {
        this.logger.warn('Webhook secret no configurado. Se necesitará cuando se configuren webhooks de Stripe.');
        const placeholder = 'webhook-secret-not-configured';
        this.secretsCache.set(secretName, placeholder);
        this.cacheTimestamps.set(secretName, Date.now());
        return placeholder;
      }
      throw error;
    }
  }

  /**
   * Obtiene un secreto genérico desde AWS Secrets Manager
   * Implementa caché con TTL para optimizar llamadas
   * En desarrollo, prioriza variables de entorno sobre AWS Secrets Manager
   */
  private async getSecret(secretName: string): Promise<string> {
    // Verificar caché
    const cached = this.secretsCache.get(secretName);
    const cacheTime = this.cacheTimestamps.get(secretName);
    
    if (cached && cacheTime && Date.now() - cacheTime < this.cacheTTL) {
      return cached;
    }

    // En desarrollo, intentar primero variables de entorno (más rápido y no requiere AWS)
    // Si encontramos la variable de entorno, NO intentar AWS en absoluto
    if (process.env.NODE_ENV !== 'production' || process.env.ENVIRONMENT === 'dev') {
      const secretKey = secretName.split('/').pop() || '';
      const envKeys = [
        `STRIPE_${secretKey.toUpperCase().replace(/-/g, '_')}`,
        secretKey.toUpperCase().replace(/-/g, '_'),
        secretName.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      ];
      
      for (const envKey of envKeys) {
        const envValue = process.env[envKey];
        if (envValue && envValue !== 'PLACEHOLDER_UPDATE_WITH_REAL_SECRET' && envValue !== 'CHANGE_ME') {
          this.logger.debug(`Usando variable de entorno ${envKey} para ${secretName} (desarrollo)`);
          this.secretsCache.set(secretName, envValue);
          this.cacheTimestamps.set(secretName, Date.now());
          return envValue;
        }
      }
      
      // Si es webhook secret y no está configurado, usar placeholder (no intentar AWS)
      if (secretName.includes('webhook-secret')) {
        this.logger.warn(`Webhook secret ${secretName} no configurado en variables de entorno. No crítico en desarrollo.`);
        const placeholder = 'webhook-secret-not-configured';
        this.secretsCache.set(secretName, placeholder);
        this.cacheTimestamps.set(secretName, Date.now());
        return placeholder;
      }
    }

    // Si no hay variable de entorno o estamos en producción, intentar AWS Secrets Manager
    try {
      // Log de debugging si está habilitado
      if (process.env.DEBUG_SECRETS === 'true') {
        const awsConfig = this.secretsManagerClient.config;
        this.logger.debug(`Intentando obtener secreto: ${secretName}`, {
          region: awsConfig.region,
          hasCredentials: !!awsConfig.credentials,
        });
      }

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.secretsManagerClient.send(command);
      
      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} no contiene SecretString`);
      }

      // Parsear si es JSON
      let secretValue: string;
      try {
        const parsed = JSON.parse(response.SecretString);
        // Si tiene una propiedad específica, usarla; si no, usar el valor completo
        secretValue = parsed.value || parsed.secret || response.SecretString;
      } catch {
        secretValue = response.SecretString;
      }

      // Actualizar caché
      this.secretsCache.set(secretName, secretValue);
      this.cacheTimestamps.set(secretName, Date.now());

      this.logger.debug(`Secreto ${secretName} cargado exitosamente`);
      return secretValue;
    } catch (error: any) {
      // En desarrollo, si AWS falla, intentar variables de entorno como último recurso
      // (aunque ya deberían haberse verificado antes, por si acaso)
      if (process.env.NODE_ENV !== 'production' || process.env.ENVIRONMENT === 'dev') {
        const secretKey = secretName.split('/').pop() || '';
        const envKeys = [
          `STRIPE_${secretKey.toUpperCase().replace(/-/g, '_')}`,
          secretKey.toUpperCase().replace(/-/g, '_'),
          secretName.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        ];
        
        for (const envKey of envKeys) {
          const envValue = process.env[envKey];
          if (envValue && envValue !== 'PLACEHOLDER_UPDATE_WITH_REAL_SECRET' && envValue !== 'CHANGE_ME') {
            this.logger.debug(`AWS Secrets Manager no disponible, usando variable de entorno ${envKey} para ${secretName} (desarrollo)`);
            this.secretsCache.set(secretName, envValue);
            this.cacheTimestamps.set(secretName, Date.now());
            return envValue;
          }
        }
        
        // Si es webhook secret y estamos en desarrollo, permitir que sea opcional
        if (secretName.includes('webhook-secret')) {
          this.logger.debug(`Webhook secret ${secretName} no configurado. No crítico en desarrollo.`);
          const placeholder = 'webhook-secret-not-configured';
          this.secretsCache.set(secretName, placeholder);
          this.cacheTimestamps.set(secretName, Date.now());
          return placeholder;
        }
      }
      
      // Solo lanzar error en producción o si no es desarrollo
      if (process.env.NODE_ENV === 'production') {
        const regionConfig = this.secretsManagerClient.config.region;
        const region = typeof regionConfig === 'function' 
          ? 'async function (verificar manualmente)' 
          : regionConfig || process.env.AWS_REGION || 'no configurada';
        
        this.logger.error(`Error al obtener secreto ${secretName}`, {
          message: error.message,
          code: error.code,
          name: error.name,
          region: region,
          secretName: secretName,
        });
        throw new Error(`No se pudo obtener el secreto ${secretName}: ${error.message}`);
      }
      
      // En desarrollo, si llegamos aquí, algo salió mal pero no es crítico
      this.logger.warn(`No se pudo obtener el secreto ${secretName} desde AWS ni variables de entorno. Usando placeholder.`);
      const placeholder = `${secretName}-not-configured`;
      this.secretsCache.set(secretName, placeholder);
      this.cacheTimestamps.set(secretName, Date.now());
      return placeholder;
    }
  }

  /**
   * Limpia el caché de secretos (útil para testing o rotación de secretos)
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      this.secretsCache.delete(secretName);
      this.cacheTimestamps.delete(secretName);
    } else {
      this.secretsCache.clear();
      this.cacheTimestamps.clear();
    }
  }
}

