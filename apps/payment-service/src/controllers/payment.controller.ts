import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { PaymentService } from '../services/payment.service';
import { SubscriptionService } from '../services/subscription.service';
import { PayoutService } from '../services/payout.service';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { CreatePayoutDto } from '../dto/create-payout.dto';

@ApiTags('payments')
@Controller('payments')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentController {
  private readonly logger: LoggerService;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly payoutService: PayoutService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('PaymentController', configService);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Procesar un pago (tip o PPV)' })
  @ApiResponse({ status: 201, description: 'Pago procesado exitosamente' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Request() req: any) {
    const startTime = Date.now();
    try {
      const result = await this.paymentService.processPayment(
        createPaymentDto.userId,
        createPaymentDto.recipientId,
        createPaymentDto.amount,
        createPaymentDto.currency || 'usd',
        createPaymentDto.type,
        createPaymentDto.customerId,
        createPaymentDto.metadata || {},
        createPaymentDto.idempotencyKey,
        createPaymentDto.agencyId,
      );

      const duration = Date.now() - startTime;
      this.logger.log('Pago creado exitosamente', 'createPayment', {
        paymentId: result.paymentId,
        type: createPaymentDto.type,
        amount: createPaymentDto.amount,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al crear pago', error?.stack, 'createPayment', {
        type: createPaymentDto.type,
        amount: createPaymentDto.amount,
        duration: `${duration}ms`,
        error: error.message,
      });
      throw error;
    }
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una suscripción' })
  @ApiResponse({ status: 201, description: 'Suscripción creada exitosamente' })
  async createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto, @Request() req: any) {
    const startTime = Date.now();
    try {
      const result = await this.subscriptionService.createSubscription(
        createSubscriptionDto.userId,
        createSubscriptionDto.recipientId,
        createSubscriptionDto.planType,
        createSubscriptionDto.amount,
        createSubscriptionDto.currency || 'usd',
        createSubscriptionDto.customerId,
        createSubscriptionDto.connectedAccountId,
        createSubscriptionDto.agencyId,
        createSubscriptionDto.idempotencyKey,
      );

      const duration = Date.now() - startTime;
      this.logger.log('Suscripción creada exitosamente', 'createSubscription', {
        subscriptionId: result.subscriptionId,
        planType: createSubscriptionDto.planType,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al crear suscripción', error?.stack, 'createSubscription', {
        planType: createSubscriptionDto.planType,
        duration: `${duration}ms`,
        error: error.message,
      });
      throw error;
    }
  }

  @Post('payouts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un retiro' })
  @ApiResponse({ status: 201, description: 'Retiro creado exitosamente' })
  async createPayout(@Body() createPayoutDto: CreatePayoutDto, @Request() req: any) {
    const startTime = Date.now();
    try {
      const result = await this.payoutService.createPayout(
        createPayoutDto.recipientId,
        createPayoutDto.connectedAccountId,
        createPayoutDto.amount,
        createPayoutDto.currency || 'usd',
        createPayoutDto.paymentIds,
        createPayoutDto.idempotencyKey,
      );

      const duration = Date.now() - startTime;
      this.logger.log('Retiro creado exitosamente', 'createPayout', {
        payoutId: result.payoutId,
        amount: createPayoutDto.amount,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al crear retiro', error?.stack, 'createPayout', {
        amount: createPayoutDto.amount,
        duration: `${duration}ms`,
        error: error.message,
      });
      throw error;
    }
  }

  @Get(':paymentId')
  @ApiOperation({ summary: 'Obtener un pago por ID' })
  @ApiResponse({ status: 200, description: 'Pago encontrado' })
  async getPayment(@Param('paymentId') paymentId: string) {
    return this.paymentService.getPayment(paymentId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtener pagos de un usuario' })
  @ApiResponse({ status: 200, description: 'Lista de pagos' })
  async getUserPayments(@Param('userId') userId: string) {
    return this.paymentService.getUserPayments(userId);
  }

  @Get('creator/:recipientId/balance')
  @ApiOperation({ summary: 'Obtener balance disponible para retiro' })
  @ApiResponse({ status: 200, description: 'Balance disponible' })
  async getAvailableBalance(@Param('recipientId') recipientId: string) {
    return this.payoutService.calculateAvailableBalance(recipientId);
  }
}























