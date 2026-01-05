import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { AdminUsersService } from '../services/admin-users.service';
import {
  ListUsersDto,
  UpdateUserStatusDto,
  ApproveUserDto,
  SuspendUserDto,
  BanUserDto,
} from '../dto/users.dto';
import { getUserFromToken, requireAdmin } from '../helpers/auth.helper';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('admin-users')
@Controller('admin/users')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  private readonly logger: LoggerService;

  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('UsersController', configService);
  }

  /**
   * GET /admin/users
   * Listar usuarios (admin)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuarios',
    description: 'Lista todos los usuarios con filtros opcionales. Solo administradores.',
  })
  @ApiResponse({ status: 200, description: 'Usuarios listados exitosamente' })
  async listUsers(@Query() query: ListUsersDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.listUsers(query, req.token);
  }

  /**
   * GET /admin/users/:id
   * Obtener usuario por ID (admin)
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Obtiene información completa de un usuario. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario obtenido exitosamente' })
  async getUserById(@Param('id') userId: string, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.getUserById(userId, req.token);
  }

  /**
   * PUT /admin/users/:id
   * Actualizar usuario (admin)
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: 'Actualiza información de un usuario. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateDto: any,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.updateUser(userId, updateDto, req.token);
  }

  /**
   * POST /admin/users/:id/approve
   * Aprobar usuario (admin)
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar usuario',
    description: 'Aprueba la verificación de un usuario. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario aprobado exitosamente' })
  async approveUser(
    @Param('id') userId: string,
    @Body() approveDto: ApproveUserDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.approveUser(userId, approveDto.notes, req.token);
  }

  /**
   * POST /admin/users/:id/suspend
   * Suspender usuario (admin)
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspender usuario',
    description: 'Suspende temporalmente un usuario. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario suspendido exitosamente' })
  async suspendUser(
    @Param('id') userId: string,
    @Body() suspendDto: SuspendUserDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.suspendUser(userId, suspendDto.reason, suspendDto.durationDays, req.token);
  }

  /**
   * POST /admin/users/:id/ban
   * Banear usuario (admin)
   */
  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Banear usuario',
    description: 'Banea permanentemente un usuario. Solo administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario baneado exitosamente' })
  async banUser(
    @Param('id') userId: string,
    @Body() banDto: BanUserDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.banUser(userId, banDto.reason, req.token);
  }

  /**
   * DELETE /admin/users/:id
   * Eliminar usuario (admin)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar usuario',
    description: 'Elimina (soft delete) un usuario. Solo super administradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  async deleteUser(@Param('id') userId: string, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    requireAdmin(userInfo.role);

    return this.adminUsersService.deleteUser(userId, req.token);
  }
}








