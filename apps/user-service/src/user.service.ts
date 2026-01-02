import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand, ScanCommand, PutCommand, BatchGetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials, UserRole, isAdminRole } from '@bravas/shared';
import { CacheService } from './services/cache.service';

@Injectable()
export class UserService {
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;

  constructor(
    private configService: ConfigService,
    private cacheService: CacheService,
  ) {
    this.credentials = loadCredentials();
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  async getMyProfile(userId: string, email: string) {
    try {
      // Intentar obtener del caché
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Obtener de tabla users
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      // Obtener perfil extendido
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId },
        }),
      );

      const result = {
        success: true,
        data: {
          ...userResponse.Item,
          profile: profileResponse.Item || {},
        },
      };

      // Guardar en caché (TTL: 5 minutos)
      await this.cacheService.set(cacheKey, result, 300);

      return result;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener perfil: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Actualizar perfil del usuario autenticado
   */
  async updateMyProfile(userId: string, email: string, updateDto: any) {
    try {
      // Verificar que el usuario existe
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      // Actualizar en tabla users
      const updateExpression: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      Object.keys(updateDto).forEach((key) => {
        if (updateDto[key] !== undefined) {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updateDto[key];
        }
      });

      if (updateExpression.length === 0) {
        throw new BadRequestException('No hay campos para actualizar. Proporciona al menos un campo válido.');
      }

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      // Actualizar en tabla user_profiles si hay campos de perfil
      const profileFields = ['bio', 'avatarUrl', 'preferences'];
      const hasProfileFields = profileFields.some((field) => updateDto[field] !== undefined);

      if (hasProfileFields) {
        const profileUpdateExpression: string[] = [];
        const profileExpressionAttributeValues: Record<string, any> = {};
        const profileExpressionAttributeNames: Record<string, string> = {};

        profileFields.forEach((key) => {
          if (updateDto[key] !== undefined) {
            profileUpdateExpression.push(`#${key} = :${key}`);
            profileExpressionAttributeNames[`#${key}`] = key;
            profileExpressionAttributeValues[`:${key}`] = updateDto[key];
          }
        });

        profileUpdateExpression.push('#updatedAt = :updatedAt');
        profileExpressionAttributeNames['#updatedAt'] = 'updatedAt';
        profileExpressionAttributeValues[':updatedAt'] = new Date().toISOString();

        await this.dynamoClient.send(
          new UpdateCommand({
            TableName: this.credentials.dynamodb.userProfilesTable,
            Key: { userId },
            UpdateExpression: `SET ${profileUpdateExpression.join(', ')}`,
            ExpressionAttributeNames: profileExpressionAttributeNames,
            ExpressionAttributeValues: profileExpressionAttributeValues,
          }),
        );
      }

      // Invalidar caché del perfil del usuario
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);
      
      // Invalidar caché de estadísticas si se actualizaron campos relevantes
      if (updateDto.avatarUrl || updateDto.bio || updateDto.preferences) {
        const statsCacheKey = CacheService.getStatsCacheKey(userId, 'my-stats');
        await this.cacheService.delete(statsCacheKey);
      }

      // Obtener usuario actualizado
      return this.getMyProfile(userId, email);
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar perfil: ${error.message}`);
    }
  }

  /**
   * Obtener perfil público de otro usuario
   */
  async getPublicProfile(targetUserId: string, requesterRole?: UserRole) {
    try {
      // Obtener usuario
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: targetUserId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      const user = userResponse.Item;

      // Obtener perfil
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId: targetUserId },
        }),
      );

      // Filtrar información según el rol del solicitante
      const publicData: any = {
        userId: user.userId || user.id,
        role: user.role,
        verified: user.verified || false,
        createdAt: user.createdAt,
      };

      // Agregar información específica según el rol del usuario y del solicitante
      if (profileResponse.Item) {
        const profile = profileResponse.Item;
        
        // Información pública para todos
        if (profile.bio) publicData.bio = profile.bio;
        if (profile.avatarUrl) publicData.avatarUrl = profile.avatarUrl;
        if (profile.country) publicData.country = profile.country;

        // Información específica por rol
        if (user.role === UserRole.MODEL) {
          // Modelos: mostrar información pública
          publicData.verificationStatus = profile.verificationStatus;
          // Solo mostrar stats si el solicitante es admin o el mismo usuario
          if (isAdminRole(requesterRole as UserRole) || requesterRole === UserRole.MODEL) {
            publicData.stats = {
              totalSales: profile.totalSales || 0,
              reputation: profile.reputation || 0,
            };
          }
        }

        if (user.role === UserRole.AGENCY) {
          // Agencias: mostrar información pública
          publicData.agencyName = profile.agencyName;
          publicData.agencyType = profile.agencyType;
          // Solo mostrar stats si el solicitante es admin
          if (isAdminRole(requesterRole as UserRole)) {
            publicData.stats = {
              totalModels: profile.totalModels || 0,
            };
          }
        }
      }

      return {
        success: true,
        data: publicData,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener perfil: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Listar usuarios con filtros (solo para admins)
   */
  async listUsers(listDto: any, requesterRole: UserRole) {
    try {
      // Solo admins pueden listar usuarios
      if (!isAdminRole(requesterRole)) {
        throw new ForbiddenException('Solo administradores pueden listar usuarios');
      }

      const page = listDto.page || 1;
      const limit = listDto.limit || 10;
      const skip = (page - 1) * limit;

      // Construir filtros
      const filterExpressions: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      if (listDto.role) {
        filterExpressions.push('#role = :role');
        expressionAttributeNames['#role'] = 'role';
        expressionAttributeValues[':role'] = listDto.role;
      }

      if (listDto.verified !== undefined) {
        filterExpressions.push('#verified = :verified');
        expressionAttributeNames['#verified'] = 'verified';
        expressionAttributeValues[':verified'] = listDto.verified;
      }

      if (listDto.country) {
        filterExpressions.push('#country = :country');
        expressionAttributeNames['#country'] = 'country';
        expressionAttributeValues[':country'] = listDto.country;
      }

      // Usar Scan para búsqueda general (mejorar con GSI si es necesario)
      const scanParams: any = {
        TableName: this.credentials.dynamodb.usersTable,
        Limit: limit,
      };

      if (filterExpressions.length > 0) {
        scanParams.FilterExpression = filterExpressions.join(' AND ');
        scanParams.ExpressionAttributeNames = expressionAttributeNames;
        scanParams.ExpressionAttributeValues = expressionAttributeValues;
      }

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));

      // Filtrar por búsqueda de texto si existe
      let items = response.Items || [];
      if (listDto.search) {
        const searchLower = listDto.search.toLowerCase();
        items = items.filter((item) => {
          const email = (item.email || '').toLowerCase();
          const fullName = (item.fullName || '').toLowerCase();
          return email.includes(searchLower) || fullName.includes(searchLower);
        });
      }

      // Paginación manual (mejorar con LastEvaluatedKey si es necesario)
      const total = items.length;
      const paginatedItems = items.slice(skip, skip + limit);

      return {
        success: true,
        data: paginatedItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Error al listar usuarios: ${error.message}`);
    }
  }

  /**
   * Listar modelos en el marketplace
   */
  async listModels(query: any) {
    try {
      // Intentar obtener de caché (TTL: 2 minutos)
      const cacheKey = CacheService.getMarketplaceCacheKey('models', query);
      const cachedResult = await this.cacheService.get<any>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Buscar usuarios con rol MODEL
      const scanParams: any = {
        TableName: this.credentials.dynamodb.usersTable,
        FilterExpression: '#role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': 'MODEL' },
      };

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));
      let items = response.Items || [];

      // Filtrar por búsqueda
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        items = items.filter((item) => {
          const email = (item.email || '').toLowerCase();
          const fullName = (item.fullName || '').toLowerCase();
          return email.includes(searchLower) || fullName.includes(searchLower);
        });
      }

      // Filtrar por país
      if (query.country) {
        items = items.filter((item) => item.country === query.country);
      }

      // Filtrar por verificación
      if (query.verified !== undefined) {
        items = items.filter((item) => item.verified === query.verified);
      }

      // Obtener perfiles para agregar información adicional
      const modelsWithProfiles = await Promise.all(
        items.map(async (user) => {
          const profileResponse = await this.dynamoClient.send(
            new GetCommand({
              TableName: this.credentials.dynamodb.userProfilesTable,
              Key: { userId: user.id || user.userId },
            }),
          );

          return {
            ...user,
            profile: profileResponse.Item || {},
          };
        }),
      );

      // Ordenar
      const sortBy = query.sortBy || 'createdAt';
      const order = query.order || 'desc';
      modelsWithProfiles.sort((a, b) => {
        const aVal = a[sortBy] || a.profile[sortBy] || '';
        const bVal = b[sortBy] || b.profile[sortBy] || '';
        if (order === 'asc') {
          return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
      });

      // Paginación
      const total = modelsWithProfiles.length;
      const paginatedItems = modelsWithProfiles.slice(skip, skip + limit);

      // Filtrar información pública
      const publicModels = paginatedItems.map((item: any) => ({
        userId: item.id || item.userId,
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        verified: item.verified || false,
        country: item.country,
        bio: item.profile?.bio,
        avatarUrl: item.profile?.avatarUrl,
        verificationStatus: item.profile?.verificationStatus,
        reputation: item.profile?.reputation || 0,
        createdAt: item.createdAt,
      }));

      const result = {
        success: true,
        data: publicModels,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      // Guardar en caché (TTL: 2 minutos)
      await this.cacheService.set(cacheKey, result, 120);

      return result;
    } catch (error: any) {
      throw new BadRequestException(`Error al listar modelos: ${error.message}`);
    }
  }

  /**
   * Listar agencias en el marketplace
   */
  async listAgencies(query: any) {
    try {
      // Intentar obtener de caché
      const cacheKey = CacheService.getMarketplaceCacheKey('agencies', query);
      const cachedResult = await this.cacheService.get<any>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Buscar usuarios con rol AGENCY
      const scanParams: any = {
        TableName: this.credentials.dynamodb.usersTable,
        FilterExpression: '#role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': 'AGENCY' },
      };

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));
      let items = response.Items || [];

      // Filtrar por búsqueda
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        items = items.filter((item) => {
          const email = (item.email || '').toLowerCase();
          const fullName = (item.fullName || '').toLowerCase();
          return email.includes(searchLower) || fullName.includes(searchLower);
        });
      }

      // Filtrar por país
      if (query.country) {
        items = items.filter((item) => item.country === query.country);
      }

      // Filtrar por verificación
      if (query.verified !== undefined) {
        items = items.filter((item) => item.verified === query.verified);
      }

      // Obtener perfiles
      const agenciesWithProfiles = await Promise.all(
        items.map(async (user) => {
          const profileResponse = await this.dynamoClient.send(
            new GetCommand({
              TableName: this.credentials.dynamodb.userProfilesTable,
              Key: { userId: user.id || user.userId },
            }),
          );

          return {
            ...user,
            profile: profileResponse.Item || {},
          };
        }),
      );

      // Ordenar
      const sortBy = query.sortBy || 'createdAt';
      const order = query.order || 'desc';
      agenciesWithProfiles.sort((a, b) => {
        const aVal = a[sortBy] || a.profile[sortBy] || '';
        const bVal = b[sortBy] || b.profile[sortBy] || '';
        if (order === 'asc') {
          return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
      });

      // Paginación
      const total = agenciesWithProfiles.length;
      const paginatedItems = agenciesWithProfiles.slice(skip, skip + limit);

      // Filtrar información pública
      const publicAgencies = paginatedItems.map((item: any) => ({
        userId: item.id || item.userId,
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        verified: item.verified || false,
        country: item.country,
        bio: item.profile?.bio,
        avatarUrl: item.profile?.avatarUrl,
        agencyName: item.profile?.agencyName,
        agencyType: item.profile?.agencyType,
        totalModels: item.profile?.totalModels || 0,
        createdAt: item.createdAt,
      }));

      const result = {
        success: true,
        data: publicAgencies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      // Guardar en caché (5 minutos)
      await this.cacheService.set(cacheKey, result, 300);

      return result;
    } catch (error: any) {
      throw new BadRequestException(`Error al listar agencias: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas del usuario (para modelos principalmente)
   */
  async getMyStats(userId: string, email: string, query: any) {
    try {
      // Intentar obtener de caché (TTL: 10 minutos)
      const cacheKey = CacheService.getStatsCacheKey(userId, 'my-stats');
      const cachedResult = await this.cacheService.get<any>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Obtener perfil
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId },
        }),
      );

      if (!profileResponse.Item) {
        throw new NotFoundException('Perfil no encontrado');
      }

      const profile = profileResponse.Item;

      // Obtener estadísticas básicas del perfil
      const stats: any = {
        totalSales: profile.totalSales || 0,
        totalEarnings: profile.totalEarnings || 0,
        reputation: profile.reputation || 0,
        totalBuyers: 0,
        totalContent: 0,
      };

      // Si es modelo, obtener estadísticas adicionales
      if (profile.role === 'MODEL') {
        // Contar compradores únicos desde relaciones
        try {
          const buyersResponse = await this.dynamoClient.send(
            new QueryCommand({
              TableName: this.credentials.dynamodb.userModelRelationsTable,
              IndexName: 'modelId-index',
              KeyConditionExpression: 'modelId = :modelId',
              ExpressionAttributeValues: { ':modelId': userId },
            }),
          );
          stats.totalBuyers = new Set(buyersResponse.Items?.map((item) => item.userId) || []).size;
        } catch (error) {
          // Si la tabla no existe aún, ignorar
        }

        // Contar contenido (si existe la tabla)
        try {
          const contentResponse = await this.dynamoClient.send(
            new QueryCommand({
              TableName: this.credentials.dynamodb.contentTable,
              IndexName: 'modelId-index',
              KeyConditionExpression: 'modelId = :modelId',
              ExpressionAttributeValues: { ':modelId': userId },
            }),
          );
          stats.totalContent = contentResponse.Items?.length || 0;
        } catch (error) {
          // Si la tabla no existe aún, ignorar
        }
      }

      const result = {
        success: true,
        data: stats,
      };

      // Guardar en caché (TTL: 10 minutos)
      await this.cacheService.set(cacheKey, result, 600);

      return result;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Aplicar a una agencia (modelo postulándose)
   */
  async applyToAgency(modelId: string, agencyId: string, message: string) {
    try {
      // Verificar que el modelo existe
      const modelResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: modelId },
        }),
      );

      if (!modelResponse.Item || modelResponse.Item.role !== 'MODEL') {
        throw new NotFoundException('Modelo no encontrado');
      }

      // Verificar que la agencia existe
      const agencyResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: agencyId },
        }),
      );

      if (!agencyResponse.Item || agencyResponse.Item.role !== 'AGENCY') {
        throw new NotFoundException('Agencia no encontrada');
      }

      // Crear relación
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.credentials.dynamodb.modelAgencyRelationsTable,
          Item: {
            modelId,
            agencyId,
            status: 'pending',
            message,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      return {
        success: true,
        message: 'Postulación enviada exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al aplicar a agencia: ${error.message}`);
    }
  }

  /**
   * Proponer representación (agencia proponiendo a modelo)
   */
  async proposeRepresentation(agencyId: string, modelId: string, message: string, terms?: string) {
    try {
      // Verificar que la agencia existe
      const agencyResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: agencyId },
        }),
      );

      if (!agencyResponse.Item || agencyResponse.Item.role !== 'AGENCY') {
        throw new NotFoundException('Agencia no encontrada');
      }

      // Verificar que el modelo existe
      const modelResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: modelId },
        }),
      );

      if (!modelResponse.Item || modelResponse.Item.role !== 'MODEL') {
        throw new NotFoundException('Modelo no encontrado');
      }

      // Crear relación
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.credentials.dynamodb.modelAgencyRelationsTable,
          Item: {
            modelId,
            agencyId,
            status: 'proposed',
            message,
            terms,
            proposedBy: 'agency',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      return {
        success: true,
        message: 'Propuesta enviada exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al proponer representación: ${error.message}`);
    }
  }

  /**
   * Actualizar usuario (admin)
   */
  async updateUser(userId: string, updateDto: any, requesterRole: UserRole) {
    try {
      // Verificar permisos
      if (!isAdminRole(requesterRole)) {
        throw new ForbiddenException('Solo administradores pueden actualizar usuarios');
      }

      // Verificar que el usuario existe
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      // Actualizar
      const updateExpression: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      Object.keys(updateDto).forEach((key) => {
        if (updateDto[key] !== undefined) {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updateDto[key];
        }
      });

      if (updateExpression.length === 0) {
        throw new BadRequestException('No hay campos para actualizar. Proporciona al menos un campo válido.');
      }

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }),
      );

      // Invalidar caché del perfil del usuario y marketplace
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);
      await this.cacheService.invalidatePattern('marketplace:');
      await this.cacheService.invalidatePattern('platform:stats');

      // Obtener usuario actualizado
      const updatedResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      return {
        success: true,
        data: updatedResponse.Item,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar usuario: ${error.message}`);
    }
  }

  /**
   * Eliminar usuario (admin)
   */
  async deleteUser(userId: string, requesterRole: UserRole) {
    try {
      // Solo admins nivel 3 pueden eliminar usuarios
      if (!isAdminRole(requesterRole) || requesterRole !== UserRole.ADMIN_LEVEL_3) {
        throw new ForbiddenException('Solo super administradores pueden eliminar usuarios');
      }

      // Verificar que el usuario existe
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      // Eliminar (soft delete - cambiar estado)
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'deleted',
            ':updatedAt': new Date().toISOString(),
          },
        }),
      );

      // Invalidar caché del perfil del usuario y marketplace
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);
      await this.cacheService.invalidatePattern('marketplace:');
      await this.cacheService.invalidatePattern('platform:stats');

      return {
        success: true,
        message: 'Usuario eliminado exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Error al eliminar usuario: ${error.message}`);
    }
  }

  /**
   * Obtener perfil de modelo específico
   */
  async getModelProfile(modelId: string, requesterRole?: UserRole) {
    try {
      // Obtener usuario
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: modelId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Modelo no encontrado');
      }

      const user = userResponse.Item;

      if (user.role !== 'MODEL') {
        throw new BadRequestException('El usuario no es un modelo');
      }

      // Obtener perfil
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId: modelId },
        }),
      );

      const profile = profileResponse.Item || {};

      // Construir respuesta según permisos del solicitante
      const publicData: any = {
        userId: user.id || user.userId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        verified: user.verified || false,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        country: profile.country,
        createdAt: user.createdAt,
      };

      // Información adicional para modelos
      if (profile.verificationStatus) {
        publicData.verificationStatus = profile.verificationStatus;
      }

      // Estadísticas (solo para el mismo modelo o admins)
      if (isAdminRole(requesterRole as UserRole) || requesterRole === UserRole.MODEL) {
        publicData.stats = {
          reputation: profile.reputation || 0,
          totalSales: profile.totalSales || 0,
          totalEarnings: profile.totalEarnings || 0,
        };
      }

      return {
        success: true,
        data: publicData,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener perfil de modelo: ${error.message}`);
    }
  }

  /**
   * Obtener perfil de agencia específica
   */
  async getAgencyProfile(agencyId: string, requesterRole?: UserRole) {
    try {
      // Obtener usuario
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: agencyId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const user = userResponse.Item;

      if (user.role !== 'AGENCY') {
        throw new BadRequestException('El usuario no es una agencia');
      }

      // Obtener perfil
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId: agencyId },
        }),
      );

      const profile = profileResponse.Item || {};

      // Construir respuesta
      const publicData: any = {
        userId: user.id || user.userId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        verified: user.verified || false,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        country: profile.country,
        agencyName: profile.agencyName,
        agencyType: profile.agencyType,
        createdAt: user.createdAt,
      };

      // Estadísticas (solo para admins)
      if (isAdminRole(requesterRole as UserRole)) {
        publicData.stats = {
          totalModels: profile.totalModels || 0,
          verifiedModels: profile.verifiedModels || 0,
        };
      }

      return {
        success: true,
        data: publicData,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener perfil de agencia: ${error.message}`);
    }
  }

  /**
   * Obtener lista de compradores (solo para modelos)
   */
  async getMyBuyers(modelId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      // Consultar relaciones usuario-modelo
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.userModelRelationsTable,
          IndexName: 'modelId-index', // Requiere GSI
          KeyConditionExpression: 'modelId = :modelId',
          ExpressionAttributeValues: {
            ':modelId': modelId,
          },
          ScanIndexForward: false, // Ordenar por fecha descendente
        }),
      );

      if (!response.Items || response.Items.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      // Obtener información de usuarios
      const userIds = [...new Set(response.Items.map((item) => item.userId))];
      const users = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const userResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.usersTable,
                Key: { id: userId },
              }),
            );
            return userResponse.Item;
          } catch (error) {
            return null;
          }
        })
      );

      // Filtrar nulos y construir respuesta
      const buyers = users
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .slice(skip, skip + limit)
        .map((user) => ({
          userId: user.id || user.userId,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        }));

      return {
        success: true,
        data: buyers,
        pagination: {
          page,
          limit,
          total: userIds.length,
          totalPages: Math.ceil(userIds.length / limit),
        },
      };
    } catch (error: any) {
      // Si la tabla no existe, retornar lista vacía
      return {
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  /**
   * Obtener modelos gestionados por agencia
   */
  async getMyModels(agencyId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      // Consultar relaciones modelo-agencia con status 'active'
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.modelAgencyRelationsTable,
          IndexName: 'agencyId-status-index', // Requiere GSI compuesto
          KeyConditionExpression: 'agencyId = :agencyId AND #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':agencyId': agencyId,
            ':status': 'active',
          },
          ScanIndexForward: false,
        }),
      );

      if (!response.Items || response.Items.length === 0) {
        return {
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      // Obtener información de modelos
      const modelIds = response.Items.map((item) => item.modelId);
      const models = await Promise.all(
        modelIds.map(async (modelId) => {
          try {
            const userResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.usersTable,
                Key: { id: modelId },
              }),
            );
            const profileResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.userProfilesTable,
                Key: { userId: modelId },
              }),
            );
            return {
              ...userResponse.Item,
              profile: profileResponse.Item || {},
            };
          } catch (error) {
            return null;
          }
        })
      );

      // Filtrar y construir respuesta
      const activeModels = models
        .filter((model) => model !== null)
        .slice(skip, skip + limit)
        .map((model: any) => ({
          userId: model.id || model.userId,
          email: model.email,
          fullName: model.fullName,
          avatarUrl: model.profile?.avatarUrl,
          verified: model.verified,
          reputation: model.profile?.reputation || 0,
          totalSales: model.profile?.totalSales || 0,
          joinedAt: model.createdAt,
        }));

      return {
        success: true,
        data: activeModels,
        pagination: {
          page,
          limit,
          total: modelIds.length,
          totalPages: Math.ceil(modelIds.length / limit),
        },
      };
    } catch (error: any) {
      // Si la tabla o índice no existe, retornar lista vacía
      return {
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  /**
   * Obtener estadísticas generales de la plataforma (admin)
   */
  async getPlatformStats() {
    try {
      // Intentar obtener de caché (TTL: 5 minutos)
      const cacheKey = CacheService.getPlatformStatsCacheKey();
      const cachedResult = await this.cacheService.get<any>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Contar usuarios por rol usando Scan (en producción usar GSI)
      const usersResponse = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Select: 'COUNT',
        }),
      );

      // Contar por rol (simplificado - en producción usar GSI)
      const modelsResponse = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.credentials.dynamodb.usersTable,
          FilterExpression: '#role = :role',
          ExpressionAttributeNames: { '#role': 'role' },
          ExpressionAttributeValues: { ':role': 'MODEL' },
          Select: 'COUNT',
        }),
      );

      const agenciesResponse = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.credentials.dynamodb.usersTable,
          FilterExpression: '#role = :role',
          ExpressionAttributeNames: { '#role': 'role' },
          ExpressionAttributeValues: { ':role': 'AGENCY' },
          Select: 'COUNT',
        }),
      );

      const verifiedResponse = await this.dynamoClient.send(
        new ScanCommand({
          TableName: this.credentials.dynamodb.usersTable,
          FilterExpression: '#verified = :verified',
          ExpressionAttributeNames: { '#verified': 'verified' },
          ExpressionAttributeValues: { ':verified': true },
          Select: 'COUNT',
        }),
      );

      const result = {
        success: true,
        data: {
          totalUsers: usersResponse.Count || 0,
          totalModels: modelsResponse.Count || 0,
          totalAgencies: agenciesResponse.Count || 0,
          verifiedUsers: verifiedResponse.Count || 0,
          pendingVerifications: await this.countPendingVerifications(),
          totalRevenue: await this.getTotalRevenue(),
          totalTransactions: await this.getTotalTransactions(),
          lastUpdated: new Date().toISOString(),
        },
      };

      // Guardar en caché (TTL: 5 minutos)
      await this.cacheService.set(cacheKey, result, 300);

      return result;
    } catch (error: any) {
      throw new BadRequestException(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Verificar pago manualmente (admin)
   */
  async verifyPayment(userId: string, paymentProofId: string, verifiedBy: string) {
    try {
      // Verificar que el usuario existe
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      // Registrar verificación de pago
      // Si existe tabla de pagos, registrar ahí también
      const updateExpression = [
        '#verified = :verified',
        '#updatedAt = :updatedAt',
        '#paymentVerified = :paymentVerified',
        '#paymentVerifiedBy = :paymentVerifiedBy',
        '#paymentProofId = :paymentProofId',
        '#paymentVerifiedAt = :paymentVerifiedAt',
      ];

      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: {
            '#verified': 'verified',
            '#updatedAt': 'updatedAt',
            '#paymentVerified': 'paymentVerified',
            '#paymentVerifiedBy': 'paymentVerifiedBy',
            '#paymentProofId': 'paymentProofId',
            '#paymentVerifiedAt': 'paymentVerifiedAt',
          },
          ExpressionAttributeValues: {
            ':verified': true,
            ':updatedAt': new Date().toISOString(),
            ':paymentVerified': true,
            ':paymentVerifiedBy': verifiedBy,
            ':paymentProofId': paymentProofId,
            ':paymentVerifiedAt': new Date().toISOString(),
          },
        }),
      );

      // Invalidar caché del perfil del usuario y estadísticas de plataforma
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);
      await this.cacheService.invalidatePattern('platform:stats');

      return {
        success: true,
        message: 'Pago verificado exitosamente',
        data: {
          userId,
          paymentProofId,
          verifiedBy,
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al verificar pago: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Agregar notas de soporte (support)
   */
  async addSupportNotes(userId: string, notes: string, addedBy: string) {
    try {
      // Obtener usuario actual
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado. Verifica que el ID sea correcto.');
      }

      const existingNotes = userResponse.Item.supportNotes || [];
      const newNote = {
        note: notes,
        addedBy,
        addedAt: new Date().toISOString(),
      };

      // Agregar nueva nota
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
          UpdateExpression:
            'SET supportNotes = :notes, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':notes': [...existingNotes, newNote],
            ':updatedAt': new Date().toISOString(),
          },
        }),
      );

      return {
        success: true,
        message: 'Nota de soporte agregada exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al agregar nota: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Contar verificaciones pendientes
   * 
   * Cuenta las verificaciones con status 'pending', 'submitted', 'pending_review' o 'pending_upload'
   * desde la tabla de verificaciones. Intenta usar GSI status-index para mejor performance.
   */
  private async countPendingVerifications(): Promise<number> {
    try {
      const verificationsTable = this.credentials.dynamodb.verificationsTable;
      if (!verificationsTable) {
        // Si no hay tabla de verificaciones configurada, retornar 0
        return 0;
      }

      // Intentar contar verificaciones pendientes usando GSI status-index
      try {
        // Intentar con Query usando GSI (más eficiente)
        const statuses = ['pending', 'submitted', 'pending_review', 'pending_upload'];
        let totalCount = 0;

        for (const status of statuses) {
          try {
            const response = await this.dynamoClient.send(
              new QueryCommand({
                TableName: verificationsTable,
                IndexName: 'status-index',
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':status': status,
                },
                Select: 'COUNT',
              }),
            );
            totalCount += response.Count || 0;
          } catch (queryError: any) {
            // Si el GSI no existe para este status, continuar con el siguiente
            continue;
          }
        }

        // Si obtuvimos resultados con GSI, retornar
        if (totalCount > 0) {
          return totalCount;
        }

        // Si no hay resultados con GSI, usar Scan como fallback
        throw new Error('GSI not available, using Scan');
      } catch (queryError: any) {
        // Si el GSI no existe, usar Scan como fallback (menos eficiente)
        try {
          const response = await this.dynamoClient.send(
            new ScanCommand({
              TableName: verificationsTable,
              FilterExpression: '#status IN (:pending, :submitted, :pending_review, :pending_upload)',
              ExpressionAttributeNames: {
                '#status': 'status',
              },
              ExpressionAttributeValues: {
                ':pending': 'pending',
                ':submitted': 'submitted',
                ':pending_review': 'pending_review',
                ':pending_upload': 'pending_upload',
              },
              Select: 'COUNT',
            }),
          );

          return response.Count || 0;
        } catch (scanError: any) {
          // Si hay error, retornar 0
          return 0;
        }
      }
    } catch (error) {
      // En caso de cualquier error, retornar 0
      return 0;
    }
  }

  /**
   * Obtener ingresos totales de la plataforma
   * 
   * Intenta obtener ingresos desde la tabla de pagos si existe.
   * Cuando Payment Service esté disponible, se puede mejorar con:
   * - HTTP call: await httpClient.get('/payments/stats/total-revenue')
   * - EventBridge: Escuchar eventos de pagos y mantener contador
   */
  private async getTotalRevenue(): Promise<number> {
    try {
      const paymentTable = process.env.DYNAMODB_PAYMENTS_TABLE || this.credentials.dynamodb.paymentsTable;
      if (!paymentTable) {
        // Si no hay tabla de pagos configurada, retornar 0
        return 0;
      }

      // Intentar calcular desde tabla de pagos
      // Asumiendo estructura: { id, amount, status, createdAt, ... }
      // Status exitoso: 'completed', 'success', 'paid'
      try {
        const response = await this.dynamoClient.send(
          new ScanCommand({
            TableName: paymentTable,
            FilterExpression: '#status IN (:completed, :success, :paid)',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':completed': 'completed',
              ':success': 'success',
              ':paid': 'paid',
            },
          }),
        );

        // Sumar todos los amounts de pagos exitosos
        if (response.Items && response.Items.length > 0) {
          const total = response.Items.reduce((sum, item) => {
            const amount = parseFloat(item.amount || item.total || '0');
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0);
          return Math.round(total * 100) / 100; // Redondear a 2 decimales
        }

        return 0;
      } catch (dbError: any) {
        // Si la tabla no existe o hay error, retornar 0
        // Esto es normal hasta que Payment Service esté implementado
        return 0;
      }
    } catch (error) {
      // En caso de cualquier error, retornar 0
      return 0;
    }
  }

  /**
   * Obtener total de transacciones
   * 
   * Intenta contar transacciones desde la tabla de pagos si existe.
   * Cuando Payment Service esté disponible, se puede mejorar con:
   * - HTTP call: await httpClient.get('/payments/stats/total-transactions')
   * - EventBridge: Escuchar eventos de pagos y mantener contador
   */
  private async getTotalTransactions(): Promise<number> {
    try {
      const paymentTable = process.env.DYNAMODB_PAYMENTS_TABLE || this.credentials.dynamodb.paymentsTable;
      if (!paymentTable) {
        // Si no hay tabla de pagos configurada, retornar 0
        return 0;
      }

      // Intentar contar transacciones exitosas desde tabla de pagos
      // Status exitoso: 'completed', 'success', 'paid'
      try {
        const response = await this.dynamoClient.send(
          new ScanCommand({
            TableName: paymentTable,
            FilterExpression: '#status IN (:completed, :success, :paid)',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':completed': 'completed',
              ':success': 'success',
              ':paid': 'paid',
            },
            Select: 'COUNT',
          }),
        );

        return response.Count || 0;
      } catch (dbError: any) {
        // Si la tabla no existe o hay error, retornar 0
        // Esto es normal hasta que Payment Service esté implementado
        return 0;
      }
    } catch (error) {
      // En caso de cualquier error, retornar 0
      return 0;
    }
  }

}





