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
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { AdminContentService } from '../services/admin-content.service';
import { ListPendingContentDto, ModerateContentDto } from '../dto/content.dto';
import { getUserFromToken, requireAdmin } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('admin-content')
@Controller('admin/content')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class ContentController {
  private readonly logger: LoggerService;

  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('ContentController', configService);
  }

  /**
   * GET /admin/content/pending
   * Listar contenido pendiente de moderación
   */
  @Get('pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar contenido pendiente de moderación',
    description: 'Lista posts y packs que están pendientes de moderación. Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Contenido pendiente listado exitosamente' })
  async listPendingContent(@Query() query: ListPendingContentDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminContentService.listPendingContent(query, req.token);
  }

  /**
   * GET /admin/content/:type/:id
   * Obtener contenido por ID
   */
  @Get(':type/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener contenido por ID',
    description: 'Obtiene información completa de un post o pack. Solo administradores.',
  })
  @ApiParam({ name: 'type', enum: ['post', 'pack'], description: 'Tipo de contenido' })
  @ApiParam({ name: 'id', description: 'ID del contenido' })
  @ApiResponse({ status: 200, description: 'Contenido obtenido exitosamente' })
  async getContentById(
    @Param('type') type: 'post' | 'pack',
    @Param('id') contentId: string,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminContentService.getContentById(contentId, type, req.token);
  }

  /**
   * POST /admin/content/:type/:id/moderate
   * Moderar contenido (aprobar, rechazar, ocultar, eliminar)
   */
  @Post(':type/:id/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Moderar contenido',
    description: 'Aprobar, rechazar, ocultar o eliminar contenido. Solo administradores.',
  })
  @ApiParam({ name: 'type', enum: ['post', 'pack'], description: 'Tipo de contenido' })
  @ApiParam({ name: 'id', description: 'ID del contenido' })
  @ApiResponse({ status: 200, description: 'Contenido moderado exitosamente' })
  async moderateContent(
    @Param('type') type: 'post' | 'pack',
    @Param('id') contentId: string,
    @Body() moderateDto: ModerateContentDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminContentService.moderateContent(
      contentId,
      type,
      moderateDto.action,
      moderateDto.reason,
      req.token,
    );
  }
}











