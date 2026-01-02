import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
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
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { AdminPaymentsService } from '../services/admin-payments.service';
import { ListTransactionsDto, ProcessRefundDto } from '../dto/payments.dto';
import { getUserFromToken, requireAdmin } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('admin-payments')
@Controller('admin/payments')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  private readonly logger: LoggerService;

  constructor(
    private readonly adminPaymentsService: AdminPaymentsService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('PaymentsController', configService);
  }

  /**
   * GET /admin/payments/transactions
   * Listar transacciones
   */
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar transacciones',
    description: 'Lista todas las transacciones con filtros opcionales. Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Transacciones listadas exitosamente' })
  async listTransactions(@Query() query: ListTransactionsDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminPaymentsService.listTransactions(query, req.token);
  }

  /**
   * GET /admin/payments/transactions/:id
   * Obtener transacción por ID
   */
  @Get('transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener transacción por ID',
    description: 'Obtiene información completa de una transacción. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({ status: 200, description: 'Transacción obtenida exitosamente' })
  async getTransactionById(@Param('id') transactionId: string, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminPaymentsService.getTransactionById(transactionId, req.token);
  }

  /**
   * POST /admin/payments/transactions/:id/refund
   * Procesar reembolso
   */
  @Post('transactions/:id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesar reembolso',
    description: 'Procesa un reembolso para una transacción. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID de la transacción' })
  @ApiResponse({ status: 200, description: 'Reembolso procesado exitosamente' })
  async processRefund(
    @Param('id') transactionId: string,
    @Body() refundDto: ProcessRefundDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminPaymentsService.processRefund(
      transactionId,
      refundDto.reason,
      refundDto.amount,
      req.token,
    );
  }

  /**
   * GET /admin/payments/stats
   * Obtener estadísticas de pagos
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de pagos',
    description: 'Obtiene estadísticas de pagos (ingresos, transacciones, etc.). Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async getPaymentStats(@Query() query: { fromDate?: string; toDate?: string }, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminPaymentsService.getPaymentStats(query, req.token);
  }
}


