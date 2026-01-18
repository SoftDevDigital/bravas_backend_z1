import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand, ScanCommand, PutCommand, BatchGetCommand, BatchWriteCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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
    console.log('🔍 [UserService] Constructor - Iniciando carga de credenciales...');
    console.log('🔍 [UserService] Constructor - Variables de entorno antes de loadCredentials():', {
      DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE: process.env.DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE || '❌ NO DEFINIDA',
      NODE_ENV: process.env.NODE_ENV || '❌ NO DEFINIDA',
      ENVIRONMENT: process.env.ENVIRONMENT || '❌ NO DEFINIDA',
    });
    
    this.credentials = loadCredentials();
    
    console.log('🔍 [UserService] Constructor - Credenciales cargadas:', {
      modelAgencyRelationsTable: this.credentials.dynamodb.modelAgencyRelationsTable || '❌ VACIA',
      usersTable: this.credentials.dynamodb.usersTable || '❌ VACIA',
      userProfilesTable: this.credentials.dynamodb.userProfilesTable || '❌ VACIA',
      awsRegion: this.credentials.aws.region || '❌ NO CONFIGURADA',
      awsAccessKeyId: this.credentials.aws.accessKeyId ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
      awsSecretAccessKey: this.credentials.aws.secretAccessKey ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
    });
    
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    console.log('🔍 [UserService] Constructor - Servicio inicializado correctamente');
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

      // Construir respuesta consolidando datos de users y user_profiles
      // Priorizar avatarUrl de users sobre user_profiles para evitar duplicación
      const profileData = profileResponse.Item || {};
      // Eliminar avatarUrl de profile si existe (ya está en nivel principal desde users)
      const { avatarUrl, ...profileWithoutAvatar } = profileData;
      const result = {
        success: true,
        data: {
          ...userResponse.Item,
          profile: profileWithoutAvatar,
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

      // VALIDACIÓN CRÍTICA: Alias debe ser único en TODA la base de datos (todos los roles)
      // Los alias NUNCA se pueden repetir entre usuarios, sin importar el rol
      if (updateDto.alias !== undefined && updateDto.alias !== null) {
        // Normalizar alias: asegurar formato @ejemplo en minúsculas
        const aliasNormalized = updateDto.alias.trim().toLowerCase();
        const aliasWithAt = aliasNormalized.startsWith('@') ? aliasNormalized : `@${aliasNormalized}`;
        
        // Buscar si existe otro usuario (cualquier rol) con este alias
        // IMPORTANTE: Excluir al usuario actual (userId) de la búsqueda
        const aliasCheckResponse = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.credentials.dynamodb.usersTable,
            FilterExpression: '#alias = :alias AND id <> :currentUserId',
            ExpressionAttributeNames: {
              '#alias': 'alias',
            },
            ExpressionAttributeValues: {
              ':alias': aliasWithAt,
              ':currentUserId': userId,
            },
            Limit: 1, // Solo necesitamos saber si existe al menos uno
          }),
        );

        if (aliasCheckResponse.Items && aliasCheckResponse.Items.length > 0) {
          throw new ConflictException(
            `El alias ${aliasWithAt} ya está en uso por otro usuario. ` +
            `Los alias deben ser únicos en toda la plataforma, sin importar el rol. ` +
            `Por favor, elige otro alias.`
          );
        }

        // Actualizar el alias normalizado en el DTO
        updateDto.alias = aliasWithAt;
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

      // Validar estructura de preferences.notifications si viene
      if (updateDto.preferences?.notifications) {
        const notifications = updateDto.preferences.notifications;
        // Asegurar estructura completa con valores por defecto
        const normalizedNotifications = {
          messages: notifications.messages !== undefined ? Boolean(notifications.messages) : true,
          contracts: notifications.contracts !== undefined ? Boolean(notifications.contracts) : true,
          transfers: notifications.transfers !== undefined ? Boolean(notifications.transfers) : true,
          payments: notifications.payments !== undefined ? Boolean(notifications.payments) : true,
          general: notifications.general !== undefined ? Boolean(notifications.general) : true,
        };
        // Reemplazar con la estructura normalizada
        updateDto.preferences = {
          ...updateDto.preferences,
          notifications: normalizedNotifications,
        };
      }

      // Actualizar en tabla user_profiles si hay campos de perfil
      // NOTA: avatarUrl NO está aquí porque se guarda solo en la tabla users (nivel principal)
      const profileFields = ['bio', 'preferences'];
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
   * Actualizar configuración de disponibilidad para representación (solo modelos)
   */
  async updateAvailability(userId: string, availabilityDto: {
    available?: boolean;
    contractTypes?: string[];
    advancePayment?: number;
    notes?: string;
  }) {
    try {
      // Verificar que el usuario existe y es un modelo
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const user = userResponse.Item;
      const userRole = user.role?.toLowerCase();

      if (userRole !== UserRole.MODEL) {
        throw new ForbiddenException('Solo los modelos pueden configurar su disponibilidad para representación');
      }

      // Obtener perfil actual
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId },
        }),
      );

      const profile = profileResponse.Item || {};
      const existingAvailability = profile.availability || {};

      // Construir objeto de disponibilidad actualizado (merge con existente)
      const updatedAvailability: any = {
        available: availabilityDto.available !== undefined ? availabilityDto.available : (existingAvailability.available ?? false),
        contractTypes: availabilityDto.contractTypes !== undefined ? availabilityDto.contractTypes : (existingAvailability.contractTypes || []),
        advancePayment: null,
        notes: availabilityDto.notes !== undefined ? availabilityDto.notes : (existingAvailability.notes ?? null),
        updatedAt: new Date().toISOString(),
      };

      // Validar advancePayment según contractTypes
      if (updatedAvailability.contractTypes.includes('with_advance')) {
        if (availabilityDto.advancePayment !== undefined) {
          updatedAvailability.advancePayment = availabilityDto.advancePayment;
        } else if (existingAvailability.advancePayment !== undefined) {
          updatedAvailability.advancePayment = existingAvailability.advancePayment;
        } else {
          updatedAvailability.advancePayment = null;
        }
      } else {
        // Si no incluye with_advance, no puede tener advancePayment
        if (availabilityDto.advancePayment !== undefined && availabilityDto.advancePayment !== null) {
          throw new BadRequestException('No puedes establecer un anticipo sin incluir "with_advance" en contractTypes');
        }
        updatedAvailability.advancePayment = null;
      }

      // Actualizar en userProfiles
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId },
          UpdateExpression: 'SET availability = :availability, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':availability': updatedAvailability,
            ':updatedAt': new Date().toISOString(),
          },
        }),
      );

      // Invalidar caché del perfil
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);

      return {
        success: true,
        data: {
          availability: updatedAvailability,
        },
        message: 'Disponibilidad actualizada exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar disponibilidad: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Obtener configuración de disponibilidad (solo modelos)
   */
  async getAvailability(userId: string) {
    try {
      // Verificar que el usuario existe y es un modelo
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const user = userResponse.Item;
      const userRole = user.role?.toLowerCase();

      if (userRole !== UserRole.MODEL) {
        throw new ForbiddenException('Solo los modelos pueden ver su disponibilidad para representación');
      }

      // Obtener perfil
      const profileResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Key: { userId },
        }),
      );

      const profile = profileResponse.Item || {};
      const availability = profile.availability || {
        available: false,
        contractTypes: [],
        advancePayment: null,
        notes: null,
        updatedAt: null,
      };

      return {
        success: true,
        data: {
          availability,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener disponibilidad: ${error.message || 'Error desconocido'}`);
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
          // Buscar por nombre o alias, NO por email
          const fullNameNormalized = ((item.fullName || '') as string).toLowerCase().trim();
          const alias = ((item.alias || '') as string).toLowerCase().trim();
          const aliasWithoutAt = alias.startsWith('@') ? alias.substring(1) : alias;
          const searchNormalized = searchLower.startsWith('@') ? searchLower.substring(1) : searchLower;
          return fullNameNormalized.includes(searchNormalized) || 
                 alias.includes(searchLower) || 
                 aliasWithoutAt.includes(searchNormalized);
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

      // Buscar usuarios con rol MODEL (case-insensitive)
      // Primero obtener todos los usuarios con rol MODEL (normalizar a minúsculas para comparar)
      const scanParams: any = {
        TableName: this.credentials.dynamodb.usersTable,
      };

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));
      let items = (response.Items || []).filter((item) => {
        // Normalizar rol para comparación case-insensitive
        const role = (item.role || '').toString().trim().toLowerCase();
        return role === 'model';
      });

      // Filtrar por búsqueda (buscar por nombre o alias, NO por email)
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        // Normalizar búsqueda: si viene con @, removerlo para buscar solo el alias sin @
        const searchNormalized = searchLower.startsWith('@') ? searchLower.substring(1) : searchLower;
        items = items.filter((item) => {
          const fullName = ((item.fullName || '') as string).toLowerCase().trim();
          const alias = ((item.alias || '') as string).toLowerCase().trim();
          const aliasWithoutAt = alias.startsWith('@') ? alias.substring(1) : alias;
          // Buscar en nombre completo o en alias (con o sin @)
          return fullName.includes(searchNormalized) || 
                 alias.includes(searchLower) || 
                 aliasWithoutAt.includes(searchNormalized);
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
        alias: item.alias, // Incluir alias para búsquedas
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

      // Buscar usuarios con rol AGENCY (case-insensitive)
      // Primero obtener todos los usuarios y filtrar por rol normalizado
      const scanParams: any = {
        TableName: this.credentials.dynamodb.usersTable,
      };

      const response = await this.dynamoClient.send(new ScanCommand(scanParams));
      let items = (response.Items || []).filter((item) => {
        // Normalizar rol para comparación case-insensitive
        const role = (item.role || '').toString().trim().toLowerCase();
        return role === 'agency';
      });

      // Filtrar por búsqueda
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        items = items.filter((item) => {
          const email = (item.email || '').toLowerCase();
          const fullName = (item.fullName || '').toLowerCase();
          // Buscar por nombre o alias, NO por email
          const fullNameNormalized = ((item.fullName || '') as string).toLowerCase().trim();
          const alias = ((item.alias || '') as string).toLowerCase().trim();
          const aliasWithoutAt = alias.startsWith('@') ? alias.substring(1) : alias;
          const searchNormalized = searchLower.startsWith('@') ? searchLower.substring(1) : searchLower;
          return fullNameNormalized.includes(searchNormalized) || 
                 alias.includes(searchLower) || 
                 aliasWithoutAt.includes(searchNormalized);
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

      // Obtener perfiles y calcular información adicional
      let agenciesWithProfiles = await Promise.all(
        items.map(async (user) => {
          const profileResponse = await this.dynamoClient.send(
            new GetCommand({
              TableName: this.credentials.dynamodb.userProfilesTable,
              Key: { userId: user.id || user.userId },
            }),
          );

          const profile = profileResponse.Item || {};

          // Calcular totalModels desde modelAgencyRelationsTable si no existe en perfil
          let totalModels = profile.totalModels ?? 0;
          if (!totalModels) {
            totalModels = await this.getAgencyModelsCount(user.id || user.userId);
          }

          return {
            ...user,
            profile: {
              ...profile,
              // Valores por defecto para campos que pueden no existir
              totalModels,
              rating: profile.rating ?? 0,
              experience: profile.experience ?? 0,
              recommended: profile.recommended ?? false,
            },
          };
        }),
      );

      // Filtrar por agencias recomendadas
      if (query.recommended !== undefined && query.recommended === true) {
        agenciesWithProfiles = agenciesWithProfiles.filter((item: any) => item.profile?.recommended === true);
      }

      // Filtrar por rating mínimo
      if (query.minRating !== undefined && query.minRating !== null) {
        agenciesWithProfiles = agenciesWithProfiles.filter((item: any) => {
          const rating = item.profile?.rating ?? 0;
          return rating >= query.minRating;
        });
      }

      // Filtrar por experiencia mínima
      if (query.minExperience !== undefined && query.minExperience !== null) {
        agenciesWithProfiles = agenciesWithProfiles.filter((item: any) => {
          const experience = item.profile?.experience ?? 0;
          return experience >= query.minExperience;
        });
      }

      // Filtrar por cantidad mínima de modelos
      if (query.minModels !== undefined && query.minModels !== null) {
        agenciesWithProfiles = agenciesWithProfiles.filter((item: any) => {
          const totalModels = item.profile?.totalModels ?? 0;
          return totalModels >= query.minModels;
        });
      }

      // Ordenar
      const sortBy = query.sortBy || 'createdAt';
      const order = query.order || 'desc';
      agenciesWithProfiles.sort((a: any, b: any) => {
        // Obtener valor del campo a ordenar (puede estar en user o profile)
        let aVal: any = a[sortBy];
        if (aVal === undefined || aVal === null) {
          aVal = a.profile?.[sortBy] ?? '';
        }
        
        let bVal: any = b[sortBy];
        if (bVal === undefined || bVal === null) {
          bVal = b.profile?.[sortBy] ?? '';
        }

        // Comparación numérica para campos numéricos
        if (['rating', 'experience', 'totalModels', 'reputation', 'totalSales'].includes(sortBy)) {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        }

        if (order === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
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
        rating: item.profile?.rating || 0,
        experience: item.profile?.experience || 0,
        recommended: item.profile?.recommended || false,
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
      // Verificar rol del usuario, no del perfil (el rol está en la tabla de usuarios)
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );
      const userRole = userResponse.Item?.role?.toLowerCase();
      
      if (userRole === UserRole.MODEL) {
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
    console.log('🔍 [applyToAgency] INICIO - Parámetros recibidos:', {
      modelId,
      agencyId,
      messageLength: message?.length || 0,
      tableName: this.credentials.dynamodb.modelAgencyRelationsTable || '❌ NO CONFIGURADA',
    });
    
    try {
      console.log('🔍 [applyToAgency] Paso 1: Verificando que el modelo existe...');
      // Verificar que el modelo existe
      const modelResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: modelId },
        }),
      );

      if (!modelResponse.Item) {
        throw new NotFoundException('Modelo no encontrado');
      }

      const modelRole = modelResponse.Item.role?.toLowerCase();
      console.log('🔍 [applyToAgency] Paso 1: Modelo encontrado, rol:', modelRole);
      if (modelRole !== UserRole.MODEL) {
        console.log('❌ [applyToAgency] Paso 1: ERROR - El usuario no es un modelo');
        throw new NotFoundException('Modelo no encontrado');
      }

      console.log('🔍 [applyToAgency] Paso 2: Verificando que la agencia existe...');
      // Verificar que la agencia existe
      const agencyResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: agencyId },
        }),
      );

      if (!agencyResponse.Item) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const agencyRole = agencyResponse.Item.role?.toLowerCase();
      console.log('🔍 [applyToAgency] Paso 2: Agencia encontrada, rol:', agencyRole);
      if (agencyRole !== UserRole.AGENCY) {
        console.log('❌ [applyToAgency] Paso 2: ERROR - El usuario no es una agencia');
        throw new NotFoundException('Agencia no encontrada');
      }

      console.log('🔍 [applyToAgency] Paso 3: Verificando si ya existe una relación...');
      console.log('🔍 [applyToAgency] Paso 3: Tabla a usar:', {
        tableName: this.credentials.dynamodb.modelAgencyRelationsTable || '❌ NO CONFIGURADA',
        desdeCredentials: this.credentials.dynamodb.modelAgencyRelationsTable || '❌ VACIO',
        desdeProcessEnv: process.env.DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE || '❌ NO EN PROCESS.ENV',
      });
      // Verificar si ya existe una relación entre este modelo y esta agencia
      try {
        const existingRelation = await this.dynamoClient.send(
          new GetCommand({
            TableName: this.credentials.dynamodb.modelAgencyRelationsTable,
            Key: {
              modelId,
              agencyId,
            },
          }),
        );

        if (existingRelation.Item) {
          const existingStatus = existingRelation.Item.status;
          throw new ConflictException(
            `Ya existe una relación con esta agencia. Estado actual: ${existingStatus}. ` +
            `Si deseas actualizar la relación, contacta al soporte o espera a que se procese la solicitud actual.`
          );
        }
      } catch (error: any) {
        console.log('🔍 [applyToAgency] Paso 3: Error al verificar relación existente:', {
          errorName: error?.name || 'Unknown',
          errorCode: error?.code || 'NO_CODE',
          errorMessage: error?.message || 'No message',
          isConflictException: error instanceof ConflictException,
          isResourceNotFound: error?.name === 'ResourceNotFoundException' || error?.code === 'ResourceNotFoundException',
        });
        
        if (error instanceof ConflictException) {
          console.log('❌ [applyToAgency] Paso 3: ERROR - Relación ya existe');
          throw error;
        }
        // Si es ResourceNotFoundException (tabla no existe), continuar e intentar crear
        // DynamoDB puede lanzar errores de AWS que no son ConflictException
        if (error.name === 'ResourceNotFoundException' || error.code === 'ResourceNotFoundException') {
          console.log('⚠️  [applyToAgency] Paso 3: Tabla no existe aún, continuando...');
          // Continuar e intentar crear la relación (esto fallará si la tabla no existe)
        } else if (error.name !== 'ResourceNotFoundException') {
          console.log('⚠️  [applyToAgency] Paso 3: Otro error, continuando...');
          // Si es otro error desconocido, continuar e intentar crear
        }
        // Continuar con el flujo normal
      }

      console.log('🔍 [applyToAgency] Paso 4: Verificando que la tabla está configurada...');
      // Verificar que la tabla está configurada
      const tableName = this.credentials.dynamodb.modelAgencyRelationsTable;
      console.log('🔍 [applyToAgency] Paso 4: Verificando tabla:', {
        tableName: tableName || '❌ VACIO',
        desdeCredentials: this.credentials.dynamodb.modelAgencyRelationsTable || '❌ NO EN CREDENTIALS',
        desdeProcessEnv: process.env.DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE || '❌ NO EN PROCESS.ENV',
        isEmpty: !tableName || tableName.trim() === '',
        trimLength: tableName?.trim()?.length || 0,
      });
      if (!tableName || tableName.trim() === '') {
        console.log('❌ [applyToAgency] Paso 4: ERROR - Tabla no configurada');
        console.log('❌ [applyToAgency] Paso 4: Estado de credenciales:', {
          credentialsObject: JSON.stringify(this.credentials.dynamodb, null, 2),
        });
        throw new BadRequestException(
          'La tabla DynamoDB para relaciones modelo-agencia no está configurada. ' +
          'Verifica que la variable de entorno DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE esté configurada.'
        );
      }

      console.log('🔍 [applyToAgency] Paso 5: Creando relación en tabla:', tableName);
      // Crear relación
      await this.dynamoClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            modelId,
            agencyId,
            status: 'pending',
            message,
            proposedBy: 'model',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      console.log('✅ [applyToAgency] Paso 5: Relación creada exitosamente');
      return {
        success: true,
        message: 'Postulación enviada exitosamente',
      };
    } catch (error: any) {
      console.log('❌ [applyToAgency] ERROR CAPTURADO:', {
        errorName: error?.name || 'Unknown',
        errorCode: error?.code || 'NO_CODE',
        errorMessage: error?.message || 'No message',
        errorStack: error?.stack || 'No stack',
        isNotFoundException: error instanceof NotFoundException,
        isConflictException: error instanceof ConflictException,
        isBadRequestException: error instanceof BadRequestException,
      });
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      // Mejorar mensaje de error para debugging - capturar errores específicos de DynamoDB
      const errorName = error.name || error.$metadata?.httpStatusCode || 'Error desconocido';
      const errorCode = error.code || error.$metadata?.requestId || '';
      const errorMessage = error.message || 'Error desconocido al aplicar a agencia';
      const tableName = this.credentials.dynamodb.modelAgencyRelationsTable || 'NO CONFIGURADA';
      
      // Detectar errores específicos de DynamoDB
      if (errorName === 'ResourceNotFoundException' || errorCode === 'ResourceNotFoundException' || errorMessage.includes('does not exist')) {
        throw new BadRequestException(
          `La tabla DynamoDB '${tableName}' no existe o no está configurada. ` +
          `Verifica que la variable de entorno DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE esté configurada y que la tabla exista. ` +
          `Error: ${errorMessage}`
        );
      }
      
      if (errorName === 'ValidationException' || errorMessage.includes('validation')) {
        throw new BadRequestException(
          `Error de validación: ${errorMessage}. Verifica que los datos enviados sean correctos.`
        );
      }
      
      const errorDetails = errorCode ? ` (Código: ${errorCode})` : '';
      throw new BadRequestException(
        `Error al aplicar a agencia: ${errorMessage}${errorDetails}. ` +
        `Tipo de error: ${errorName}. ` +
        `Verifica que la tabla '${tableName}' exista y esté configurada correctamente.`
      );
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

      if (!agencyResponse.Item) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const agencyRole = agencyResponse.Item.role?.toLowerCase();
      if (agencyRole !== UserRole.AGENCY) {
        throw new NotFoundException('Agencia no encontrada');
      }

      // Verificar que el modelo existe
      const modelResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: modelId },
        }),
      );

      if (!modelResponse.Item) {
        throw new NotFoundException('Modelo no encontrado');
      }

      const modelRole = modelResponse.Item.role?.toLowerCase();
      if (modelRole !== UserRole.MODEL) {
        throw new NotFoundException('Modelo no encontrado');
      }

      // Verificar si ya existe una relación entre esta agencia y este modelo
      try {
        const existingRelation = await this.dynamoClient.send(
          new GetCommand({
            TableName: this.credentials.dynamodb.modelAgencyRelationsTable,
            Key: {
              modelId,
              agencyId,
            },
          }),
        );

        if (existingRelation.Item) {
          const existingStatus = existingRelation.Item.status;
          throw new ConflictException(
            `Ya existe una relación con este modelo. Estado actual: ${existingStatus}. ` +
            `Si deseas actualizar la relación, contacta al soporte o espera a que se procese la solicitud actual.`
          );
        }
      } catch (error: any) {
        if (error instanceof ConflictException) {
          throw error;
        }
        // Si es otro error (tabla no existe, etc.), continuar e intentar crear
      }

      // Verificar que la tabla está configurada
      const tableName = this.credentials.dynamodb.modelAgencyRelationsTable;
      if (!tableName || tableName.trim() === '') {
        throw new BadRequestException(
          'La tabla DynamoDB para relaciones modelo-agencia no está configurada. ' +
          'Verifica que la variable de entorno DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE esté configurada.'
        );
      }

      // Crear relación
      await this.dynamoClient.send(
        new PutCommand({
          TableName: tableName,
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
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      // Mejorar mensaje de error para debugging - capturar errores específicos de DynamoDB
      const errorName = error.name || error.$metadata?.httpStatusCode || 'Error desconocido';
      const errorCode = error.code || error.$metadata?.requestId || '';
      const errorMessage = error.message || 'Error desconocido al proponer representación';
      const tableName = this.credentials.dynamodb.modelAgencyRelationsTable || 'NO CONFIGURADA';
      
      // Detectar errores específicos de DynamoDB
      if (errorName === 'ResourceNotFoundException' || errorCode === 'ResourceNotFoundException' || errorMessage.includes('does not exist')) {
        throw new BadRequestException(
          `La tabla DynamoDB '${tableName}' no existe o no está configurada. ` +
          `Verifica que la variable de entorno DYNAMODB_MODEL_AGENCY_RELATIONS_TABLE esté configurada y que la tabla exista. ` +
          `Error: ${errorMessage}`
        );
      }
      
      if (errorName === 'ValidationException' || errorMessage.includes('validation')) {
        throw new BadRequestException(
          `Error de validación: ${errorMessage}. Verifica que los datos enviados sean correctos.`
        );
      }
      
      const errorDetails = errorCode ? ` (Código: ${errorCode})` : '';
      throw new BadRequestException(
        `Error al proponer representación: ${errorMessage}${errorDetails}. ` +
        `Tipo de error: ${errorName}. ` +
        `Verifica que la tabla '${tableName}' exista y esté configurada correctamente.`
      );
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
      
      // Normalizar el rol a minúsculas para comparación
      const userRole = user.role?.toLowerCase();

      if (userRole !== UserRole.MODEL) {
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
      
      // Normalizar el rol a minúsculas para comparación
      const userRole = user.role?.toLowerCase();

      if (userRole !== UserRole.AGENCY) {
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
   * Contar modelos gestionados por una agencia (método auxiliar)
   */
  private async getAgencyModelsCount(agencyId: string): Promise<number> {
    try {
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.credentials.dynamodb.modelAgencyRelationsTable,
          IndexName: 'agencyId-status-index',
          KeyConditionExpression: 'agencyId = :agencyId AND #status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':agencyId': agencyId,
            ':status': 'active',
          },
          Select: 'COUNT',
        }),
      );
      return response.Count || 0;
    } catch (error: any) {
      // Si la tabla o índice no existe, retornar 0
      return 0;
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

  /**
   * Seguir a un usuario (puede ser MODEL, USER o AGENCY según reglas de negocio)
   * 
   * REGLAS DE NEGOCIO:
   * - MODEL puede seguir a MODEL, USER y AGENCY
   * - USER puede seguir a USER y MODEL (NO puede seguir AGENCY)
   * - AGENCY puede seguir a MODEL, USER y AGENCY
   */
  async followModel(userId: string, followedUserId: string, followerRole: string) {
    try {
      // Obtener información del usuario que va a seguir
      const followerResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!followerResponse.Item) {
        throw new NotFoundException('Usuario que intenta seguir no encontrado');
      }

      const actualFollowerRole = followerResponse.Item.role?.toLowerCase() || followerRole?.toLowerCase();

      // Verificar que el usuario a seguir existe
      const followedResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: followedUserId },
        }),
      );

      if (!followedResponse.Item) {
        throw new NotFoundException('Usuario a seguir no encontrado');
      }

      const followedRole = followedResponse.Item.role?.toLowerCase();

      // Validar reglas de negocio según el rol del seguidor
      if (actualFollowerRole === 'user') {
        // USER puede seguir a USER y MODEL, pero NO a AGENCY
        if (followedRole === 'agency') {
          throw new ForbiddenException('Los usuarios (USER) no pueden seguir agencias');
        }
        if (followedRole !== 'user' && followedRole !== 'model') {
          throw new BadRequestException(`No puedes seguir a un usuario con rol ${followedRole}`);
        }
      } else if (actualFollowerRole === 'model') {
        // MODEL puede seguir a MODEL, USER y AGENCY
        if (followedRole !== 'user' && followedRole !== 'model' && followedRole !== 'agency') {
          throw new BadRequestException(`No puedes seguir a un usuario con rol ${followedRole}`);
        }
      } else if (actualFollowerRole === 'agency') {
        // AGENCY puede seguir a MODEL, USER y AGENCY
        if (followedRole !== 'user' && followedRole !== 'model' && followedRole !== 'agency') {
          throw new BadRequestException(`No puedes seguir a un usuario con rol ${followedRole}`);
        }
      } else {
        // Otros roles no pueden seguir
        throw new ForbiddenException(`El rol ${actualFollowerRole} no puede seguir usuarios`);
      }

      // Verificar que no se está siguiendo a sí mismo
      if (userId === followedUserId) {
        throw new BadRequestException('No puedes seguirte a ti mismo');
      }

      // Verificar si ya lo sigue
      const followTable = this.credentials.dynamodb.userFollowsTable || 'user_follows';
      try {
        const existingFollow = await this.dynamoClient.send(
          new GetCommand({
            TableName: followTable,
            Key: {
              userId,
              modelId: followedUserId, // Mantenemos modelId para compatibilidad con estructura existente
            },
          }),
        );

        if (existingFollow.Item) {
          // Ya lo sigue, retornar éxito sin duplicar
          return {
            success: true,
            message: 'Ya sigues a este usuario',
            data: {
              userId,
              followedUserId,
              followedRole,
              followedAt: existingFollow.Item.createdAt,
            },
          };
        }
      } catch (error) {
        // Si la tabla no existe, continuar creando
      }

      // Crear relación de follow
      const followRecord = {
        userId,
        modelId: followedUserId, // Mantenemos modelId para compatibilidad con estructura existente
        followedRole, // Guardamos el rol para consultas futuras
        createdAt: new Date().toISOString(),
        createdAtTimestamp: Date.now(),
      };

      await this.dynamoClient.send(
        new PutCommand({
          TableName: followTable,
          Item: followRecord,
        }),
      );

      // Invalidar caché del feed del usuario
      await this.cacheService.invalidatePattern(`feed:${userId}:*`);

      return {
        success: true,
        message: `Ahora sigues a este ${followedRole === 'model' ? 'modelo' : followedRole === 'user' ? 'usuario' : 'agencia'}`,
        data: {
          userId,
          followedUserId,
          followedRole,
          followedAt: followRecord.createdAt,
        },
      };
    } catch (error: any) {
      console.log('❌ [followModel] ERROR CAPTURADO:', {
        errorName: error?.name || 'Unknown',
        errorCode: error?.code || 'NO_CODE',
        errorMessage: error?.message || 'No message',
        errorStack: error?.stack?.substring(0, 200) || 'No stack',
        isNotFoundException: error instanceof NotFoundException,
        isBadRequestException: error instanceof BadRequestException,
        isForbiddenException: error instanceof ForbiddenException,
      });
      
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      
      // Mejorar mensaje de error para debugging - capturar errores específicos de DynamoDB
      const errorName = error.name || error.$metadata?.httpStatusCode || 'Error desconocido';
      const errorCode = error.code || error.$metadata?.requestId || '';
      const errorMessage = error.message || 'Error desconocido al seguir usuario';
      const tableName = this.credentials.dynamodb.userFollowsTable || 'NO CONFIGURADA';
      
      // Detectar errores específicos de DynamoDB
      if (errorName === 'ResourceNotFoundException' || errorCode === 'ResourceNotFoundException' || errorMessage.includes('does not exist')) {
        throw new BadRequestException(
          `La tabla DynamoDB '${tableName}' no existe o no está configurada. ` +
          `Verifica que la variable de entorno DYNAMODB_USER_FOLLOWS_TABLE esté configurada y que la tabla exista. ` +
          `Error: ${errorMessage}`
        );
      }
      
      if (errorName === 'ValidationException' || errorMessage.includes('validation')) {
        throw new BadRequestException(
          `Error de validación: ${errorMessage}. Verifica que los datos enviados sean correctos.`
        );
      }
      
      const errorDetails = errorCode ? ` (Código: ${errorCode})` : '';
      throw new BadRequestException(`Error al seguir usuario: ${errorMessage}${errorDetails}`);
    }
  }

  /**
   * Dejar de seguir a un usuario (puede ser MODEL, USER o AGENCY)
   */
  async unfollowModel(userId: string, followedUserId: string) {
    try {
      const followTable = this.credentials.dynamodb.userFollowsTable || 'user_follows';
      
      // Verificar que existe la relación
      const existingFollow = await this.dynamoClient.send(
        new GetCommand({
          TableName: followTable,
          Key: {
            userId,
            modelId: followedUserId, // Mantenemos modelId para compatibilidad
          },
        }),
      );

      if (!existingFollow.Item) {
        throw new NotFoundException('No estás siguiendo a este usuario');
      }

      // Obtener el rol del usuario seguido para el mensaje
      let followedRole = 'usuario';
      try {
        const followedResponse = await this.dynamoClient.send(
          new GetCommand({
            TableName: this.credentials.dynamodb.usersTable,
            Key: { id: followedUserId },
          }),
        );
        if (followedResponse.Item) {
          const role = followedResponse.Item.role?.toLowerCase();
          if (role === 'model' || role === 'MODEL') {
            followedRole = 'modelo';
          } else if (role === 'agency' || role === 'AGENCY') {
            followedRole = 'agencia';
          }
        }
      } catch (error) {
        // Si no se puede obtener, usar genérico
      }

      // Eliminar relación
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: followTable,
          Key: {
            userId,
            modelId: followedUserId, // Mantenemos modelId para compatibilidad
          },
        }),
      );

      // Invalidar caché del feed del usuario
      await this.cacheService.invalidatePattern(`feed:${userId}:*`);

      return {
        success: true,
        message: `Dejaste de seguir a este ${followedRole}`,
      };
    } catch (error: any) {
      console.log('❌ [unfollowModel] ERROR CAPTURADO:', {
        errorName: error?.name || 'Unknown',
        errorCode: error?.code || 'NO_CODE',
        errorMessage: error?.message || 'No message',
        isNotFoundException: error instanceof NotFoundException,
      });
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Mejorar mensaje de error para debugging
      const errorName = error.name || error.$metadata?.httpStatusCode || 'Error desconocido';
      const errorCode = error.code || error.$metadata?.requestId || '';
      const errorMessage = error.message || 'Error desconocido al dejar de seguir usuario';
      const tableName = this.credentials.dynamodb.userFollowsTable || 'NO CONFIGURADA';
      
      // Detectar errores específicos de DynamoDB
      if (errorName === 'ResourceNotFoundException' || errorCode === 'ResourceNotFoundException' || errorMessage.includes('does not exist')) {
        throw new BadRequestException(
          `La tabla DynamoDB '${tableName}' no existe o no está configurada. ` +
          `Verifica que la variable de entorno DYNAMODB_USER_FOLLOWS_TABLE esté configurada y que la tabla exista. ` +
          `Error: ${errorMessage}`
        );
      }
      
      const errorDetails = errorCode ? ` (Código: ${errorCode})` : '';
      throw new BadRequestException(`Error al dejar de seguir usuario: ${errorMessage}${errorDetails}`);
    }
  }

  /**
   * Obtener lista de usuarios que sigue (pueden ser MODEL, USER o AGENCY)
   */
  async getFollowing(userId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const followTable = this.credentials.dynamodb.userFollowsTable || 'user_follows';

      // Consultar follows del usuario
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: followTable,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          ScanIndexForward: false, // Más recientes primero
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

      // Obtener información de los usuarios seguidos (pueden ser MODEL, USER o AGENCY)
      const followedUserIds = response.Items.map((item) => item.modelId); // modelId contiene el ID del usuario seguido
      const followedUsers = await Promise.all(
        followedUserIds.map(async (followedUserId) => {
          try {
            const userResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.usersTable,
                Key: { id: followedUserId },
              }),
            );
            const profileResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.userProfilesTable,
                Key: { userId: followedUserId },
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

      // Filtrar nulos y construir respuesta
      const following = followedUsers
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .slice(skip, skip + limit)
        .map((user: any) => ({
          userId: user.id || user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          verified: user.verified || false,
          bio: user.profile?.bio,
          avatarUrl: user.profile?.avatarUrl,
          country: user.profile?.country,
          reputation: user.profile?.reputation || 0,
          createdAt: user.createdAt,
        }));

      return {
        success: true,
        data: following,
        pagination: {
          page,
          limit,
          total: followedUserIds.length,
          totalPages: Math.ceil(followedUserIds.length / limit),
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
   * Obtener lista de seguidores de un usuario (puede ser MODEL, USER o AGENCY)
   */
  async getFollowers(userId: string, page: number = 1, limit: number = 20) {
    try {
      // Verificar que el usuario existe
      const userResponse = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Key: { id: userId },
        }),
      );

      if (!userResponse.Item) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const skip = (page - 1) * limit;
      const followTable = this.credentials.dynamodb.userFollowsTable || 'user_follows';

      // Consultar seguidores del usuario (requiere GSI modelId-index)
      // Nota: modelId en la tabla contiene el ID del usuario seguido
      const response = await this.dynamoClient.send(
        new QueryCommand({
          TableName: followTable,
          IndexName: 'modelId-index',
          KeyConditionExpression: 'modelId = :modelId',
          ExpressionAttributeValues: {
            ':modelId': userId,
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

      // Obtener información de los seguidores
      const followerIds = response.Items.map((item) => item.userId);
      const followers = await Promise.all(
        followerIds.map(async (followerId) => {
          try {
            const userResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.usersTable,
                Key: { id: followerId },
              }),
            );
            const profileResponse = await this.dynamoClient.send(
              new GetCommand({
                TableName: this.credentials.dynamodb.userProfilesTable,
                Key: { userId: followerId },
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
      const followersList = followers
        .filter((follower): follower is NonNullable<typeof follower> => follower !== null)
        .slice(skip, skip + limit)
        .map((follower: any) => ({
          userId: follower.id || follower.userId,
          email: follower.email,
          fullName: follower.fullName,
          avatarUrl: follower.profile?.avatarUrl,
          createdAt: follower.createdAt,
        }));

      return {
        success: true,
        data: followersList,
        pagination: {
          page,
          limit,
          total: followerIds.length,
          totalPages: Math.ceil(followerIds.length / limit),
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
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
   * Obtener estadísticas del buyer
   */
  async getBuyerStats(buyerId: string) {
    try {
      // Obtener total gastado desde payment-service
      let totalSpent = 0;
      let packsPurchased = 0;
      let activeSubscriptions = 0;
      let totalTips = 0;

      try {
        // Calcular desde DynamoDB directamente
        const paymentsTable = this.credentials.dynamodb.paymentsTable;
        if (paymentsTable) {
          const paymentsResponse = await this.dynamoClient.send(
            new QueryCommand({
              TableName: paymentsTable,
              IndexName: 'userId-createdAt-index',
              KeyConditionExpression: 'userId = :userId',
              FilterExpression: '#status = :succeeded',
              ExpressionAttributeNames: {
                '#status': 'status',
              },
              ExpressionAttributeValues: {
                ':userId': buyerId,
                ':succeeded': 'succeeded',
              },
            }),
          );

          const payments = paymentsResponse.Items || [];
          totalSpent = payments.reduce((sum, p: any) => sum + (p.amount || 0), 0);
          packsPurchased = payments.filter((p: any) => 
            p.metadata?.packId || p.metadata?.type === 'pack_purchase'
          ).length;
          totalTips = payments.filter((p: any) => p.type === 'tip').length;
        }

        // Obtener suscripciones activas
        const subscriptionsTable = this.credentials.dynamodb.subscriptionsTable;
        if (subscriptionsTable) {
          const subscriptionsResponse = await this.dynamoClient.send(
            new QueryCommand({
              TableName: subscriptionsTable,
              IndexName: 'userId-createdAt-index',
              KeyConditionExpression: 'userId = :userId',
              FilterExpression: '#status IN (:active, :trialing)',
              ExpressionAttributeNames: {
                '#status': 'status',
              },
              ExpressionAttributeValues: {
                ':userId': buyerId,
                ':active': 'active',
                ':trialing': 'trialing',
              },
            }),
          );
          activeSubscriptions = subscriptionsResponse.Items?.length || 0;
        }
      } catch (error) {
        // Si hay error, continuar con valores en 0
      }

      // Obtener modelos que sigue
      let modelsFollowing = 0;
      try {
        const followTable = this.credentials.dynamodb.userFollowsTable || 'user_follows';
        const followResponse = await this.dynamoClient.send(
          new QueryCommand({
            TableName: followTable,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':userId': buyerId,
            },
            Select: 'COUNT',
          }),
        );
        modelsFollowing = followResponse.Count || 0;
      } catch (error) {
        // Si la tabla no existe, continuar con 0
      }

      return {
        success: true,
        data: {
          totalSpent: totalSpent / 100, // Convertir de centavos a dólares
          packsPurchased,
          activeSubscriptions,
          modelsFollowing,
          totalTips,
        },
      };
    } catch (error: any) {
      throw new BadRequestException(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Búsqueda global
   */
  async globalSearch(
    query: string,
    type: 'models' | 'packs' | 'users' | 'all' = 'all',
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const skip = (page - 1) * limit;
      const results: any = {
        models: [],
        packs: [],
        users: [],
      };

      // Buscar modelos
      if (type === 'all' || type === 'models') {
        const modelsQuery = await this.listModels({
          search: query,
          page: 1,
          limit: 100, // Obtener más para luego paginar
        });
        results.models = modelsQuery.data || [];
      }

      // Buscar packs (requiere llamar a content-service)
      if (type === 'all' || type === 'packs') {
        try {
          const packsTable = this.credentials.dynamodb.packsTable;
          if (packsTable) {
            const packsResponse = await this.dynamoClient.send(
              new ScanCommand({
                TableName: packsTable,
                FilterExpression: 'contains(#name, :query) OR contains(description, :query) AND #status = :active',
                ExpressionAttributeNames: {
                  '#name': 'name',
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':query': query.toLowerCase(),
                  ':active': 'active',
                },
              }),
            );
            results.packs = (packsResponse.Items || []).slice(0, limit);
          }
        } catch (error) {
          // Si hay error, continuar sin packs
        }
      }

      // Buscar usuarios (solo buyers y modelos públicos)
      // Buscar por nombre o alias, NO por email
      if (type === 'all' || type === 'users') {
        // Normalizar query: si viene con @, mantenerlo; si no, buscar en ambos campos
        const queryNormalized = query.toLowerCase().trim();
        const queryWithoutAt = queryNormalized.startsWith('@') ? queryNormalized.substring(1) : queryNormalized;
        
        const usersResponse = await this.dynamoClient.send(
          new ScanCommand({
            TableName: this.credentials.dynamodb.usersTable,
            // Buscar en fullName o en alias (con o sin @)
            FilterExpression: 'contains(fullName, :query) OR contains(#alias, :query) OR contains(#alias, :queryWithoutAt)',
            ExpressionAttributeNames: {
              '#alias': 'alias',
            },
            ExpressionAttributeValues: {
              ':query': query,
              ':queryWithoutAt': queryWithoutAt,
            },
            Limit: limit,
          }),
        );
        
        // Filtrar en memoria también para asegurar normalización case-insensitive
        const queryLower = query.toLowerCase();
        results.users = (usersResponse.Items || []).filter((user: any) => {
          const fullName = ((user.fullName || '') as string).toLowerCase().trim();
          const alias = ((user.alias || '') as string).toLowerCase().trim();
          const aliasWithoutAt = alias.startsWith('@') ? alias.substring(1) : alias;
          const queryNormalized = queryLower.startsWith('@') ? queryLower.substring(1) : queryLower;
          return fullName.includes(queryNormalized) || 
                 alias.includes(queryLower) || 
                 aliasWithoutAt.includes(queryNormalized);
        }).map((user: any) => ({
          userId: user.id || user.userId,
          fullName: user.fullName,
          email: user.email,
          alias: user.alias,
          role: user.role,
          avatarUrl: user.avatarUrl,
        }));
      }

      // Aplicar paginación a cada tipo
      if (type === 'all') {
        // Combinar y ordenar por relevancia (simplificado)
        const allResults = [
          ...results.models.map((m: any) => ({ ...m, resultType: 'model' })),
          ...results.packs.map((p: any) => ({ ...p, resultType: 'pack' })),
          ...results.users.map((u: any) => ({ ...u, resultType: 'user' })),
        ];
        const paginated = allResults.slice(skip, skip + limit);

        return {
          success: true,
          data: paginated,
          pagination: {
            page,
            limit,
            total: allResults.length,
            totalPages: Math.ceil(allResults.length / limit),
          },
        };
      } else {
        // Retornar solo el tipo solicitado
        const typeResults = results[type] || [];
        const paginated = typeResults.slice(skip, skip + limit);

        return {
          success: true,
          data: paginated,
          pagination: {
            page,
            limit,
            total: typeResults.length,
            totalPages: Math.ceil(typeResults.length / limit),
          },
        };
      }
    } catch (error: any) {
      throw new BadRequestException(`Error en búsqueda: ${error.message}`);
    }
  }

}





