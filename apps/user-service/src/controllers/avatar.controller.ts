import {
  Controller,
  Post,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { AvatarService } from '../services/avatar.service';
import { UploadAvatarResponseDto } from '../dtos/upload-avatar.dto';
import { getUserFromToken } from '../helpers/auth.helper';
import { UserService } from '../user.service';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

/**
 * Controlador para gestión de avatares
 */
@ApiTags('avatars')
@Controller('users/me/avatar')
export class AvatarController {
  private readonly logger: LoggerService;

  constructor(
    private readonly avatarService: AvatarService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    this.logger = LoggerService.create('AvatarController', this.configService);
  }

  /**
   * POST /users/me/avatar
   * Subir avatar del usuario
   * 
   * **CASOS DE USO:**
   * - Cambiar foto de perfil
   * - Actualizar avatar después de registro
   * - Subir nueva imagen de perfil
   * 
   * **CARACTERÍSTICAS:**
   * - Genera 4 tamaños automáticamente (thumbnail, small, medium, large)
   * - Optimiza imagen con Sharp
   * - Valida tipo y tamaño
   * - Modera contenido automáticamente con Rekognition
   */
  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📸 Subir avatar',
    description: `
**¿Para qué sirve?**
Permite al usuario autenticado subir una imagen como avatar de perfil.

**Casos de uso:**
- Cambiar foto de perfil del usuario
- Actualizar avatar después del registro
- Subir nueva imagen de perfil

**Características automáticas:**
- ✅ Genera 4 tamaños automáticamente:
  - \`thumbnail\`: 150x150px (para listados)
  - \`small\`: 300x300px (para tarjetas)
  - \`medium\`: 600x600px (perfil principal)
  - \`large\`: 1200x1200px (alta resolución)
- ✅ Optimiza imagen automáticamente (JPEG calidad 85%, progressive)
- ✅ Valida tipo de archivo (JPEG, PNG, WebP)
- ✅ Valida tamaño máximo (5MB)
- ✅ Modera contenido automáticamente con AWS Rekognition
- ✅ Sube a S3 con URLs públicas

**Proceso automático:**
1. Usuario sube imagen
2. Sistema valida archivo (tipo, tamaño)
3. Genera múltiples tamaños automáticamente
4. Optimiza imágenes con Sharp
5. Sube todas las versiones a S3
6. Rekognition modera contenido automáticamente
7. Retorna URLs de todos los tamaños

**Ejemplo de uso:**
\`\`\`
POST /users/me/avatar
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [archivo de imagen]
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "avatarUrl": "https://cdn.bravas.com/avatars/user123/medium-1234567890.jpg",
  "thumbnailUrl": "https://cdn.bravas.com/avatars/user123/thumbnail-1234567890.jpg",
  "sizes": {
    "thumbnail": "https://cdn.bravas.com/avatars/user123/thumbnail-1234567890.jpg",
    "small": "https://cdn.bravas.com/avatars/user123/small-1234567890.jpg",
    "medium": "https://cdn.bravas.com/avatars/user123/medium-1234567890.jpg",
    "large": "https://cdn.bravas.com/avatars/user123/large-1234567890.jpg"
  }
}
\`\`\`

**Validaciones:**
- ✅ Tipo de archivo: JPEG, PNG o WebP
- ✅ Tamaño máximo: 5MB
- ✅ Moderación automática con Rekognition
- ❌ Si contenido inapropiado → Rechazado automáticamente

**Notas importantes:**
- El avatar anterior se mantiene hasta que se suba uno nuevo
- Las URLs tienen expiración larga (1 año) o usan CloudFront
- La moderación es automática y en background
- Si la moderación falla, el avatar se aprueba por defecto (requiere revisión manual)
    `.trim(),
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen (JPEG, PNG o WebP, máximo 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar subido exitosamente',
    type: UploadAvatarResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o demasiado grande',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Request() req: any,
    @UploadedFile() file: any,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No se proporcionó ningún archivo. Por favor, selecciona una imagen.');
      }

      const userInfo = await getUserFromToken(req.token);
      const result = await this.avatarService.uploadAvatar(userInfo.userId, file);

      // Actualizar avatarUrl en perfil del usuario
      try {
        await this.userService.updateMyProfile(userInfo.userId, userInfo.email, {
          avatarUrl: result.avatarUrl,
        });
      } catch (updateError: any) {
        // Log error pero no fallar la subida del avatar
        this.logger.error('Error al actualizar avatarUrl en perfil', updateError?.stack, 'AvatarController', { userId: userInfo.userId, error: updateError.message });
      }

      return result;
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      throw new BadRequestException(`Error al subir avatar: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * DELETE /users/me/avatar
   * Eliminar avatar del usuario
   * 
   * **Endpoint Privado** - Requiere autenticación
   */
  @Delete()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🗑️ Eliminar avatar',
    description: `
**¿Para qué sirve?**
Elimina el avatar del usuario autenticado y todas sus versiones (thumbnail, small, medium, large).

**Casos de uso:**
- Remover foto de perfil del usuario
- Restablecer avatar por defecto
- Eliminar avatar antes de subir uno nuevo

**Proceso:**
1. Elimina todas las versiones del avatar de S3
2. Actualiza perfil del usuario (avatarUrl = null)
3. Retorna confirmación de eliminación

**Ejemplo de uso:**
\`\`\`
DELETE /users/me/avatar
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "message": "Avatar eliminado exitosamente"
}
\`\`\`

**Notas:**
- Elimina todas las versiones del avatar (thumbnail, small, medium, large)
- El perfil se actualiza automáticamente (avatarUrl = null)
- No se puede deshacer la eliminación
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: '✅ Avatar eliminado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Avatar no encontrado',
  })
  async deleteAvatar(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      await this.avatarService.deleteAvatar(userInfo.userId);

      // Actualizar avatarUrl en perfil a null
      try {
        await this.userService.updateMyProfile(userInfo.userId, userInfo.email, {
          avatarUrl: null,
        });
      } catch (updateError) {
        // Log error pero no fallar la eliminación del avatar
        console.error('Error al actualizar avatarUrl en perfil:', updateError);
      }

      return {
        success: true,
        message: 'Avatar eliminado exitosamente',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      throw new BadRequestException(`Error al eliminar avatar: ${error.message || 'Error desconocido'}`);
    }
  }
}

