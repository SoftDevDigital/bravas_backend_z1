import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../common/logger/logger.service';
import { loadCredentials } from '@bravas/shared';

@Injectable()
export class AdminUsersService {
  private readonly userServiceUrl: string;
  private readonly logger: LoggerService;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    const credentials = loadCredentials();
    this.userServiceUrl = process.env.USER_SERVICE_URL || credentials.api.baseUrl?.replace('/api/v1', '') + '/api/v1' || 'http://localhost:3001/api/v1';
    this.logger = LoggerService.create('AdminUsersService', configService);
  }

  /**
   * Listar usuarios con filtros
   */
  async listUsers(query: any, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users`, {
          params: query,
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al listar usuarios', error?.stack, 'listUsers', {
        error: error.message,
        query,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al listar usuarios',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId: string, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al obtener usuario', error?.stack, 'getUserById', {
        userId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al obtener usuario',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId: string, updateData: any, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.put(`${this.userServiceUrl}/users/${userId}`, updateData, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al actualizar usuario', error?.stack, 'updateUser', {
        userId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al actualizar usuario',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Aprobar usuario
   */
  async approveUser(userId: string, notes: string | undefined, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.userServiceUrl}/users/${userId}/approve`,
          { notes },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al aprobar usuario', error?.stack, 'approveUser', {
        userId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al aprobar usuario',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Suspender usuario
   */
  async suspendUser(userId: string, reason: string, durationDays: number | undefined, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.userServiceUrl}/users/${userId}`,
          {
            status: 'suspended',
            reason,
            suspendedUntil: durationDays
              ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al suspender usuario', error?.stack, 'suspendUser', {
        userId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al suspender usuario',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Banear usuario
   */
  async banUser(userId: string, reason: string, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.userServiceUrl}/users/${userId}`,
          {
            status: 'banned',
            reason,
          },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al banear usuario', error?.stack, 'banUser', {
        userId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al banear usuario',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUser(userId: string, adminToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.delete(`${this.userServiceUrl}/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error al eliminar usuario', error?.stack, 'deleteUser', {
        userId,
        error: error.message,
      });
      throw new HttpException(
        error.response?.data?.message || 'Error al eliminar usuario',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}


