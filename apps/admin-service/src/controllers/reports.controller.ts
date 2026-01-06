import {
  Controller,
  Get,
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
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { AdminReportsService } from '../services/admin-reports.service';
import { GetStatsDto } from '../dto/reports.dto';
import { getUserFromToken, requireAdmin } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('admin-reports')
@Controller('admin/reports')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  private readonly logger: LoggerService;

  constructor(
    private readonly adminReportsService: AdminReportsService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('ReportsController', configService);
  }

  /**
   * GET /admin/reports/stats
   * Obtener estadísticas generales de la plataforma
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas generales',
    description: 'Obtiene estadísticas generales de usuarios, contenido y pagos. Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async getPlatformStats(@Query() query: GetStatsDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminReportsService.getPlatformStats(query, req.token);
  }

  /**
   * GET /admin/reports/users
   * Obtener estadísticas de usuarios
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de usuarios',
    description: 'Obtiene estadísticas detalladas de usuarios. Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas de usuarios obtenidas exitosamente' })
  async getUsersStats(@Query() query: GetStatsDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return {
      success: true,
      data: await this.adminReportsService.getUsersStats(query, req.token),
    };
  }

  /**
   * GET /admin/reports/content
   * Obtener estadísticas de contenido
   */
  @Get('content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de contenido',
    description: 'Obtiene estadísticas detalladas de contenido (posts y packs). Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas de contenido obtenidas exitosamente' })
  async getContentStats(@Query() query: GetStatsDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return {
      success: true,
      data: await this.adminReportsService.getContentStats(query, req.token),
    };
  }

  /**
   * GET /admin/reports/payments
   * Obtener estadísticas de pagos
   */
  @Get('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de pagos',
    description: 'Obtiene estadísticas detalladas de pagos y transacciones. Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Estadísticas de pagos obtenidas exitosamente' })
  async getPaymentsStats(@Query() query: GetStatsDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return {
      success: true,
      data: await this.adminReportsService.getPaymentsStats(query, req.token),
    };
  }
}










