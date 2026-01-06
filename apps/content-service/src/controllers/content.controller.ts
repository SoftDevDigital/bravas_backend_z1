import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { ContentService } from '../services/content.service';
import { S3Service } from '../services/s3.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { CreatePackDto } from '../dto/create-pack.dto';
import { ApiResponseDto, PostDto, PackDto } from '../dto/response.dto';
import { getUserFromToken } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('content')
@Controller('content')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class ContentController {
  private readonly logger: LoggerService;

  constructor(
    private readonly contentService: ContentService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('ContentController', configService);
  }

  // ========== POSTS ==========

  /**
   * POST /content/posts
   * Crear un nuevo post
   */
  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo post',
    description: 'Crea un post con texto e imagen opcional.',
  })
  @ApiResponse({
    status: 201,
    description: 'Post creado exitosamente',
    type: PostDto,
  })
  async createPost(@Request() req: any, @Body() body: CreatePostDto) {
    try {
      const userInfo = await getUserFromToken(req.token);

      const post = await this.contentService.createPost(
        userInfo.userId,
        userInfo.role as 'buyer' | 'model' | 'agency',
        body,
      );

      return {
        success: true,
        data: this.contentService.mapPostToDto(post),
        message: 'Post creado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al crear post', error?.stack, 'createPost', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * POST /content/posts/upload
   * Subir imagen para post
   */
  @Post('posts/upload')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir imagen para post',
    description: 'Sube una imagen a S3 y retorna la URL y key para usar en crear post.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Imagen subida exitosamente',
  })
  async uploadPostImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó ningún archivo');
      }

      const userInfo = await getUserFromToken(req.token);

      const { imageUrl, imageKey } = await this.s3Service.uploadPostImage(
        userInfo.userId,
        file.buffer,
        file.mimetype,
      );

      return {
        success: true,
        data: {
          imageUrl,
          imageKey,
        },
        message: 'Imagen subida exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al subir imagen de post', error?.stack, 'uploadPostImage', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /content/posts
   * Listar posts (feed o de un usuario)
   */
  @Get('posts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar posts',
    description: 'Lista posts del feed global o de un usuario específico.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'ID del usuario para filtrar posts' })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados (default: 20)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor para paginación' })
  @ApiResponse({
    status: 200,
    description: 'Lista de posts obtenida exitosamente',
    type: ApiResponseDto,
  })
  async listPosts(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const result = await this.contentService.listPosts(userId, limitNum, cursor);

      return {
        success: true,
        data: result.posts.map(p => this.contentService.mapPostToDto(p)),
        message: 'Posts obtenidos exitosamente',
        pagination: {
          limit: limitNum,
          hasMore: !!result.nextCursor,
          cursor: result.nextCursor,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al listar posts', error?.stack, 'listPosts', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /content/posts/:postId
   * Obtener post por ID
   */
  @Get('posts/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener post por ID',
    description: 'Obtiene los detalles de un post específico.',
  })
  @ApiParam({ name: 'postId', description: 'ID del post' })
  @ApiResponse({
    status: 200,
    description: 'Post obtenido exitosamente',
    type: PostDto,
  })
  async getPost(@Request() req: any, @Param('postId') postId: string) {
    try {
      const post = await this.contentService.getPostById(postId);

      return {
        success: true,
        data: this.contentService.mapPostToDto(post),
        message: 'Post obtenido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al obtener post', error?.stack, 'getPost', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /content/posts/:postId
   * Actualizar post
   */
  @Put('posts/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar post',
    description: 'Actualiza un post existente (solo el autor puede editar).',
  })
  @ApiParam({ name: 'postId', description: 'ID del post' })
  @ApiResponse({
    status: 200,
    description: 'Post actualizado exitosamente',
    type: PostDto,
  })
  async updatePost(
    @Request() req: any,
    @Param('postId') postId: string,
    @Body() body: Partial<CreatePostDto>,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const post = await this.contentService.updatePost(postId, userInfo.userId, body);

      return {
        success: true,
        data: this.contentService.mapPostToDto(post),
        message: 'Post actualizado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al actualizar post', error?.stack, 'updatePost', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * DELETE /content/posts/:postId
   * Eliminar post
   */
  @Delete('posts/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar post',
    description: 'Elimina un post (solo el autor puede eliminar).',
  })
  @ApiParam({ name: 'postId', description: 'ID del post' })
  @ApiResponse({
    status: 200,
    description: 'Post eliminado exitosamente',
  })
  async deletePost(@Request() req: any, @Param('postId') postId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      await this.contentService.deletePost(postId, userInfo.userId);

      return {
        success: true,
        message: 'Post eliminado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al eliminar post', error?.stack, 'deletePost', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  // ========== PACKS ==========

  /**
   * POST /content/packs
   * Crear un nuevo pack
   */
  @Post('packs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo pack',
    description: 'Crea un pack de contenido (solo modelos).',
  })
  @ApiResponse({
    status: 201,
    description: 'Pack creado exitosamente',
    type: PackDto,
  })
  async createPack(@Request() req: any, @Body() body: CreatePackDto) {
    try {
      const userInfo = await getUserFromToken(req.token);

      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo los modelos pueden crear packs');
      }

      const pack = await this.contentService.createPack(userInfo.userId, body);

      return {
        success: true,
        data: this.contentService.mapPackToDto(pack),
        message: 'Pack creado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al crear pack', error?.stack, 'createPack', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * POST /content/packs/upload
   * Subir imagen para pack
   */
  @Post('packs/upload')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir imagen para pack',
    description: 'Sube una imagen de portada a S3 para usar en crear pack.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Imagen subida exitosamente',
  })
  async uploadPackImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó ningún archivo');
      }

      const userInfo = await getUserFromToken(req.token);

      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo los modelos pueden subir imágenes de packs');
      }

      const { imageUrl, imageKey } = await this.s3Service.uploadPackImage(
        userInfo.userId,
        file.buffer,
        file.mimetype,
      );

      return {
        success: true,
        data: {
          imageUrl,
          imageKey,
        },
        message: 'Imagen subida exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al subir imagen de pack', error?.stack, 'uploadPackImage', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /content/packs
   * Listar packs (de un modelo o todos)
   */
  @Get('packs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar packs',
    description: 'Lista packs de un modelo específico o todos los packs activos.',
  })
  @ApiQuery({ name: 'modelId', required: false, description: 'ID del modelo para filtrar packs' })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados (default: 20)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de packs obtenida exitosamente',
    type: ApiResponseDto,
  })
  async listPacks(
    @Request() req: any,
    @Query('modelId') modelId?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const packs = await this.contentService.listPacks(modelId, limitNum);

      return {
        success: true,
        data: packs.map(p => this.contentService.mapPackToDto(p)),
        message: 'Packs obtenidos exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al listar packs', error?.stack, 'listPacks', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /content/packs/:packId
   * Obtener pack por ID
   */
  @Get('packs/:packId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener pack por ID',
    description: 'Obtiene los detalles de un pack específico.',
  })
  @ApiParam({ name: 'packId', description: 'ID del pack' })
  @ApiResponse({
    status: 200,
    description: 'Pack obtenido exitosamente',
    type: PackDto,
  })
  async getPack(@Request() req: any, @Param('packId') packId: string) {
    try {
      const pack = await this.contentService.getPackById(packId);

      return {
        success: true,
        data: this.contentService.mapPackToDto(pack),
        message: 'Pack obtenido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al obtener pack', error?.stack, 'getPack', {
        packId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * PUT /content/packs/:packId
   * Actualizar pack
   */
  @Put('packs/:packId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar pack',
    description: 'Actualiza un pack existente (solo el propietario puede editar).',
  })
  @ApiParam({ name: 'packId', description: 'ID del pack' })
  @ApiResponse({
    status: 200,
    description: 'Pack actualizado exitosamente',
    type: PackDto,
  })
  async updatePack(
    @Request() req: any,
    @Param('packId') packId: string,
    @Body() body: Partial<CreatePackDto>,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);

      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo los modelos pueden editar packs');
      }

      const pack = await this.contentService.updatePack(packId, userInfo.userId, body);

      return {
        success: true,
        data: this.contentService.mapPackToDto(pack),
        message: 'Pack actualizado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al actualizar pack', error?.stack, 'updatePack', {
        packId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * DELETE /content/packs/:packId
   * Eliminar pack
   */
  @Delete('packs/:packId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar pack',
    description: 'Elimina un pack (solo el propietario puede eliminar).',
  })
  @ApiParam({ name: 'packId', description: 'ID del pack' })
  @ApiResponse({
    status: 200,
    description: 'Pack eliminado exitosamente',
  })
  async deletePack(@Request() req: any, @Param('packId') packId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);

      if (userInfo.role !== 'model') {
        throw new BadRequestException('Solo los modelos pueden eliminar packs');
      }

      await this.contentService.deletePack(packId, userInfo.userId);

      return {
        success: true,
        message: 'Pack eliminado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al eliminar pack', error?.stack, 'deletePack', {
        packId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * POST /content/packs/:packId/purchase
   * Comprar pack
   */
  @Post('packs/:packId/purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comprar pack',
    description: 'Compra un pack de contenido (integración con payment-service).',
  })
  @ApiParam({ name: 'packId', description: 'ID del pack a comprar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paymentMethod: {
          type: 'string',
          description: 'Método de pago (stripe, mercadopago)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Pack comprado exitosamente',
  })
  async purchasePack(
    @Request() req: any,
    @Param('packId') packId: string,
    @Body() body: { paymentMethod: string },
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.contentService.purchasePack(packId, userInfo.userId, body.paymentMethod);

      return {
        success: true,
        data: {
          pack: this.contentService.mapPackToDto(result.pack),
          paymentId: result.paymentId,
        },
        message: 'Pack comprado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al comprar pack', error?.stack, 'purchasePack', {
        packId,
        error: error.message,
      });
      throw error;
    }
  }
}














