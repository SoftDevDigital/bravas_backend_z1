import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { NotificationsService } from '../services/notifications.service';
import { ListNotificationsDto } from '../dto/list-notifications.dto';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { ApiResponseDto, NotificationDto } from '../dto/response.dto';
import { getUserFromToken } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger: LoggerService;
  private readonly internalApiKey: string;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('NotificationsController', configService);
    // API key interna para comunicación entre servicios
    this.internalApiKey = process.env.INTERNAL_API_KEY || 'bravas-internal-key-dev';
  }

  /**
   * POST /notifications/internal/create
   * Endpoint interno para que otros servicios creen notificaciones
   * Requiere API key interna en el header
   */
  @Post('internal/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[INTERNO] Crear notificación',
    description: 'Endpoint interno para que otros servicios creen notificaciones. Requiere API key interna.',
  })
  @ApiHeader({
    name: 'X-Internal-API-Key',
    description: 'API key interna para comunicación entre servicios',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Notificación creada exitosamente',
    type: ApiResponseDto,
  })
  async createNotificationInternal(
    @Body() createDto: CreateNotificationDto,
    @Headers('x-internal-api-key') apiKey?: string,
  ) {
    try {
      // Validar API key
      if (!apiKey || apiKey !== this.internalApiKey) {
        this.logger.warn('Intento de acceso no autorizado al endpoint interno', 'createNotificationInternal', {
          apiKey: apiKey ? 'provided' : 'missing',
        });
        throw new Error('Unauthorized: Invalid API key');
      }

      const notification = await this.notificationsService.createNotification(
        createDto.userId,
        createDto.type,
        createDto.title,
        createDto.message,
        {
          link: createDto.link,
          metadata: createDto.metadata,
          ttl: createDto.ttl,
        },
      );

      return {
        success: true,
        data: this.notificationsService.mapNotificationToDto(notification),
        message: 'Notificación creada exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al crear notificación interna', error?.stack, 'createNotificationInternal', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * POST /notifications/internal/create-batch
   * Endpoint interno para crear múltiples notificaciones en batch
   */
  @Post('internal/create-batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[INTERNO] Crear múltiples notificaciones',
    description: 'Endpoint interno para crear múltiples notificaciones en una sola llamada. Requiere API key interna.',
  })
  @ApiHeader({
    name: 'X-Internal-API-Key',
    description: 'API key interna para comunicación entre servicios',
    required: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Notificaciones creadas exitosamente',
    type: ApiResponseDto,
  })
  async createNotificationsBatch(
    @Body() body: { notifications: CreateNotificationDto[] },
    @Headers('x-internal-api-key') apiKey?: string,
  ) {
    try {
      // Validar API key
      if (!apiKey || apiKey !== this.internalApiKey) {
        this.logger.warn('Intento de acceso no autorizado al endpoint interno', 'createNotificationsBatch', {
          apiKey: apiKey ? 'provided' : 'missing',
        });
        throw new Error('Unauthorized: Invalid API key');
      }

      if (!body.notifications || !Array.isArray(body.notifications) || body.notifications.length === 0) {
        throw new Error('Bad Request: notifications array is required and must not be empty');
      }

      // Limitar batch size
      const maxBatchSize = 50;
      if (body.notifications.length > maxBatchSize) {
        throw new Error(`Bad Request: Maximum batch size is ${maxBatchSize}`);
      }

      const results = await Promise.allSettled(
        body.notifications.map(createDto =>
          this.notificationsService.createNotification(
            createDto.userId,
            createDto.type,
            createDto.title,
            createDto.message,
            {
              link: createDto.link,
              metadata: createDto.metadata,
              ttl: createDto.ttl,
            },
          ),
        ),
      );

      const successful = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => this.notificationsService.mapNotificationToDto(r.value));

      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: true,
        data: {
          created: successful.length,
          failed,
          notifications: successful,
        },
        message: `${successful.length} notificaciones creadas exitosamente${failed > 0 ? `, ${failed} fallaron` : ''}`,
      };
    } catch (error: any) {
      this.logger.error('Error al crear notificaciones en batch', error?.stack, 'createNotificationsBatch', {
        error: error.message,
        count: body.notifications?.length || 0,
      });
      throw error;
    }
  }

  /**
   * GET /notifications
   * Listar notificaciones del usuario autenticado
   */
  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar mis notificaciones',
    description: 'Retorna todas las notificaciones del usuario autenticado, ordenadas por fecha (más recientes primero).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite por página' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, description: 'Solo notificaciones no leídas' })
  @ApiQuery({ name: 'type', required: false, enum: ['message', 'contract', 'transfer', 'payment', 'verification', 'general', 'subscription', 'content', 'system'], description: 'Filtrar por tipo' })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones obtenidas exitosamente',
    type: ApiResponseDto,
  })
  async listNotifications(@Request() req: any, @Query() query: ListNotificationsDto) {
    const startTime = Date.now();
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.notificationsService.listNotifications(userInfo.userId, query);

      const duration = Date.now() - startTime;
      this.logger.log('Notificaciones listadas exitosamente', 'listNotifications', {
        userId: userInfo.userId,
        count: result.data?.length || 0,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al listar notificaciones', error?.stack, 'listNotifications', {
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * GET /notifications/unread-count
   * Obtener contador de notificaciones no leídas
   */
  @Get('unread-count')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener contador de no leídas',
    description: 'Retorna el número de notificaciones no leídas del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contador obtenido exitosamente',
  })
  async getUnreadCount(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const count = await this.notificationsService.getUnreadCount(userInfo.userId);

      return {
        success: true,
        data: { unreadCount: count },
        message: 'Contador obtenido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al obtener contador', error?.stack, 'getUnreadCount', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /notifications/:notificationId/read
   * Marcar notificación como leída
   */
  @Put(':notificationId/read')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar notificación como leída',
    description: 'Marca una notificación específica como leída.',
  })
  @ApiParam({ name: 'notificationId', description: 'ID de la notificación' })
  @ApiResponse({
    status: 200,
    description: 'Notificación marcada como leída exitosamente',
    type: ApiResponseDto,
  })
  async markAsRead(@Request() req: any, @Param('notificationId') notificationId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const notification = await this.notificationsService.markAsRead(notificationId, userInfo.userId);

      return {
        success: true,
        data: this.notificationsService.mapNotificationToDto(notification),
        message: 'Notificación marcada como leída exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al marcar notificación como leída', error?.stack, 'markAsRead', {
        notificationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /notifications/read-all
   * Marcar todas las notificaciones como leídas
   */
  @Put('read-all')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar todas las notificaciones como leídas',
    description: 'Marca todas las notificaciones no leídas del usuario como leídas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones marcadas como leídas exitosamente',
    type: ApiResponseDto,
  })
  async markAllAsRead(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.notificationsService.markAllAsRead(userInfo.userId);

      return {
        success: true,
        data: result,
        message: `${result.count} notificaciones marcadas como leídas exitosamente`,
      };
    } catch (error: any) {
      this.logger.error('Error al marcar todas las notificaciones como leídas', error?.stack, 'markAllAsRead', {
        error: error.message,
      });
      throw error;
    }
  }
}
