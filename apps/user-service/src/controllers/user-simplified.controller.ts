import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard, UserRole } from '@bravas/shared';
import { UserService } from '../user.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersDto } from '../dto/list-users.dto';
import { MarketplaceQueryDto } from '../dto/marketplace.dto';
import { getUserFromToken } from '../helpers/auth.helper';

/**
 * Controlador Simplificado del User Service
 * 
 * Endpoints consolidados y simplificados:
 * - Un solo endpoint para perfiles (detecta tipo automáticamente)
 * - Un solo endpoint para marketplace (filtra por tipo)
 * - Endpoint unificado para acciones de admin
 * - Subrecursos bajo /me para recursos del usuario autenticado
 */
@ApiTags('users')
@Controller('users')
export class UserSimplifiedController {
  constructor(private readonly userService: UserService) {}

  // ============================================
  // ENDPOINTS PÚBLICOS
  // ============================================

  /**
   * GET /users
   * Listar usuarios o marketplace según query params
   * 
   * Si `type=models|agencies` → Marketplace
   * Si `admin=true` → Lista de usuarios (solo admins)
   * Si `id` → Perfil específico
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuarios o marketplace',
    description: 'Endpoint unificado que puede: ' +
      '1. Listar marketplace (type=models|agencies) ' +
      '2. Listar usuarios como admin (admin=true) ' +
      '3. Obtener perfil por ID (id=userId)',
  })
  @ApiQuery({ name: 'type', required: false, enum: ['models', 'agencies'], description: 'Tipo para marketplace' })
  @ApiQuery({ name: 'admin', required: false, type: Boolean, description: 'Lista de usuarios (solo admins)' })
  @ApiQuery({ name: 'id', required: false, description: 'ID de usuario para perfil específico' })
  @ApiResponse({ status: 200, description: 'Datos obtenidos exitosamente' })
  async getUsers(
    @Query() query: any,
    @Request() req: any,
  ) {
    // Si hay ID, obtener perfil específico
    if (query.id) {
      let requesterRole: UserRole | undefined;
      try {
        if (req.headers.authorization) {
          const token = req.headers.authorization.split(' ')[1];
          const userInfo = await getUserFromToken(token);
          requesterRole = userInfo.role as UserRole;
        }
      } catch (error) {
        // Continuar sin rol
      }

      // Detectar tipo automáticamente consultando el usuario
      const user = await this.userService.getPublicProfile(query.id, requesterRole);
      if (user.data?.role === 'MODEL') {
        return this.userService.getModelProfile(query.id, requesterRole);
      } else if (user.data?.role === 'AGENCY') {
        return this.userService.getAgencyProfile(query.id, requesterRole);
      }
      return user;
    }

    // Si es admin, listar usuarios
    if (query.admin === 'true' || query.admin === true) {
      const userInfo = await getUserFromToken(req.headers.authorization?.split(' ')[1] || '');
      if (!userInfo.role?.toString().startsWith('ADMIN')) {
        throw new ForbiddenException('Solo administradores');
      }
      return this.userService.listUsers(query as ListUsersDto, userInfo.role as UserRole);
    }

    // Si hay type, marketplace
    if (query.type === 'models') {
      return this.userService.listModels(query as MarketplaceQueryDto);
    }
    if (query.type === 'agencies') {
      return this.userService.listAgencies(query as MarketplaceQueryDto);
    }

    // Por defecto, marketplace de modelos
    return this.userService.listModels(query as MarketplaceQueryDto);
  }

  /**
   * GET /users/:id
   * Obtener perfil (detecta tipo automáticamente)
   * 
   * Detecta si es modelo, agencia o usuario normal y retorna el perfil apropiado
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener perfil de usuario',
    description: 'Retorna el perfil del usuario. Detecta automáticamente si es modelo, agencia o usuario normal.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getProfile(
    @Param('id') userId: string,
    @Request() req: any,
  ) {
    let requesterRole: UserRole | undefined;
    try {
      if (req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1];
        const userInfo = await getUserFromToken(token);
        requesterRole = userInfo.role as UserRole;
      }
    } catch (error) {
      // Continuar sin rol
    }

    // Obtener perfil básico para detectar tipo
    const publicProfile = await this.userService.getPublicProfile(userId, requesterRole);
    const role = publicProfile.data?.role;

    // Retornar perfil específico según el rol
    if (role === 'MODEL') {
      return this.userService.getModelProfile(userId, requesterRole);
    } else if (role === 'AGENCY') {
      return this.userService.getAgencyProfile(userId, requesterRole);
    }

    return publicProfile;
  }

  // ============================================
  // ENDPOINTS DEL USUARIO AUTENTICADO (/me)
  // ============================================

  /**
   * GET /users/me
   * Obtener mi perfil completo
   * 
   * Query params opcionales:
   * - ?stats=true → Incluir estadísticas
   * - ?buyers=true → Listar compradores (solo modelos)
   * - ?models=true → Listar modelos gestionados (solo agencias)
   */
  @Get('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener mi perfil y recursos',
    description: 'Endpoint unificado para obtener perfil y recursos del usuario autenticado. ' +
      'Usa query params para incluir: stats, buyers (modelos), models (agencias)',
  })
  @ApiQuery({ name: 'stats', required: false, type: Boolean, description: 'Incluir estadísticas' })
  @ApiQuery({ name: 'buyers', required: false, type: Boolean, description: 'Listar compradores (solo modelos)' })
  @ApiQuery({ name: 'models', required: false, type: Boolean, description: 'Listar modelos gestionados (solo agencias)' })
  @ApiResponse({ status: 200, description: 'Datos obtenidos exitosamente' })
  async getMe(
    @Request() req: any,
    @Query('stats') includeStats?: string,
    @Query('buyers') includeBuyers?: string,
    @Query('models') includeModels?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const result: any = {
      profile: await this.userService.getMyProfile(userInfo.userId, userInfo.email),
    };

    // Incluir estadísticas si se solicita
    if (includeStats === 'true') {
      result.stats = await this.userService.getMyStats(userInfo.userId, userInfo.email, {});
    }

    // Incluir compradores si es modelo
    if (includeBuyers === 'true' && userInfo.role === 'MODEL') {
      result.buyers = await this.userService.getMyBuyers(
        userInfo.userId,
        parseInt(page || '1'),
        parseInt(limit || '20')
      );
    }

    // Incluir modelos si es agencia
    if (includeModels === 'true' && userInfo.role === 'AGENCY') {
      result.models = await this.userService.getMyModels(
        userInfo.userId,
        parseInt(page || '1'),
        parseInt(limit || '20')
      );
    }

    return result;
  }

  /**
   * PUT /users/me
   * Actualizar mi perfil
   */
  @Put('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente' })
  async updateMe(@Request() req: any, @Body() updateDto: UpdateUserDto) {
    const userInfo = await getUserFromToken(req.token);
    return this.userService.updateMyProfile(userInfo.userId, userInfo.email, updateDto);
  }

  // ============================================
  // ENDPOINTS DE ADMIN (consolidados)
  // ============================================

  /**
   * POST /users/:id/action
   * Acciones de admin sobre usuarios
   * 
   * Actions disponibles:
   * - approve: Aprobar usuario
   * - verify-payment: Verificar pago
   * - delete: Eliminar usuario (solo super admins)
   * - update: Actualizar usuario
   */
  @Post(':id/action')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Acción de admin sobre usuario',
    description: 'Endpoint unificado para acciones de administrador. ' +
      'Actions: approve, verify-payment, delete, update',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['approve', 'verify-payment', 'delete', 'update'],
          description: 'Acción a realizar',
        },
        data: {
          type: 'object',
          description: 'Datos adicionales según la acción',
        },
      },
      required: ['action'],
    },
  })
  @ApiResponse({ status: 200, description: 'Acción ejecutada exitosamente' })
  async adminAction(
    @Param('id') userId: string,
    @Body() body: { action: string; data?: any },
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const role = userInfo.role as UserRole;

    if (!role?.toString().startsWith('ADMIN')) {
      throw new ForbiddenException('Solo administradores');
    }

    switch (body.action) {
      case 'approve':
        return this.userService.updateUser(userId, { verified: true }, role);

      case 'verify-payment':
        if (!body.data?.paymentProofId) {
          throw new ForbiddenException('paymentProofId requerido');
        }
        return this.userService.verifyPayment(userId, body.data.paymentProofId, userInfo.userId);

      case 'delete':
        if (role !== UserRole.ADMIN_LEVEL_3) {
          throw new ForbiddenException('Solo super administradores pueden eliminar');
        }
        return this.userService.deleteUser(userId, role);

      case 'update':
        if (!body.data) {
          throw new ForbiddenException('data requerido para update');
        }
        return this.userService.updateUser(userId, body.data, role);

      default:
        throw new ForbiddenException(`Acción no válida: ${body.action}`);
    }
  }

  /**
   * PUT /users/:id
   * Actualizar usuario (admin) - Mantenido para compatibilidad
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar usuario (Admin)' })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateDto: UpdateUserDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    return this.userService.updateUser(userId, updateDto, userInfo.role as UserRole);
  }

  /**
   * GET /users/stats
   * Estadísticas generales (admin)
   */
  @Get('stats')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Estadísticas generales (Solo Admins)' })
  async getStats(@Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    if (!userInfo.role?.toString().startsWith('ADMIN')) {
      throw new ForbiddenException('Solo administradores');
    }
    return this.userService.getPlatformStats();
  }

  // ============================================
  // ENDPOINTS DE RELACIONES (simplificados)
  // ============================================

  /**
   * POST /users/:id/relation
   * Crear relación con otro usuario
   * 
   * Types: apply (modelo → agencia), propose (agencia → modelo), contact (agencia → agencia)
   */
  @Post(':id/relation')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crear relación con usuario',
    description: 'Endpoint unificado para relaciones. Types: apply, propose, contact',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario objetivo' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['apply', 'propose', 'contact'],
          description: 'Tipo de relación',
        },
        message: { type: 'string' },
        terms: { type: 'string' },
      },
      required: ['type', 'message'],
    },
  })
  @ApiResponse({ status: 201, description: 'Relación creada exitosamente' })
  async createRelation(
    @Param('id') targetId: string,
    @Body() body: { type: string; message: string; terms?: string },
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const role = userInfo.role;

    switch (body.type) {
      case 'apply':
        if (role !== 'MODEL') {
          throw new ForbiddenException('Solo modelos pueden aplicar');
        }
        return this.userService.applyToAgency(userInfo.userId, targetId, body.message);

      case 'propose':
        if (role !== 'AGENCY') {
          throw new ForbiddenException('Solo agencias pueden proponer');
        }
        return this.userService.proposeRepresentation(userInfo.userId, targetId, body.message, body.terms);

      case 'contact':
        if (role !== 'AGENCY') {
          throw new ForbiddenException('Solo agencias pueden contactar');
        }
        return { success: true, message: 'Mensaje enviado exitosamente' };

      default:
        throw new ForbiddenException(`Tipo de relación no válido: ${body.type}`);
    }
  }

  // ============================================
  // ENDPOINTS DE SUPPORT
  // ============================================

  /**
   * PUT /users/:id/notes
   * Agregar notas de soporte
   */
  @Put(':id/notes')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Agregar notas de soporte' })
  async addNotes(
    @Param('id') userId: string,
    @Body() body: { notes: string },
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const role = userInfo.role?.toString() || '';
    
    if (!role.startsWith('ADMIN') && role !== 'SUPPORT') {
      throw new ForbiddenException('Solo support o admins');
    }

    return this.userService.addSupportNotes(userId, body.notes, userInfo.userId);
  }
}

