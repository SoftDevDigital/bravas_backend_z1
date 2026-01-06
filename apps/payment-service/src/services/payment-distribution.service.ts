import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio de Distribución de Pagos
 * 
 * CRÍTICO: Sistema flexible para distribuir pagos entre:
 * - Bravas (plataforma)
 * - Creadores/Modelos
 * - Agencias (si aplica)
 * 
 * Diseñado para ser fácilmente configurable sin cambios de código
 */
export interface DistributionConfig {
  bravas: number; // Porcentaje para Bravas (ej: 20 = 20%)
  recipient: number; // Porcentaje para creador/modelo (ej: 80 = 80%)
  agency?: number; // Porcentaje para agencia (si aplica)
}

export interface DistributionResult {
  totalAmount: number; // Monto total en centavos
  bravas: {
    amount: number; // Monto en centavos
    percentage: number;
  };
  recipient: {
    amount: number;
    percentage: number;
  };
  agency?: {
    amount: number;
    percentage: number;
  };
}

@Injectable()
export class PaymentDistributionService {
  private readonly logger = new Logger(PaymentDistributionService.name);
  
  // Configuración por defecto (puede ser sobrescrita por configuración)
  private readonly defaultConfig: DistributionConfig = {
    bravas: 20, // 20% para Bravas
    recipient: 80, // 80% para creador
  };

  // Configuración cuando hay agencia
  private readonly agencyConfig: DistributionConfig = {
    bravas: 20, // 20% para Bravas
    recipient: 60, // 60% para creador
    agency: 20, // 20% para agencia
  };

  constructor(private configService: ConfigService) {
    // Cargar configuración desde variables de entorno si existe
    const bravasPercent = this.configService.get<number>('PAYMENT_BRAVAS_PERCENT');
    const recipientPercent = this.configService.get<number>('PAYMENT_RECIPIENT_PERCENT');
    const agencyPercent = this.configService.get<number>('PAYMENT_AGENCY_PERCENT');

    if (bravasPercent !== undefined && recipientPercent !== undefined) {
      this.defaultConfig.bravas = bravasPercent;
      this.defaultConfig.recipient = recipientPercent;
      
      if (agencyPercent !== undefined) {
        this.agencyConfig.bravas = bravasPercent;
        this.agencyConfig.recipient = recipientPercent - agencyPercent;
        this.agencyConfig.agency = agencyPercent;
      }
    }

    this.logger.log(`Configuración de distribución cargada: Bravas ${this.defaultConfig.bravas}%, Recipient ${this.defaultConfig.recipient}%`);
  }

  /**
   * Calcula la distribución de un pago
   * 
   * @param amount Monto total en centavos
   * @param hasAgency Si el creador tiene agencia
   * @param customConfig Configuración personalizada (opcional, para casos especiales)
   */
  calculateDistribution(
    amount: number,
    hasAgency: boolean = false,
    customConfig?: DistributionConfig,
  ): DistributionResult {
    const config = customConfig || (hasAgency ? this.agencyConfig : this.defaultConfig);

    // Validar que los porcentajes sumen 100
    const totalPercent = config.bravas + config.recipient + (config.agency || 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      this.logger.error(
        `Configuración de distribución inválida: porcentajes suman ${totalPercent}% en lugar de 100%`,
      );
      throw new Error(`Invalid distribution config: percentages must sum to 100%`);
    }

    // Calcular montos
    const bravasAmount = Math.round((amount * config.bravas) / 100);
    const recipientAmount = Math.round((amount * config.recipient) / 100);
    const agencyAmount = config.agency ? Math.round((amount * config.agency) / 100) : undefined;

    // Ajustar por redondeo (asegurar que la suma sea exacta)
    const calculatedTotal = bravasAmount + recipientAmount + (agencyAmount || 0);
    const difference = amount - calculatedTotal;

    // Ajustar la diferencia en el monto más grande (normalmente recipient)
    const result: DistributionResult = {
      totalAmount: amount,
      bravas: {
        amount: bravasAmount,
        percentage: config.bravas,
      },
      recipient: {
        amount: recipientAmount + difference, // Ajustar aquí
        percentage: config.recipient,
      },
    };

    if (hasAgency && agencyAmount !== undefined) {
      result.agency = {
        amount: agencyAmount,
        percentage: config.agency!,
      };
    }

    // Validar que la suma sea correcta
    const finalTotal = result.bravas.amount + result.recipient.amount + (result.agency?.amount || 0);
    if (finalTotal !== amount) {
      this.logger.error(
        `Error en cálculo de distribución: suma ${finalTotal} no coincide con monto ${amount}`,
      );
      throw new Error('Distribution calculation error');
    }

    return result;
  }

  /**
   * Obtiene la configuración actual de distribución
   */
  getDistributionConfig(hasAgency: boolean = false): DistributionConfig {
    return hasAgency ? { ...this.agencyConfig } : { ...this.defaultConfig };
  }

  /**
   * Valida una configuración de distribución
   */
  validateConfig(config: DistributionConfig): boolean {
    const total = config.bravas + config.recipient + (config.agency || 0);
    return Math.abs(total - 100) < 0.01 && config.bravas >= 0 && config.recipient >= 0;
  }
}





















