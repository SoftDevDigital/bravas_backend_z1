import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';
import { PostRecord, PackRecord, generatePostId, generatePackId } from './database-schema.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { CreatePackDto } from '../dto/create-pack.dto';
import { LoggerService } from '../common/logger/logger.service';
import { S3Service } from './s3.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ContentService {
  private readonly dynamoClient: DynamoDBDocumentClient;
  private readonly credentials: ReturnType<typeof loadCredentials>;
  private readonly logger: LoggerService;
  private readonly postsTable: string;
  private readonly packsTable: string;

  private readonly userServiceUrl: string;
  private readonly paymentServiceUrl: string;

  constructor(
    private configService: ConfigService,
    private s3Service: S3Service,
    private httpService: HttpService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    this.logger = LoggerService.create('ContentService', configService);
    
    // Usar credenciales si están disponibles, sino construir dinámicamente
    const projectName = process.env.PROJECT_NAME || 'bravas';
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
    this.postsTable = this.credentials.dynamodb.postsTable || `${projectName}-posts-${environment}`;
    this.packsTable = this.credentials.dynamodb.packsTable || `${projectName}-packs-${environment}`;
    
    this.userServiceUrl = this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3000/api/v1';
    this.paymentServiceUrl = this.configService.get<string>('PAYMENT_SERVICE_URL') || 'http://localhost:3002/api/v1';
  }

  /**
   * Crear post
   */
  async createPost(userId: string, userRole: 'buyer' | 'model' | 'agency', createPostDto: CreatePostDto): Promise<PostRecord> {
    try {
      if (!createPostDto.description && !createPostDto.imageUrl) {
        throw new BadRequestException('El post debe tener al menos texto o imagen');
      }

      const now = Date.now();
      const postId = generatePostId(userId, now);

      const post: PostRecord = {
        postId,
        createdAt: new Date().toISOString(),
        userId,
        userRole,
        description: createPostDto.description,
        imageUrl: createPostDto.imageUrl,
        imageKey: createPostDto.imageKey,
        likesCount: 0,
        commentsCount: 0,
        status: 'active',
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
      };

      // Enriquecer con información del autor
      await this.enrichPostWithUserInfo(post);

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.postsTable,
          Item: post,
        }),
      );

      this.logger.log('Post creado exitosamente', 'createPost', {
        postId,
        userId,
      });

      return post;
    } catch (error: any) {
      this.logger.error('Error al crear post', error?.stack, 'createPost', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Listar posts (feed o de un usuario específico)
   */
  async listPosts(userId?: string, limit: number = 20, cursor?: string): Promise<{
    posts: PostRecord[];
    nextCursor?: string;
  }> {
    try {
      let posts: PostRecord[] = [];

      if (userId) {
        // Posts de un usuario específico
        const response = await this.dynamoClient.send(
          new QueryCommand({
            TableName: this.postsTable,
            IndexName: 'userId-createdAt-index',
            KeyConditionExpression: 'userId = :userId',
            FilterExpression: '#status = :active',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':userId': userId,
              ':active': 'active',
            },
            Limit: limit,
            ScanIndexForward: false, // Más recientes primero
            ...(cursor && { ExclusiveStartKey: JSON.parse(cursor) }),
          }),
        );

        posts = (response.Items || []) as PostRecord[];
      } else {
        // Feed global (todos los posts activos)
        const response = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.postsTable,
            FilterExpression: '#status = :active',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':active': 'active',
            },
            Limit: limit,
            ...(cursor && { ExclusiveStartKey: JSON.parse(cursor) }),
          }),
        );

        posts = (response.Items || []) as PostRecord[];
        // Ordenar por fecha (más recientes primero)
        posts.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
      }

      // Enriquecer con información de usuarios
      if (this.httpService) {
        await Promise.all(
          posts.map(async (post) => {
            if (!post.authorName) {
              await this.enrichPostWithUserInfo(post);
            }
          })
        );
      }

      const nextCursor = posts.length === limit ? JSON.stringify({ lastKey: posts[posts.length - 1].postId }) : undefined;

      return { posts, nextCursor };
    } catch (error: any) {
      this.logger.error('Error al listar posts', error?.stack, 'listPosts', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtener post por ID
   */
  async getPostById(postId: string): Promise<PostRecord> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.postsTable,
          Key: { postId },
        }),
      );

      if (!response.Item) {
        throw new NotFoundException('Post no encontrado');
      }

      const post = response.Item as PostRecord;

      // Enriquecer con información del autor
      if (this.httpService && !post.authorName) {
        await this.enrichPostWithUserInfo(post);
      }

      return post;
    } catch (error: any) {
      this.logger.error('Error al obtener post', error?.stack, 'getPostById', {
        postId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Actualizar post
   */
  async updatePost(postId: string, userId: string, updateDto: Partial<CreatePostDto>): Promise<PostRecord> {
    try {
      const post = await this.getPostById(postId);

      // Verificar que el usuario es el autor
      if (post.userId !== userId) {
        throw new ForbiddenException('No tienes permiso para editar este post');
      }

      const now = Date.now();
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      if (updateDto.description !== undefined) {
        updateExpressions.push('description = :description');
        expressionAttributeValues[':description'] = updateDto.description;
      }

      if (updateDto.imageUrl !== undefined) {
        updateExpressions.push('imageUrl = :imageUrl');
        expressionAttributeValues[':imageUrl'] = updateDto.imageUrl;
      }

      if (updateDto.imageKey !== undefined) {
        updateExpressions.push('imageKey = :imageKey');
        expressionAttributeValues[':imageKey'] = updateDto.imageKey;
      }

      updateExpressions.push('updatedAtTimestamp = :updatedAt');
      expressionAttributeValues[':updatedAt'] = now;

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.postsTable,
          Key: { postId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      return await this.getPostById(postId);
    } catch (error: any) {
      this.logger.error('Error al actualizar post', error?.stack, 'updatePost', {
        postId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Eliminar post
   */
  async deletePost(postId: string, userId: string): Promise<void> {
    try {
      const post = await this.getPostById(postId);

      // Verificar que el usuario es el autor
      if (post.userId !== userId) {
        throw new ForbiddenException('No tienes permiso para eliminar este post');
      }

      // Eliminar imagen de S3 si existe
      if (post.imageKey) {
        await this.s3Service.deleteImage(post.imageKey);
      }

      // Marcar como eliminado (soft delete)
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.postsTable,
          Key: { postId },
          UpdateExpression: 'SET #status = :deleted, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':deleted': 'deleted',
            ':updatedAt': Date.now(),
          },
        }),
      );

      this.logger.log('Post eliminado exitosamente', 'deletePost', { postId, userId });
    } catch (error: any) {
      this.logger.error('Error al eliminar post', error?.stack, 'deletePost', {
        postId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Crear pack
   */
  async createPack(modelId: string, createPackDto: CreatePackDto): Promise<PackRecord> {
    try {
      // Verificar que el usuario es un modelo (se valida en el controller)

      const now = Date.now();
      const packId = generatePackId(modelId, now);

      const pack: PackRecord = {
        packId,
        createdAt: new Date().toISOString(),
        modelId,
        name: createPackDto.name,
        description: createPackDto.description,
        price: createPackDto.price,
        imageUrl: createPackDto.imageUrl,
        imageKey: createPackDto.imageKey,
        contentUrls: createPackDto.contentUrls,
        contentKeys: createPackDto.contentKeys,
        salesCount: 0,
        totalRevenue: 0,
        status: 'active',
        createdAtTimestamp: now,
        updatedAtTimestamp: now,
      };

      // Enriquecer con información del modelo
      await this.enrichPackWithUserInfo(pack);

      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.packsTable,
          Item: pack,
        }),
      );

      this.logger.log('Pack creado exitosamente', 'createPack', {
        packId,
        modelId,
      });

      return pack;
    } catch (error: any) {
      this.logger.error('Error al crear pack', error?.stack, 'createPack', {
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Listar packs de un modelo
   */
  async listPacks(modelId?: string, limit: number = 20): Promise<PackRecord[]> {
    try {
      let packs: PackRecord[] = [];

      if (modelId) {
        // Packs de un modelo específico
        const response = await this.dynamoClient.send(
          new QueryCommand({
            TableName: this.packsTable,
            IndexName: 'modelId-createdAt-index',
            KeyConditionExpression: 'modelId = :modelId',
            FilterExpression: '#status = :active',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':modelId': modelId,
              ':active': 'active',
            },
            Limit: limit,
            ScanIndexForward: false, // Más recientes primero
          }),
        );

        packs = (response.Items || []) as PackRecord[];
      } else {
        // Todos los packs activos
        const response = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.packsTable,
            FilterExpression: '#status = :active',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':active': 'active',
            },
            Limit: limit,
          }),
        );

        packs = (response.Items || []) as PackRecord[];
        packs.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
      }

      // Enriquecer con información de modelos
      if (this.httpService) {
        await Promise.all(
          packs.map(async (pack) => {
            if (!pack.modelName) {
              await this.enrichPackWithUserInfo(pack);
            }
          })
        );
      }

      return packs;
    } catch (error: any) {
      this.logger.error('Error al listar packs', error?.stack, 'listPacks', {
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Obtener pack por ID
   */
  async getPackById(packId: string): Promise<PackRecord> {
    try {
      const response = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.packsTable,
          Key: { packId },
        }),
      );

      if (!response.Item) {
        throw new NotFoundException('Pack no encontrado');
      }

      const pack = response.Item as PackRecord;

      // Enriquecer con información del modelo
      if (this.httpService && !pack.modelName) {
        await this.enrichPackWithUserInfo(pack);
      }

      return pack;
    } catch (error: any) {
      this.logger.error('Error al obtener pack', error?.stack, 'getPackById', {
        packId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Actualizar pack
   */
  async updatePack(packId: string, modelId: string, updateDto: Partial<CreatePackDto>): Promise<PackRecord> {
    try {
      const pack = await this.getPackById(packId);

      // Verificar que el usuario es el propietario
      if (pack.modelId !== modelId) {
        throw new ForbiddenException('No tienes permiso para editar este pack');
      }

      const now = Date.now();
      const updateExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};

      if (updateDto.name !== undefined) {
        updateExpressions.push('name = :name');
        expressionAttributeValues[':name'] = updateDto.name;
      }

      if (updateDto.description !== undefined) {
        updateExpressions.push('description = :description');
        expressionAttributeValues[':description'] = updateDto.description;
      }

      if (updateDto.price !== undefined) {
        updateExpressions.push('price = :price');
        expressionAttributeValues[':price'] = updateDto.price;
      }

      if (updateDto.imageUrl !== undefined) {
        updateExpressions.push('imageUrl = :imageUrl');
        expressionAttributeValues[':imageUrl'] = updateDto.imageUrl;
      }

      if (updateDto.imageKey !== undefined) {
        updateExpressions.push('imageKey = :imageKey');
        expressionAttributeValues[':imageKey'] = updateDto.imageKey;
      }

      if (updateDto.contentUrls !== undefined) {
        updateExpressions.push('contentUrls = :contentUrls');
        expressionAttributeValues[':contentUrls'] = updateDto.contentUrls;
      }

      if (updateDto.contentKeys !== undefined) {
        updateExpressions.push('contentKeys = :contentKeys');
        expressionAttributeValues[':contentKeys'] = updateDto.contentKeys;
      }

      updateExpressions.push('updatedAtTimestamp = :updatedAt');
      expressionAttributeValues[':updatedAt'] = now;

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.packsTable,
          Key: { packId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      return await this.getPackById(packId);
    } catch (error: any) {
      this.logger.error('Error al actualizar pack', error?.stack, 'updatePack', {
        packId,
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Eliminar pack
   */
  async deletePack(packId: string, modelId: string): Promise<void> {
    try {
      const pack = await this.getPackById(packId);

      // Verificar que el usuario es el propietario
      if (pack.modelId !== modelId) {
        throw new ForbiddenException('No tienes permiso para eliminar este pack');
      }

      // Eliminar imágenes de S3
      if (pack.imageKey) {
        await this.s3Service.deleteImage(pack.imageKey);
      }
      if (pack.contentKeys) {
        await Promise.all(
          pack.contentKeys.map(key => this.s3Service.deleteImage(key))
        );
      }

      // Marcar como eliminado (soft delete)
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.packsTable,
          Key: { packId },
          UpdateExpression: 'SET #status = :deleted, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':deleted': 'deleted',
            ':updatedAt': Date.now(),
          },
        }),
      );

      this.logger.log('Pack eliminado exitosamente', 'deletePack', { packId, modelId });
    } catch (error: any) {
      this.logger.error('Error al eliminar pack', error?.stack, 'deletePack', {
        packId,
        modelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Comprar pack (integración con payment-service)
   */
  async purchasePack(packId: string, buyerId: string, paymentMethod: string): Promise<{
    success: boolean;
    paymentId?: string;
    pack: PackRecord;
  }> {
    try {
      const pack = await this.getPackById(packId);

      if (pack.status !== 'active') {
        throw new BadRequestException('Este pack no está disponible');
      }

      // Llamar a payment-service para procesar el pago
      if (!this.httpService) {
        throw new BadRequestException('Payment service no disponible');
      }

      const paymentResponse: any = await firstValueFrom(
        this.httpService.post(`${this.paymentServiceUrl}/payments`, {
          amount: pack.price,
          currency: 'USD',
          recipientId: pack.modelId,
          recipientType: 'model',
          description: `Compra de pack: ${pack.name}`,
          metadata: {
            packId: pack.packId,
            packName: pack.name,
            type: 'pack_purchase',
          },
          paymentMethod,
        })
      );

      if (!paymentResponse?.data?.success) {
        throw new BadRequestException('Error al procesar el pago');
      }

      // Actualizar estadísticas del pack
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.packsTable,
          Key: { packId },
          UpdateExpression: 'SET salesCount = salesCount + :one, totalRevenue = totalRevenue + :price, updatedAtTimestamp = :updatedAt',
          ExpressionAttributeValues: {
            ':one': 1,
            ':price': pack.price,
            ':updatedAt': Date.now(),
          },
        }),
      );

      this.logger.log('Pack comprado exitosamente', 'purchasePack', {
        packId,
        buyerId,
        paymentId: paymentResponse.data.data?.paymentId,
      });

      const updatedPack = await this.getPackById(packId);

      return {
        success: true,
        paymentId: paymentResponse.data.data?.paymentId,
        pack: updatedPack,
      };
    } catch (error: any) {
      this.logger.error('Error al comprar pack', error?.stack, 'purchasePack', {
        packId,
        buyerId,
        error: error.message,
      });
      throw error;
    }
  }

  // Helpers privados

  private async enrichPostWithUserInfo(post: PostRecord): Promise<void> {
    if (!this.httpService) return;

    try {
      const response: any = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users/${post.userId}`)
      );
      if (response?.data?.success && response?.data?.data) {
        const userData = response.data.data;
        post.authorName = userData.fullName || userData.name || userData.artistName || userData.agencyName;
        post.authorUsername = userData.username;
        post.authorAvatar = userData.avatarUrl || userData.avatar;
      }
    } catch (error) {
      this.logger.warn('No se pudo obtener información del usuario', 'enrichPostWithUserInfo', {
        userId: post.userId,
        error: error.message,
      });
    }
  }

  private async enrichPackWithUserInfo(pack: PackRecord): Promise<void> {
    if (!this.httpService) return;

    try {
      const response: any = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users/${pack.modelId}`)
      );
      if (response?.data?.success && response?.data?.data) {
        const userData = response.data.data;
        pack.modelName = userData.fullName || userData.name || userData.artistName;
        pack.modelUsername = userData.username;
        pack.modelAvatar = userData.avatarUrl || userData.avatar;
      }
    } catch (error) {
      this.logger.warn('No se pudo obtener información del modelo', 'enrichPackWithUserInfo', {
        modelId: pack.modelId,
        error: error.message,
      });
    }
  }

  /**
   * Mapear PostRecord a formato del frontend
   */
  mapPostToDto(record: PostRecord): any {
    return {
      id: record.postId, // Alias para frontend
      postId: record.postId,
      userId: record.userId,
      userRole: record.userRole,
      authorName: record.authorName,
      authorUsername: record.authorUsername,
      authorAvatar: record.authorAvatar,
      description: record.description,
      imageUrl: record.imageUrl,
      likesCount: record.likesCount,
      commentsCount: record.commentsCount,
      status: record.status,
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : undefined,
    };
  }

  /**
   * Mapear PackRecord a formato del frontend
   */
  mapPackToDto(record: PackRecord): any {
    return {
      id: record.packId, // Alias para frontend
      packId: record.packId,
      modelId: record.modelId,
      modelName: record.modelName,
      modelUsername: record.modelUsername,
      modelAvatar: record.modelAvatar,
      name: record.name,
      description: record.description,
      price: record.price,
      imageUrl: record.imageUrl,
      contentUrls: record.contentUrls,
      salesCount: record.salesCount,
      totalRevenue: record.totalRevenue,
      status: record.status,
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : undefined,
    };
  }
}

