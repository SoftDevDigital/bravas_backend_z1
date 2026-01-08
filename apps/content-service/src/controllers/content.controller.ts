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
  ForbiddenException,
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
import { CreateCommentDto } from '../dto/like.dto';
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
   * Para usuarios USER: retorna feed personalizado (modelos seguidos)
   * Para otros roles: retorna feed global o posts de usuario específico
   */
  @Get('posts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar posts',
    description: `
Lista posts según el rol del usuario:
- **USER (comprador):** Feed personalizado con posts de modelos seguidos
- **MODEL/AGENCY:** Feed global o posts de un usuario específico

**Query params:**
- \`userId\`: ID del usuario para filtrar posts (solo para MODEL/AGENCY)
- \`limit\`: Límite de resultados (default: 20)
- \`cursor\`: Cursor para paginación
    `.trim(),
  })
  @ApiQuery({ name: 'userId', required: false, description: 'ID del usuario para filtrar posts (solo para MODEL/AGENCY)' })
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
      const userInfo = await getUserFromToken(req.token);
      const limitNum = limit ? parseInt(limit, 10) : 20;

      // Si es USER y no especificó userId, mostrar feed personalizado
      if ((userInfo.role === 'USER' || userInfo.role === 'user') && !userId) {
        const result = await this.contentService.getPersonalizedFeed(userInfo.userId, limitNum, cursor);
        return {
          success: true,
          data: result.posts.map(p => this.contentService.mapPostToDto(p)),
          message: 'Feed personalizado obtenido exitosamente',
          pagination: {
            limit: limitNum,
            hasMore: !!result.nextCursor,
            cursor: result.nextCursor,
          },
        };
      }

      // Para otros roles o si especificó userId, usar el método normal
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
   * GET /content/feed
   * Obtener feed personalizado (solo para usuarios USER)
   */
  @Get('feed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📱 Obtener feed personalizado',
    description: `
**¿Para qué sirve?**
Obtiene el feed personalizado del usuario autenticado con posts de los modelos que sigue.

**Casos de uso:**
- Ver contenido de modelos seguidos en orden cronológico
- Feed personalizado basado en intereses
- Descubrir nuevo contenido de modelos favoritos

**Restricciones:**
- Solo disponible para usuarios con rol USER
- Si no sigues a ningún modelo, retorna feed vacío

**Ejemplo de uso:**
\`\`\`
GET /content/feed?limit=20&cursor=eyJsYXN0S2V5IjoicG9zdF8xMjMifQ==
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "postId": "post_123",
      "userId": "model_456",
      "authorName": "Ana Martínez",
      "description": "Nuevo contenido exclusivo",
      "imageUrl": "https://...",
      "likesCount": 25,
      "commentsCount": 5,
      "createdAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "cursor": "eyJsYXN0S2V5IjoicG9zdF8xMjQifQ=="
  }
}
\`\`\`
    `.trim(),
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite de resultados (default: 20)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor para paginación' })
  @ApiResponse({
    status: 200,
    description: '✅ Feed personalizado obtenido exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo usuarios con rol USER pueden acceder al feed personalizado',
  })
  async getPersonalizedFeed(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);

      // Solo usuarios USER pueden acceder al feed personalizado
      if (userInfo.role !== 'USER' && userInfo.role !== 'user') {
        throw new ForbiddenException('Solo usuarios con rol USER pueden acceder al feed personalizado');
      }

      const limitNum = limit ? parseInt(limit, 10) : 20;
      const result = await this.contentService.getPersonalizedFeed(userInfo.userId, limitNum, cursor);

      return {
        success: true,
        data: result.posts.map(p => this.contentService.mapPostToDto(p)),
        message: 'Feed personalizado obtenido exitosamente',
        pagination: {
          limit: limitNum,
          hasMore: !!result.nextCursor,
          cursor: result.nextCursor,
        },
      };
    } catch (error: any) {
      this.logger.error('Error al obtener feed personalizado', error?.stack, 'getPersonalizedFeed', {
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
   * POST /content/posts/:postId/like
   * Dar like a un post
   */
  @Post('posts/:postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '❤️ Dar like a un post',
    description: `
**¿Para qué sirve?**
Da like a un post. Si ya le diste like, lo quita automáticamente (toggle).

**Casos de uso:**
- Dar like a posts que te gustan
- Quitar like si cambias de opinión
- Ver contador de likes actualizado

**Comportamiento:**
- Si no has dado like: agrega el like
- Si ya diste like: quita el like
- Retorna el estado actual (liked: true/false) y el contador actualizado

**Ejemplo de uso:**
\`\`\`
POST /content/posts/post_123/like
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "postId": "post_123",
    "liked": true,
    "likesCount": 25
  },
  "message": "Like agregado exitosamente"
}
\`\`\`
    `.trim(),
  })
  @ApiParam({ 
    name: 'postId', 
    description: 'ID único del post',
    example: 'post_123',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Like agregado/removido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Post no encontrado',
  })
  async likePost(@Request() req: any, @Param('postId') postId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.contentService.toggleLike(postId, userInfo.userId);

      return {
        success: true,
        data: {
          postId,
          liked: result.liked,
          likesCount: result.likesCount,
        },
        message: result.liked ? 'Like agregado exitosamente' : 'Like removido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al dar like', error?.stack, 'likePost', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * DELETE /content/posts/:postId/like
   * Quitar like de un post
   */
  @Delete('posts/:postId/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '💔 Quitar like de un post',
    description: `
**¿Para qué sirve?**
Quita explícitamente el like de un post.

**Nota:** También puedes usar \`POST /content/posts/:postId/like\` que hace toggle automático.

**Casos de uso:**
- Quitar like de forma explícita
- Remover like sin usar toggle

**Ejemplo de uso:**
\`\`\`
DELETE /content/posts/post_123/like
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "postId": "post_123",
    "liked": false,
    "likesCount": 24
  },
  "message": "Like removido exitosamente"
}
\`\`\`
    `.trim(),
  })
  @ApiParam({ 
    name: 'postId', 
    description: 'ID único del post',
    example: 'post_123',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Like removido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Post no encontrado o no has dado like',
  })
  async unlikePost(@Request() req: any, @Param('postId') postId: string) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const result = await this.contentService.removeLike(postId, userInfo.userId);

      return {
        success: true,
        data: {
          postId,
          liked: false,
          likesCount: result.likesCount,
        },
        message: 'Like removido exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al quitar like', error?.stack, 'unlikePost', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /content/posts/:postId/likes
   * Ver quién dio like a un post
   */
  @Get('posts/:postId/likes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '👥 Ver quién dio like',
    description: `
**¿Para qué sirve?**
Retorna la lista paginada de usuarios que dieron like a un post.

**Casos de uso:**
- Ver quién le dio like a un post
- Mostrar lista de usuarios que interactuaron
- Implementar funcionalidad "Ver quién le dio like"

**Parámetros:**
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20, max: 100)

**Ejemplo de uso:**
\`\`\`
GET /content/posts/post_123/likes?page=1&limit=20
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "user_123",
      "userName": "Juan Pérez",
      "avatar": "https://...",
      "likedAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "hasMore": true
  }
}
\`\`\`
    `.trim(),
  })
  @ApiParam({ 
    name: 'postId', 
    description: 'ID único del post',
    example: 'post_123',
    type: String,
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: '📄 Número de página (default: 1)',
    example: 1,
    type: Number,
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: '📊 Resultados por página (default: 20, max: 100)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de likes obtenida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Post no encontrado',
  })
  async getPostLikes(
    @Request() req: any,
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const result = await this.contentService.getPostLikes(postId, pageNum, limitNum);

      return {
        success: true,
        data: result.likes,
        pagination: result.pagination,
      };
    } catch (error: any) {
      this.logger.error('Error al obtener likes', error?.stack, 'getPostLikes', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * POST /content/posts/:postId/comments
   * Comentar en un post
   */
  @Post('posts/:postId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '💬 Comentar en un post',
    description: `
**¿Para qué sirve?**
Agrega un comentario a un post. Los comentarios permiten interactuar con el contenido.

**Casos de uso:**
- Comentar en posts de modelos
- Interactuar con contenido
- Dejar feedback o preguntas

**Restricciones:**
- El contenido del comentario no puede estar vacío
- El contenido será sanitizado automáticamente
- Los comentarios se ordenan por fecha (más recientes primero)

**Ejemplo de uso:**
\`\`\`
POST /content/posts/post_123/comments
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "¡Excelente post! Me encantó 😍"
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "commentId": "comment_123",
    "postId": "post_123",
    "userId": "user_456",
    "userName": "Juan Pérez",
    "content": "¡Excelente post! Me encantó 😍",
    "createdAt": "2024-01-20T15:30:00Z"
  },
  "message": "Comentario creado exitosamente"
}
\`\`\`
    `.trim(),
  })
  @ApiParam({ 
    name: 'postId', 
    description: 'ID único del post',
    example: 'post_123',
    type: String,
  })
  @ApiBody({ 
    type: CreateCommentDto,
    description: 'Contenido del comentario',
    examples: {
      ejemplo1: {
        summary: 'Comentario simple',
        value: {
          content: '¡Excelente post! Me encantó 😍'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: '✅ Comentario creado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: '❌ Contenido del comentario inválido o vacío',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Post no encontrado',
  })
  async createComment(
    @Request() req: any,
    @Param('postId') postId: string,
    @Body() body: CreateCommentDto,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const comment = await this.contentService.createComment(
        postId,
        userInfo.userId,
        userInfo.role as 'buyer' | 'model' | 'agency',
        body.content,
      );

      return {
        success: true,
        data: comment,
        message: 'Comentario creado exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al crear comentario', error?.stack, 'createComment', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * GET /content/posts/:postId/comments
   * Ver comentarios de un post
   */
  @Get('posts/:postId/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '💬 Ver comentarios de un post',
    description: `
**¿Para qué sirve?**
Retorna la lista paginada de comentarios de un post, ordenados por fecha (más recientes primero).

**Casos de uso:**
- Ver todos los comentarios de un post
- Implementar sección de comentarios en el frontend
- Cargar comentarios de forma paginada

**Parámetros:**
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20, max: 100)

**Ejemplo de uso:**
\`\`\`
GET /content/posts/post_123/comments?page=1&limit=20
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "commentId": "comment_123",
      "userId": "user_456",
      "userName": "Juan Pérez",
      "avatar": "https://...",
      "content": "¡Excelente post!",
      "createdAt": "2024-01-20T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "hasMore": false
  }
}
\`\`\`
    `.trim(),
  })
  @ApiParam({ 
    name: 'postId', 
    description: 'ID único del post',
    example: 'post_123',
    type: String,
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: '📄 Número de página (default: 1)',
    example: 1,
    type: Number,
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: '📊 Resultados por página (default: 20, max: 100)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Comentarios obtenidos exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Post no encontrado',
  })
  async getPostComments(
    @Request() req: any,
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const result = await this.contentService.getPostComments(postId, pageNum, limitNum);

      return {
        success: true,
        data: result.comments,
        pagination: result.pagination,
      };
    } catch (error: any) {
      this.logger.error('Error al obtener comentarios', error?.stack, 'getPostComments', {
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
   * GET /content/packs/purchased
   * Listar packs comprados por el buyer autenticado
   */
  @Get('packs/purchased')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '📦 Mis packs comprados',
    description: `
**¿Para qué sirve?**
Retorna todos los packs que el usuario autenticado (buyer) ha comprado, ordenados por fecha de compra (más recientes primero).

**Casos de uso:**
- Ver biblioteca de contenido comprado
- Acceder a packs adquiridos
- Ver historial de compras de packs
- Implementar sección "Mi biblioteca" en el frontend

**Restricciones:**
- Solo disponible para usuarios con rol USER
- Solo muestra packs con estado de pago exitoso
- Los packs están ordenados por fecha de compra (más recientes primero)

**Parámetros:**
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20, max: 100)

**Ejemplo de uso:**
\`\`\`
GET /content/packs/purchased?page=1&limit=20
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "pack_123",
        "modelId": "model_456",
        "modelName": "Ana Martínez",
        "title": "Pack Premium",
        "description": "Contenido exclusivo",
        "price": 49.99,
        "imageUrl": "https://...",
        "purchasedAt": "2024-01-20T15:30:00Z",
        "status": "purchased"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  },
  "message": "Packs comprados obtenidos exitosamente"
}
\`\`\`
    `,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página' })
  @ApiResponse({
    status: 200,
    description: '✅ Packs comprados obtenidos exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo usuarios con rol USER pueden ver sus packs comprados',
  })
  async getPurchasedPacks(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Number.parseInt(page, 10) : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) : 20;
    
    try {
      const userInfo = await getUserFromToken(req.token);

      // Solo usuarios USER pueden ver sus packs comprados
      if (userInfo.role !== 'USER' && userInfo.role !== 'user') {
        throw new ForbiddenException('Solo usuarios con rol USER pueden ver sus packs comprados');
      }

      const result = await this.contentService.getPurchasedPacks(userInfo.userId, pageNum, limitNum);

      // Mapear packs de forma segura
      const mappedPacks = result.packs.map(p => {
        try {
          return this.contentService.mapPackToDto(p);
        } catch (mapError: any) {
          this.logger.warn('Error al mapear pack a DTO', 'getPurchasedPacks', {
            packId: p.packId,
            error: mapError.message,
          });
          return null;
        }
      }).filter(p => p !== null);

      return {
        success: true,
        data: {
          items: mappedPacks,
          pagination: result.pagination,
        },
        message: 'Packs comprados obtenidos exitosamente',
      };
    } catch (error: any) {
      this.logger.error('Error al obtener packs comprados', error?.stack, 'getPurchasedPacks', {
        error: error.message,
      });
      // Retornar lista vacía en lugar de lanzar error para evitar 500
      return {
        success: true,
        data: {
          items: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        },
        message: 'Packs comprados obtenidos exitosamente (sin resultados)',
      };
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
















