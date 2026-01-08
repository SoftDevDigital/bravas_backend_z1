import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
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
  ApiQuery,
  ApiParam,
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
import { getUserFromToken } from '../helpers/auth.helper';

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

  /**
   * GET /payments/me/movements
   * Obtener historial de movimientos del buyer autenticado
   */
  @Get('me/movements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '💰 Historial de movimientos',
    description: `
**¿Para qué sirve?**
Obtiene el historial completo de transacciones del usuario autenticado (buyer).

**Casos de uso:**
- Ver todas las compras realizadas
- Ver suscripciones activas y canceladas
- Ver tips enviados
- Filtrar por tipo de transacción
- Ver historial de gastos

**Filtros disponibles:**
- \`type\`: Filtrar por tipo (purchases, subscriptions, tips, all)
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20)

**Tipos de transacciones:**
- \`purchases\`: Compras de packs, PPV
- \`subscriptions\`: Suscripciones a modelos
- \`tips\`: Tips enviados
- \`all\`: Todas las transacciones

**Ejemplo de uso:**
\`\`\`
GET /payments/me/movements?type=purchases&page=1&limit=20
Authorization: Bearer {token}
\`\`\`
    `.trim(),
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['purchases', 'subscriptions', 'tips', 'all'],
    description: 'Tipo de transacción a filtrar',
    example: 'all',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página (default: 1)',
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página (default: 20)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Historial de movimientos obtenido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  async getMyMovements(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const startTime = Date.now();
    try {
      // Obtener userId del token
      const userInfo = await getUserFromToken(req.token);
      
      const pageNum = page ? Number.parseInt(page, 10) : 1;
      const limitNum = limit ? Number.parseInt(limit, 10) : 20;
      const filterType = (type && ['all', 'purchases', 'subscriptions', 'tips'].includes(type)) 
        ? (type as 'all' | 'purchases' | 'subscriptions' | 'tips')
        : 'all';

      const result = await this.paymentService.getUserMovements(
        userInfo.userId,
        filterType,
        pageNum,
        limitNum,
      );

      const duration = Date.now() - startTime;
      this.logger.log('Movimientos obtenidos exitosamente', 'getMyMovements', {
        userId: userInfo.userId,
        type: filterType,
        count: result.data?.length || 0,
        duration: `${duration}ms`,
      });

      // Asegurar formato de respuesta consistente
      return {
        success: true,
        data: {
          items: result.data || [],
          pagination: result.pagination || {
            page: pageNum,
            limit: limitNum,
            total: result.data?.length || 0,
            totalPages: Math.ceil((result.data?.length || 0) / limitNum),
          },
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener movimientos', error?.stack, 'getMyMovements', {
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * GET /payments/me/subscriptions
   * Listar suscripciones activas del buyer
   */
  @Get('me/subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📅 Mis suscripciones activas',
    description: 'Retorna todas las suscripciones activas del usuario autenticado.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'canceled', 'all'],
    description: 'Filtrar por estado de suscripción',
    example: 'active',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Suscripciones obtenidas exitosamente',
  })
  async getMySubscriptions(
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      const filterStatus = (status && ['active', 'canceled', 'all'].includes(status))
        ? (status as 'active' | 'canceled' | 'all')
        : 'active';
      
      const result = await this.subscriptionService.getUserSubscriptions(
        userInfo.userId,
        filterStatus,
      );

      return result;
    } catch (error: any) {
      this.logger.error('Error al obtener suscripciones', error?.stack, 'getMySubscriptions', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /payments/subscriptions/:subscriptionId/cancel
   * Cancelar suscripción
   */
  @Put('subscriptions/:subscriptionId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '❌ Cancelar suscripción',
    description: 'Cancela una suscripción activa. La suscripción seguirá activa hasta el final del período pagado.',
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID de la suscripción a cancelar',
    example: 'sub_123',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Suscripción cancelada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Suscripción no encontrada',
  })
  async cancelSubscription(
    @Request() req: any,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      const result = await this.subscriptionService.cancelSubscription(
        subscriptionId,
        userInfo.userId,
        false, // cancelAtPeriodEnd
      );

      return result;
    } catch (error: any) {
      this.logger.error('Error al cancelar suscripción', error?.stack, 'cancelSubscription', {
        subscriptionId,
        error: error.message,
      });
      throw error;
    }
  }

  @Get('creator/:recipientId/balance')
  @ApiOperation({ summary: 'Obtener balance disponible para retiro' })
  @ApiResponse({ status: 200, description: 'Balance disponible' })
  async getAvailableBalance(@Param('recipientId') recipientId: string) {
    return this.payoutService.calculateAvailableBalance(recipientId);
  }
}























