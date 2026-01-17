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
  HttpException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiExcludeEndpoint,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard, UserRole, RolesGuard } from '@bravas/shared';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { MarketplaceQueryDto } from './dto/marketplace.dto';
import { ApplyAgencyDto, ProposeRepresentationDto, ContactAgencyDto } from './dto/relation.dto';
import { UpdateUserStatusDto, ApproveUserDto, SupportNotesDto } from './dto/admin.dto';
import { StatsQueryDto } from './dto/stats.dto';
import { FollowModelDto } from './dto/follow.dto';
import { UpdateAvailabilityDto } from './dto/availability.dto';
import { getUserFromToken } from './helpers/auth.helper';
import {
  ApiResponseDto,
  UserProfileDto,
  ModelProfileDto,
  AgencyProfileDto,
  UserStatsDto,
  PlatformStatsDto,
  BuyerDto,
  ManagedModelDto,
  PaginationDto,
} from './dtos/response.dto';
import { CacheService } from './services/cache.service';
import { SanitizationService } from './services/sanitization.service';
import { LoggerService } from './common/logger/logger.service';
import { AvatarService } from './services/avatar.service';

/**
 * Controlador del User Service
 * Gestiona perfiles de usuarios con permisos basados en roles
 */
@ApiTags('users')
@Controller('users')
export class UserServiceController {
  private readonly logger: LoggerService;

  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly sanitizationService: SanitizationService,
    private readonly configService: ConfigService,
    private readonly avatarService: AvatarService,
  ) {
    this.logger = LoggerService.create('UserServiceController', this.configService);
  }

  /**
   * GET /users/me
   * Obtener mi perfil completo
   * 
   * **CASOS DE USO:**
   * - Usuario quiere ver su perfil completo después de iniciar sesión
   * - Frontend necesita cargar datos del usuario autenticado
   * - Verificar información personal y estado de cuenta
   * 
   * **INCLUYE:**
   * - Información básica (email, nombre, rol)
   * - Perfil extendido (bio, avatar, preferencias)
   * - Estado de verificación
   * - Configuraciones y preferencias
   * 
   * **PERMISOS:** Solo el usuario autenticado puede ver su propio perfil
   */
  @Get('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📋 Obtener mi perfil completo',
    description: `
**¿Para qué sirve?**
Obtiene el perfil completo del usuario autenticado, incluyendo información básica y extendida.

**Casos de uso:**
- Cargar perfil del usuario después de login
- Mostrar información personal en el dashboard
- Verificar estado de cuenta y verificación
- Obtener configuraciones y preferencias del usuario

**Información incluida:**
- Datos básicos: email, nombre, rol, estado
- Perfil extendido: bio, avatar, país, fecha de nacimiento
- Preferencias: configuraciones personalizadas
- Estado: verificación, estado de cuenta

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "fullName": "Juan Pérez",
    "role": "MODEL",
    "verified": true,
    "avatarUrl": "https://cdn.bravas.com/avatars/user123.jpg",
    "bio": "Modelo profesional...",
    "profile": { ... }
  }
}
\`\`\`
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: '✅ Perfil obtenido exitosamente',
    type: ApiResponseDto<UserProfileDto>,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado - Token JWT inválido o expirado',
  })
  @ApiResponse({
    status: 500,
    description: '❌ Error interno del servidor',
  })
  async getMyProfile(@Request() req: any) {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const userInfo = await getUserFromToken(req.token);
      userId = userInfo.userId;
      
      if (!userId) {
        throw new ForbiddenException('No se pudo obtener el ID del usuario desde el token.');
      }
      
      // Intentar obtener del caché (TTL: 5 minutos)
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.log('Perfil obtenido del caché', 'getMyProfile', { userId, cacheHit: true });
        return cached;
      }
      
      // Si no está en caché, obtener del servicio
      const result = await this.userService.getMyProfile(userInfo.userId, userInfo.email);
      
      // Guardar en caché (TTL: 5 minutos = 300 segundos)
      await this.cacheService.set(cacheKey, result, 300);
      
      const duration = Date.now() - startTime;
      this.logger.log('Perfil obtenido exitosamente', 'getMyProfile', { 
        userId, 
        cacheHit: false, 
        duration: `${duration}ms` 
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener perfil', error?.stack, 'getMyProfile', { 
        userId, 
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      throw new BadRequestException(`Error al obtener perfil: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * PUT /users/me
   * Actualizar mi perfil
   * 
   * **CASOS DE USO:**
   * - Usuario quiere actualizar su biografía
   * - Cambiar información personal (nombre, país)
   * - Actualizar preferencias y configuraciones
   * - Subir/actualizar foto de perfil (archivo de imagen)
   * - Modificar avatar (URL o archivo)
   * 
   * **CAMPOS ACTUALIZABLES:**
   * - Información personal: fullName, country, birthDate, bio
   * - Avatar: archivo de imagen (multipart/form-data) o avatarUrl (JSON)
   * - Preferencias: preferences (objeto JSON)
   * 
   * **FORMATOS SOPORTADOS:**
   * - JSON: application/json (para actualizar campos de texto)
   * - Multipart: multipart/form-data (para subir archivo de imagen + otros campos)
   */
  @Put('me')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: '✏️ Actualizar mi perfil',
    description: `
**¿Para qué sirve?**
Permite al usuario autenticado actualizar su información de perfil, incluyendo la foto de perfil.

**Casos de uso:**
- Editar biografía o descripción personal
- Actualizar información personal (nombre, país, fecha de nacimiento)
- Cambiar preferencias y configuraciones
- **Subir/actualizar foto de perfil directamente** (archivo de imagen)
- Actualizar URL de avatar (alternativa a subir archivo)

---

## 📋 FORMATOS SOPORTADOS

### 1️⃣ JSON (application/json) - Sin archivo de imagen

**Content-Type:** \`application/json\`

**Cuándo usar:** Para actualizar solo campos de texto (nombre, bio, país, etc.) sin cambiar la foto.

**Ejemplo de request:**
\`\`\`json
{
  "fullName": "Juan Pérez Actualizado",
  "bio": "Nueva biografía profesional",
  "country": "AR",
  "birthDate": "1990-01-01",
  "preferences": {
    "theme": "dark",
    "language": "es",
    "notifications": true
  }
}
\`\`\`

**Ejemplo con URL de avatar existente:**
\`\`\`json
{
  "fullName": "Juan Pérez",
  "avatarUrl": "https://cdn.bravas.com/avatars/user123.jpg"
}
\`\`\`

---

### 2️⃣ Multipart/form-data - Con archivo de imagen ⭐

**Content-Type:** \`multipart/form-data\`

**Cuándo usar:** Para subir una nueva foto de perfil junto con otros campos.

**⚠️ IMPORTANTE PARA EL FRONTEND:**

#### Estructura del Request:

\`\`\`
POST /api/v1/users/me
Content-Type: multipart/form-data
Authorization: Bearer {jwt_token}

Form Data:
  avatar: [File] (campo de archivo - REQUERIDO para subir imagen)
  fullName: "Juan Pérez" (opcional)
  bio: "Nueva biografía" (opcional)
  country: "AR" (opcional)
  birthDate: "1990-01-01" (opcional)
  preferences: '{"theme":"dark","language":"es"}' (opcional - debe ser JSON string)
\`\`\`

#### 📝 Especificaciones del archivo:

- **Nombre del campo:** \`avatar\` (exactamente así, en minúsculas)
- **Tipo de archivo:** Archivo binario (File/Blob)
- **Formatos permitidos:** JPEG, PNG, WebP
- **Tamaño máximo:** 5MB (5,242,880 bytes)
- **Recomendación:** Imagen cuadrada o rectangular, mínimo 300x300px

#### 🔧 Ejemplo de código para Frontend:

**JavaScript/TypeScript (Fetch API):**
\`\`\`javascript
const formData = new FormData();

// Agregar archivo de imagen (OBLIGATORIO para subir foto)
const fileInput = document.querySelector('input[type="file"]');
formData.append('avatar', fileInput.files[0]);

// Agregar otros campos (opcionales)
formData.append('fullName', 'Juan Pérez');
formData.append('bio', 'Nueva biografía profesional');
formData.append('country', 'AR');
formData.append('preferences', JSON.stringify({
  theme: 'dark',
  language: 'es',
  notifications: true
}));

// Enviar request
const response = await fetch('http://localhost:3001/api/v1/users/me', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token, // NO incluir Content-Type, el navegador lo hace automáticamente
  },
  body: formData
});

const result = await response.json();
console.log(result);
\`\`\`

**React (con useState):**
\`\`\`typescript
const [file, setFile] = useState<File | null>(null);
const [fullName, setFullName] = useState('');

const handleSubmit = async () => {
  if (!file) {
    alert('Por favor selecciona una imagen');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('fullName', fullName);
  // ... otros campos

  try {
    const response = await fetch('http://localhost:3001/api/v1/users/me', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        // NO incluir 'Content-Type': 'multipart/form-data'
        // El navegador lo agrega automáticamente con el boundary
      },
      body: formData,
    });

    const result = await response.json();
    console.log('Perfil actualizado:', result);
  } catch (error) {
    console.error('Error:', error);
  }
};
\`\`\`

**Axios:**
\`\`\`typescript
import axios from 'axios';

const formData = new FormData();
formData.append('avatar', file);
formData.append('fullName', 'Juan Pérez');
formData.append('bio', 'Nueva biografía');

await axios.put('http://localhost:3001/api/v1/users/me', formData, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'multipart/form-data', // Axios lo maneja automáticamente
  },
});
\`\`\`

**cURL (para pruebas):**
\`\`\`bash
curl -X PUT 'http://localhost:3001/api/v1/users/me' \\
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\
  -F 'avatar=@/path/to/image.jpg' \\
  -F 'fullName=Juan Pérez' \\
  -F 'bio=Nueva biografía profesional' \\
  -F 'country=AR'
\`\`\`

#### ⚠️ Puntos críticos para el Frontend:

1. **NO incluir manualmente Content-Type en headers** cuando uses FormData:
   - ❌ \`'Content-Type': 'multipart/form-data'\`
   - ✅ Dejar que el navegador/axios lo agregue automáticamente con el boundary

2. **Nombre del campo debe ser exactamente "avatar"**:
   - ✅ \`formData.append('avatar', file)\`
   - ❌ \`formData.append('image', file)\`
   - ❌ \`formData.append('photo', file)\`

3. **El archivo debe ser un objeto File/Blob**:
   - ✅ \`formData.append('avatar', fileInput.files[0])\`
   - ✅ \`formData.append('avatar', new Blob([...]))\`
   - ❌ \`formData.append('avatar', base64String)\`

4. **Preferencias en multipart debe ser JSON string**:
   - ✅ \`formData.append('preferences', JSON.stringify({...}))\`
   - ❌ \`formData.append('preferences', {theme: 'dark'})\`

5. **Validar archivo antes de enviar**:
   - Tipo: JPEG, PNG, WebP
   - Tamaño: máximo 5MB
   - Dimensiones: recomendado mínimo 300x300px

#### 📤 Ejemplo de validación en Frontend:

\`\`\`typescript
const validateFile = (file: File): string | null => {
  // Validar tipo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'Tipo de archivo no permitido. Use JPEG, PNG o WebP';
  }

  // Validar tamaño (5MB = 5 * 1024 * 1024 bytes)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return 'El archivo es demasiado grande. Máximo 5MB';
  }

  return null; // Válido
};

// Usar antes de enviar
const error = validateFile(file);
if (error) {
  alert(error);
  return;
}
\`\`\`

---

## ✨ Características automáticas de la subida de avatar:

- ✅ **Genera 4 tamaños automáticamente:**
  - \`thumbnail\`: 150x150px (para listados)
  - \`small\`: 300x300px (para tarjetas)
  - \`medium\`: 600x600px (perfil principal)
  - \`large\`: 1200x1200px (alta resolución)

- ✅ **Optimiza imagen automáticamente** (JPEG calidad 85%, progressive)
- ✅ **Valida tipo y tamaño** antes de procesar
- ✅ **Modera contenido automáticamente** con AWS Rekognition
- ✅ **Actualiza automáticamente** el \`avatarUrl\` en el perfil del usuario
- ✅ **Almacena en S3** con URLs públicas

---

## ✅ Validaciones:

- Solo puedes actualizar tu propio perfil
- Campos opcionales, solo envía los que quieres actualizar
- Fecha de nacimiento debe ser válida (ISO 8601: YYYY-MM-DD)
- Bio máximo 2000 caracteres
- **Archivo de avatar:**
  - Máximo 5MB
  - Tipos permitidos: JPEG (\`image/jpeg\`), PNG (\`image/png\`), WebP (\`image/webp\`)
  - Recomendado: imagen cuadrada o rectangular, mínimo 300x300px

---

## 📥 Respuesta exitosa:

\`\`\`json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "fullName": "Juan Pérez",
    "bio": "Nueva biografía profesional",
    "avatarUrl": "https://cdn.bravas.com/avatars/user123/medium-1234567890.jpg",
    "country": "AR",
    "preferences": {
      "theme": "dark",
      "language": "es",
      "notifications": true
    }
  }
}
\`\`\`
    `.trim(),
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: {
          type: 'string',
          description: 'Nombre completo',
          example: 'Juan Pérez',
        },
        country: {
          type: 'string',
          description: 'Código ISO del país (ej: AR, US, ES)',
          example: 'AR',
        },
        birthDate: {
          type: 'string',
          format: 'date',
          description: 'Fecha de nacimiento (ISO 8601)',
          example: '1990-01-01',
        },
        bio: {
          type: 'string',
          description: 'Biografía o descripción (máx 2000 caracteres)',
          example: 'Modelo profesional con experiencia',
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: '📸 Archivo de imagen para foto de perfil (JPEG, PNG, WebP, máximo 5MB). Solo disponible en multipart/form-data.',
        },
        avatarUrl: {
          type: 'string',
          description: 'URL del avatar (alternativa a subir archivo). Usar cuando se envía JSON.',
          example: 'https://cdn.bravas.com/avatars/user123.jpg',
        },
        preferences: {
          type: 'object',
          description: 'Preferencias del usuario (objeto JSON en JSON, string JSON en multipart)',
          example: { theme: 'dark', language: 'es', notifications: true },
        },
      },
      required: [],
    },
    description: 'Campos a actualizar (todos opcionales).\n\n**Formatos soportados:**\n- **JSON (application/json)**: Para actualizar campos de texto. Usa `avatarUrl` si quieres actualizar la URL del avatar.\n- **Multipart (multipart/form-data)**: Para subir archivo de imagen. Envía el campo `avatar` con el archivo. También puedes incluir otros campos como `fullName`, `bio`, etc.',
    examples: {
      json: {
        summary: '📄 Actualización con JSON (sin archivo)',
        description: 'Content-Type: application/json',
        value: {
          fullName: 'Juan Pérez',
          bio: 'Modelo profesional con experiencia',
          country: 'AR',
          preferences: {
            theme: 'dark',
            language: 'es',
            notifications: true,
          },
        },
      },
      jsonWithAvatarUrl: {
        summary: '📄 JSON con URL de avatar existente',
        description: 'Si ya tienes una URL de avatar, puedes usarla directamente',
        value: {
          fullName: 'Juan Pérez',
          bio: 'Modelo profesional con experiencia',
          avatarUrl: 'https://cdn.bravas.com/avatars/user123.jpg',
        },
      },
      multipart: {
        summary: '📸 Actualización con archivo de imagen',
        description: 'Content-Type: multipart/form-data\n\nEnvía el campo "avatar" con el archivo de imagen. También puedes incluir otros campos como fullName, bio, country, etc.',
        value: {
          avatar: '[archivo de imagen JPEG/PNG/WebP, máximo 5MB]',
          fullName: 'Juan Pérez',
          bio: 'Modelo profesional con experiencia',
          country: 'AR',
          preferences: '{"theme":"dark","language":"es","notifications":true}',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Perfil actualizado exitosamente',
    type: ApiResponseDto<UserProfileDto>,
  })
  @ApiResponse({
    status: 400,
    description: '❌ Datos inválidos - Verificar formato de campos',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  async updateMyProfile(
    @Request() req: any,
    @Body() updateDto: UpdateUserDto,
    @UploadedFile() avatarFile?: any,
  ) {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const userInfo = await getUserFromToken(req.token);
      userId = userInfo.userId;
      
      if (!userId) {
        throw new ForbiddenException('No se pudo obtener el ID del usuario desde el token.');
      }

      // Limpiar el campo 'avatar' del body si viene como propiedad (no como archivo)
      // El campo 'avatar' solo debe venir como archivo en multipart/form-data
      if (updateDto && 'avatar' in updateDto) {
        delete (updateDto as any).avatar;
        this.logger.warn('Campo "avatar" removido del body - debe enviarse como archivo en multipart/form-data', 'updateMyProfile', { userId });
      }
      
      // Si se envió un archivo de avatar, procesarlo primero
      if (avatarFile) {
        try {
          this.logger.log('Procesando archivo de avatar', 'updateMyProfile', { 
            userId,
            fileName: avatarFile.originalname,
            fileSize: avatarFile.size,
          });
          
          // Subir avatar usando AvatarService
          const avatarResult = await this.avatarService.uploadAvatar(userId, avatarFile);
          
          // Agregar avatarUrl al DTO de actualización
          updateDto.avatarUrl = avatarResult.avatarUrl;
          
          this.logger.log('Avatar subido exitosamente', 'updateMyProfile', { 
            userId,
            avatarUrl: avatarResult.avatarUrl,
          });
        } catch (avatarError: any) {
          this.logger.error('Error al procesar avatar', avatarError?.stack, 'updateMyProfile', { 
            userId,
            error: avatarError.message,
          });
          // Si falla la subida del avatar, continuar con la actualización de otros campos
          // pero lanzar un error específico
          throw new BadRequestException(`Error al subir foto de perfil: ${avatarError.message || 'Error desconocido'}`);
        }
      }
      
      // Actualizar perfil (incluye avatarUrl si se subió un archivo)
      const result = await this.userService.updateMyProfile(userInfo.userId, userInfo.email, updateDto);
      
      // Invalidar caché del perfil
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);
      
      const duration = Date.now() - startTime;
      const fieldsUpdated = Object.keys(updateDto);
      if (avatarFile) {
        fieldsUpdated.push('avatar (archivo)');
      }
      
      this.logger.log('Perfil actualizado exitosamente', 'updateMyProfile', { 
        userId,
        fieldsUpdated,
        hasAvatarFile: !!avatarFile,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al actualizar perfil', error?.stack, 'updateMyProfile', { 
        userId,
        error: error.message,
        hasAvatarFile: !!avatarFile,
        duration: `${duration}ms`
      });
      
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar perfil: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * PUT /users/me/availability
   * Configurar disponibilidad para representación (solo modelos)
   * 
   * **CASOS DE USO:**
   * - Modelo quiere indicar que está disponible para representación de agencias
   * - Configurar tipos de contrato aceptados (con/sin anticipo)
   * - Establecer monto de anticipo requerido
   * - Agregar notas para agencias interesadas
   */
  @Put('me/availability')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '⚙️ Configurar disponibilidad para representación (Solo Modelos)',
    description: `
**¿Para qué sirve?**
Permite a un modelo configurar su disponibilidad para representación de agencias, incluyendo tipos de contrato aceptados, anticipo requerido y notas para agencias.

**Casos de uso:**
- Indicar disponibilidad para representación
- Configurar tipos de contrato aceptados (con anticipo, sin anticipo)
- Establecer monto de anticipo requerido (si aplica)
- Agregar notas o condiciones para agencias

**Restricciones:**
- Solo usuarios con rol MODEL pueden usar este endpoint
- Si incluyes "with_advance" en contractTypes, puedes establecer advancePayment
- Si no incluyes "with_advance", advancePayment será automáticamente null

**Ejemplo de uso:**
\`\`\`
PUT /api/v1/users/me/availability
Authorization: Bearer {token}
Content-Type: application/json

{
  "available": true,
  "contractTypes": ["with_advance", "without_advance"],
  "advancePayment": 1000,
  "notes": "Solo acepto contratos con mínimo 6 meses de duración"
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "availability": {
      "available": true,
      "contractTypes": ["with_advance", "without_advance"],
      "advancePayment": 1000,
      "notes": "Solo acepto contratos con mínimo 6 meses de duración",
      "updatedAt": "2024-01-20T15:30:00Z"
    }
  },
  "message": "Disponibilidad actualizada exitosamente"
}
\`\`\`

**Notas:**
- Todos los campos son opcionales, solo actualiza los que envíes
- Si no existe configuración previa, se crea una nueva
- Si ya existe, se actualiza solo con los campos proporcionados
- Los campos no proporcionados mantienen sus valores anteriores
    `.trim(),
  })
  @ApiBody({
    type: UpdateAvailabilityDto,
    description: 'Configuración de disponibilidad para representación',
    examples: {
      availableOnly: {
        summary: 'Solo indicar disponibilidad',
        value: {
          available: true,
        },
      },
      withContractTypes: {
        summary: 'Con tipos de contrato',
        value: {
          available: true,
          contractTypes: ['with_advance', 'without_advance'],
        },
      },
      complete: {
        summary: 'Configuración completa',
        value: {
          available: true,
          contractTypes: ['with_advance', 'without_advance'],
          advancePayment: 1000,
          notes: 'Solo acepto contratos con mínimo 6 meses de duración',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '✅ Disponibilidad actualizada exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '❌ Datos inválidos - Verificar formato de campos',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo modelos pueden configurar disponibilidad',
  })
  async updateAvailability(
    @Request() req: any,
    @Body() availabilityDto: UpdateAvailabilityDto,
  ) {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const userInfo = await getUserFromToken(req.token);
      userId = userInfo.userId;
      
      if (!userId) {
        throw new ForbiddenException('No se pudo obtener el ID del usuario desde el token.');
      }

      const result = await this.userService.updateAvailability(userId, availabilityDto);

      // Invalidar caché del perfil
      const cacheKey = CacheService.getUserProfileCacheKey(userId);
      await this.cacheService.delete(cacheKey);

      const duration = Date.now() - startTime;
      this.logger.log('Disponibilidad actualizada exitosamente', 'updateAvailability', { 
        userId,
        available: availabilityDto.available,
        contractTypes: availabilityDto.contractTypes,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al actualizar disponibilidad', error?.stack, 'updateAvailability', { 
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al actualizar disponibilidad: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * GET /users/me/availability
   * Obtener configuración de disponibilidad (solo modelos)
   * 
   * **CASOS DE USO:**
   * - Ver configuración actual de disponibilidad
   * - Cargar datos en el formulario de configuración
   */
  @Get('me/availability')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📋 Obtener mi configuración de disponibilidad (Solo Modelos)',
    description: `
**¿Para qué sirve?**
Obtiene la configuración actual de disponibilidad para representación del modelo autenticado.

**Casos de uso:**
- Ver configuración actual de disponibilidad
- Cargar datos en el formulario de configuración
- Verificar estado de disponibilidad

**Restricciones:**
- Solo usuarios con rol MODEL pueden usar este endpoint

**Ejemplo de uso:**
\`\`\`
GET /api/v1/users/me/availability
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "availability": {
      "available": true,
      "contractTypes": ["with_advance", "without_advance"],
      "advancePayment": 1000,
      "notes": "Solo acepto contratos con mínimo 6 meses de duración",
      "updatedAt": "2024-01-20T15:30:00Z"
    }
  }
}
\`\`\`

**Valores por defecto (si no existe configuración):**
\`\`\`json
{
  "available": false,
  "contractTypes": [],
  "advancePayment": null,
  "notes": null,
  "updatedAt": null
}
\`\`\`
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: '✅ Disponibilidad obtenida exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo modelos pueden ver su disponibilidad',
  })
  async getAvailability(@Request() req: any) {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const userInfo = await getUserFromToken(req.token);
      userId = userInfo.userId;
      
      if (!userId) {
        throw new ForbiddenException('No se pudo obtener el ID del usuario desde el token.');
      }

      const result = await this.userService.getAvailability(userId);

      const duration = Date.now() - startTime;
      this.logger.log('Disponibilidad obtenida exitosamente', 'getAvailability', { 
        userId,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener disponibilidad', error?.stack, 'getAvailability', { 
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Error al obtener disponibilidad: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * GET /users/models
   * Listar modelos en el marketplace
   * 
   * **IMPORTANTE:** Esta ruta debe estar ANTES de @Get(':id') para evitar conflictos
   * 
   * **CASOS DE USO:**
   * - Buscar modelos en el marketplace
   * - Filtrar modelos por país, verificación, etc.
   * - Ordenar por reputación, ventas, fecha
   * - Paginar resultados para mejor performance
   * 
   * **FILTROS DISPONIBLES:**
   * - search: Búsqueda por texto (nombre, email, bio)
   * - country: Filtrar por país (código ISO)
   * - verified: Solo modelos verificados
   * - sortBy: Ordenar por campo
   * - order: Orden ascendente/descendente
   */
  @Get('models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔍 Listar modelos en el marketplace',
    description: `
**¿Para qué sirve?**
Obtiene una lista paginada de modelos disponibles en el marketplace con filtros avanzados.

**Casos de uso:**
- Buscar modelos en el marketplace principal
- Filtrar modelos por país o verificación
- Ordenar por reputación, ventas o fecha de registro
- Implementar búsqueda y filtros en el frontend
- Paginar resultados para mejor UX

**Filtros disponibles:**
- \`search\`: Búsqueda por texto en nombre, email o bio
- \`country\`: Código ISO del país (ej: AR, US, ES)
- \`verified\`: Solo modelos verificados (true/false)
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20, max: 100)
- \`sortBy\`: Campo para ordenar (createdAt, reputation, totalSales, name)
- \`order\`: Orden ascendente (asc) o descendente (desc)

**Ejemplos de uso:**
\`\`\`
# Buscar modelos verificados en Argentina
GET /users/models?country=AR&verified=true&sortBy=reputation&order=desc

# Buscar por nombre
GET /users/models?search=maria&page=1&limit=20

# Ordenar por ventas
GET /users/models?sortBy=totalSales&order=desc&limit=50
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "modelo@example.com",
      "fullName": "Ana Martínez",
      "role": "MODEL",
      "verified": true,
      "bio": "Modelo profesional...",
      "avatarUrl": "https://cdn.bravas.com/avatars/model123.jpg",
      "reputation": 90,
      "totalSales": 1250
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
\`\`\`

**Performance:**
- Resultados cacheados por 2 minutos
- Paginación eficiente con DynamoDB
- Búsqueda optimizada con índices
    `.trim(),
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '🔎 Búsqueda por texto (busca en nombre, email, bio)',
    example: 'maria',
    type: String,
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: '🌍 Filtrar por país (código ISO de 2 letras)',
    example: 'AR',
    type: String,
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    description: '✅ Filtrar solo modelos verificados',
    example: true,
    type: Boolean,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '📄 Número de página (empezando en 1)',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '📊 Resultados por página (máximo 100)',
    example: 20,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'reputation', 'totalSales', 'name'],
    description: '🔀 Campo para ordenar resultados',
    example: 'reputation',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: '⬆️⬇️ Orden ascendente (asc) o descendente (desc)',
    example: 'desc',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de modelos obtenida exitosamente',
    type: ApiResponseDto<ModelProfileDto[]>,
  })
  async listModels(@Query() query: MarketplaceQueryDto) {
    const startTime = Date.now();
    
    try {
      // Generar clave de caché basada en los filtros
      const cacheKey = CacheService.getMarketplaceCacheKey('models', query);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.debug('Lista de modelos obtenida del caché', 'listModels', { 
          filters: query,
          cacheHit: true 
        });
        return cached;
      }
      
      // Si no está en caché, obtener del servicio
      const result = await this.userService.listModels(query);
      
      // Guardar en caché (TTL: 2 minutos = 120 segundos)
      await this.cacheService.set(cacheKey, result, 120);
      
      const duration = Date.now() - startTime;
      this.logger.log('Lista de modelos obtenida exitosamente', 'listModels', { 
        filters: query,
        count: result.data?.length || 0,
        cacheHit: false,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener lista de modelos', error?.stack, 'listModels', { 
        filters: query,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * GET /users/search
   * Búsqueda global (modelos, packs, usuarios)
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔍 Búsqueda global',
    description: `
**¿Para qué sirve?**
Búsqueda global que permite encontrar modelos, packs y usuarios en toda la plataforma.

**Casos de uso:**
- Buscar modelos por nombre
- Buscar packs por nombre o descripción
- Buscar usuarios
- Búsqueda unificada desde un solo endpoint

**Parámetros:**
- \`q\`: Término de búsqueda (requerido)
- \`type\`: Tipo de búsqueda (models, packs, users, all)
- \`page\`: Número de página
- \`limit\`: Resultados por página

**Ejemplo de uso:**
\`\`\`
GET /users/search?q=ana&type=models&page=1&limit=20
\`\`\`
    `.trim(),
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: '🔎 Término de búsqueda',
    example: 'ana',
    type: String,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['models', 'packs', 'users', 'all'],
    description: 'Tipo de búsqueda',
    example: 'all',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Resultados de búsqueda obtenidos exitosamente',
  })
  async globalSearch(
    @Query('q') query: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('El término de búsqueda (q) es requerido');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    
    // Validar y convertir el tipo de búsqueda
    const validTypes = ['users', 'models', 'packs', 'all'] as const;
    const searchType = (type && validTypes.includes(type as any)) 
      ? (type as 'users' | 'models' | 'packs' | 'all')
      : 'all';

    return this.userService.globalSearch(query.trim(), searchType, pageNum, limitNum);
  }

  /**
   * GET /users/agencies
   * Listar agencias en el marketplace
   * 
   * **IMPORTANTE:** Esta ruta debe estar ANTES de @Get(':id') para evitar conflictos
   * 
   * **CASOS DE USO:**
   * - USER: Buscar agencias para conectar con modelos que la agencia tiene (SOLO para ver modelos, NO para negocios)
   * - MODEL: Buscar agencias para postularse y hacer negocios
   * - AGENCY: Ver otras agencias para contactar o hacer negocios
   * - Filtrar agencias por país, verificación
   * 
   * **REGLAS DE NEGOCIO:**
   * - ✅ USER puede buscar agencias SOLO para conectar con modelos (ver modelos de la agencia)
   * - ✅ MODEL puede buscar agencias para postularse y hacer negocios
   * - ✅ AGENCY puede buscar otras agencias para contactar y hacer negocios
   */
  @Get('agencies')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🏢 Listar agencias en el marketplace',
    description: `
**¿Para qué sirve?**
Obtiene una lista paginada de agencias disponibles en el marketplace con filtros avanzados.

**Casos de uso:**
- Modelos buscando agencias para postularse
- Ver marketplace de agencias
- Filtrar agencias por país o verificación
- Buscar agencias específicas por nombre

**Restricciones:**
- ❌ No disponible para usuarios con rol USER (compradores)
- ✅ Disponible para modelos, agencias y administradores

**Filtros disponibles:**
- \`search\`: Búsqueda por texto en nombre, email o bio
- \`country\`: Código ISO del país (2 letras, ej: AR, US, MX)
- \`verified\`: Solo agencias verificadas (true/false)
- \`recommended\`: Solo agencias recomendadas (true/false)
- \`minRating\`: Rating mínimo de la agencia (0-5)
- \`minExperience\`: Años de experiencia mínimos de la agencia
- \`minModels\`: Cantidad mínima de modelos gestionados por la agencia
- \`page\`: Número de página (default: 1)
- \`limit\`: Resultados por página (default: 20, max: 100)
- \`sortBy\`: Campo para ordenar (createdAt, name, reputation, totalSales, rating, experience, totalModels)
- \`order\`: Orden (asc/desc, default: desc)

**Ejemplo de uso básico:**
\`\`\`
GET /users/agencies?verified=true&country=AR&sortBy=name&order=asc
Authorization: Bearer {token}
\`\`\`

**Ejemplo de uso con filtros avanzados:**
\`\`\`
GET /users/agencies?recommended=true&minRating=4&minExperience=2&minModels=5&sortBy=rating&order=desc
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "agencyName": "Model Agency Pro",
      "role": "AGENCY",
      "verified": true,
      "totalModels": 25,
      "avatarUrl": "https://cdn.bravas.com/avatars/agency123.jpg"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
\`\`\`
    `.trim(),
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '🔎 Búsqueda por texto (nombre de agencia, email)',
    example: 'model agency',
    type: String,
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: '🌍 Filtrar por país (código ISO)',
    example: 'AR',
    type: String,
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    description: '✅ Filtrar solo agencias verificadas',
    example: true,
    type: Boolean,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '📄 Número de página',
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '📊 Resultados por página (max 100)',
    example: 20,
    type: Number,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'reputation', 'totalSales', 'name', 'rating', 'experience', 'totalModels'],
    description: '🔀 Campo para ordenar (createdAt, reputation, totalSales, name, rating, experience, totalModels)',
    example: 'rating',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: '⬆️⬇️ Orden (asc/desc, default: desc)',
    example: 'desc',
  })
  @ApiQuery({
    name: 'recommended',
    required: false,
    description: '⭐ Filtrar solo agencias recomendadas',
    example: true,
    type: Boolean,
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    description: '⭐ Rating mínimo de la agencia (0-5)',
    example: 4,
    type: Number,
    minimum: 0,
    maximum: 5,
  })
  @ApiQuery({
    name: 'minExperience',
    required: false,
    description: '📅 Años de experiencia mínimos de la agencia',
    example: 2,
    type: Number,
    minimum: 0,
  })
  @ApiQuery({
    name: 'minModels',
    required: false,
    description: '👥 Cantidad mínima de modelos gestionados por la agencia',
    example: 5,
    type: Number,
    minimum: 0,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de agencias obtenida exitosamente',
    type: ApiResponseDto<AgencyProfileDto[]>,
  })
  @ApiResponse({
    status: 403,
    description: '❌ No disponible para usuarios con rol USER',
  })
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  async listAgencies(@Query() query: MarketplaceQueryDto, @Request() req: any) {
    // REGLA DE NEGOCIO: USER puede buscar agencias SOLO para conectar con modelos que la agencia tiene
    // No se requiere restricción aquí, USER puede ver el marketplace de agencias
    const userInfo = await getUserFromToken(req.token);
    const startTime = Date.now();
    
    try {
      // Generar clave de caché basada en los filtros
      const cacheKey = CacheService.getMarketplaceCacheKey('agencies', query);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.debug('Lista de agencias obtenida del caché', 'listAgencies', { 
          filters: query,
          cacheHit: true 
        });
        return cached;
      }
      
      // Si no está en caché, obtener del servicio
      const result = await this.userService.listAgencies(query);
      
      // Guardar en caché (TTL: 2 minutos = 120 segundos)
      await this.cacheService.set(cacheKey, result, 120);
      
      const duration = Date.now() - startTime;
      this.logger.log('Lista de agencias obtenida exitosamente', 'listAgencies', { 
        filters: query,
        count: result.data?.length || 0,
        cacheHit: false,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener lista de agencias', error?.stack, 'listAgencies', { 
        filters: query,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * GET /users/me/stats
   * Obtener mis estadísticas
   * 
   * **CASOS DE USO:**
   * - Ver dashboard de estadísticas del modelo
   * - Analizar performance y métricas
   * - Filtrar estadísticas por período
   * - Ver diferentes tipos de métricas
   * 
   * **MÉTRICAS INCLUIDAS:**
   * - totalSales: Total de ventas realizadas
   * - totalEarnings: Ganancias totales acumuladas
   * - reputation: Reputación del modelo (0-100)
   * - totalBuyers: Compradores únicos
   * - totalContent: Contenido publicado
   */
  @Get('me/stats')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📊 Obtener mis estadísticas',
    description: `
**¿Para qué sirve?**
Obtiene estadísticas detalladas del usuario autenticado. Principalmente útil para modelos que quieren ver su performance.

**Casos de uso:**
- Mostrar dashboard de estadísticas en el frontend
- Analizar performance del modelo
- Filtrar estadísticas por período de tiempo
- Ver métricas específicas (ventas, ganancias, compradores, contenido)

**Métricas incluidas:**
- \`totalSales\`: Número total de ventas realizadas
- \`totalEarnings\`: Ganancias totales acumuladas (en USD)
- \`reputation\`: Reputación del modelo (0-100, basada en calificaciones)
- \`totalBuyers\`: Número de compradores únicos
- \`totalContent\`: Cantidad de contenido publicado

**Filtros disponibles:**
- \`startDate\`: Fecha de inicio (ISO 8601) - Filtrar desde esta fecha
- \`endDate\`: Fecha de fin (ISO 8601) - Filtrar hasta esta fecha
- \`type\`: Tipo de estadísticas a incluir
  - \`sales\`: Solo estadísticas de ventas
  - \`earnings\`: Solo estadísticas de ganancias
  - \`buyers\`: Solo estadísticas de compradores
  - \`content\`: Solo estadísticas de contenido
  - \`all\`: Todas las estadísticas (default)

**Ejemplos de uso:**
\`\`\`
# Todas las estadísticas
GET /users/me/stats

# Estadísticas del último mes
GET /users/me/stats?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z

# Solo ventas
GET /users/me/stats?type=sales

# Estadísticas de un período específico
GET /users/me/stats?startDate=2024-01-01&endDate=2024-12-31&type=all
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "totalSales": 1250,
    "totalEarnings": 12500.50,
    "reputation": 85,
    "totalBuyers": 450,
    "totalContent": 320
  }
}
\`\`\`

**Notas:**
- Las estadísticas se calculan en tiempo real
- Los filtros de fecha aplican a todas las métricas
- La reputación se actualiza automáticamente basada en calificaciones
    `.trim(),
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: '📅 Fecha de inicio para filtrar estadísticas (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: '📅 Fecha de fin para filtrar estadísticas (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
    type: String,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['sales', 'earnings', 'buyers', 'content', 'all'],
    description: '📈 Tipo de estadísticas a incluir',
    example: 'all',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Estadísticas obtenidas exitosamente',
    type: ApiResponseDto<UserStatsDto>,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  async getMyStats(@Query() query: StatsQueryDto, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    return this.userService.getMyStats(userInfo.userId, userInfo.email, query);
  }

  /**
   * POST /users/agencies/:agencyId/apply
   * Postularse a una agencia (solo modelos)
   * 
   * **CASOS DE USO:**
   * - Modelo quiere trabajar con una agencia
   * - Enviar solicitud de representación
   * - Buscar representación profesional
   */
  @Post('agencies/:agencyId/apply')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📝 Postularse a una agencia (Solo Modelos)',
    description: `
**¿Para qué sirve?**
Permite a un modelo enviar una solicitud de postulación a una agencia para obtener representación.

**Casos de uso:**
- Modelo busca representación profesional
- Enviar solicitud de trabajo a agencia
- Buscar oportunidades de representación

**Proceso:**
1. Modelo envía postulación con mensaje
2. Se crea relación en \`model_agency_relations\` con status \`pending\`
3. Agencia recibe notificación
4. Agencia puede aprobar o rechazar la postulación

**Restricciones:**
- Solo usuarios con rol MODEL pueden usar este endpoint (comparación case-insensitive)
- No puedes postularte a la misma agencia dos veces (si ya existe relación pendiente)
- Los roles se normalizan automáticamente (se eliminan espacios y se convierten a minúsculas)

**Ejemplo de uso:**
\`\`\`
POST /users/agencies/550e8400-e29b-41d4-a716-446655440000/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "Me interesa formar parte de su agencia. Tengo experiencia en modelaje profesional y estoy buscando representación seria y profesional."
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "message": "Postulación enviada exitosamente"
}
\`\`\`

**Notas:**
- La agencia recibirá una notificación automática
- Puedes ver el estado de tu postulación consultando relaciones
- Si la agencia acepta, la relación cambia a status \`active\`
    `.trim(),
  })
  @ApiParam({
    name: 'agencyId',
    description: 'ID único de la agencia a la que te postulas',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiBody({
    type: ApplyAgencyDto,
    description: 'Mensaje de postulación',
    examples: {
      basic: {
        summary: 'Postulación básica',
        value: {
          message: 'Me interesa formar parte de su agencia',
        },
      },
      detailed: {
        summary: 'Postulación detallada',
        value: {
          message: 'Soy modelo profesional con 5 años de experiencia. Busco representación seria y profesional. Tengo portfolio completo y referencias disponibles.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Postulación enviada exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '❌ Ya existe una postulación pendiente a esta agencia',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo modelos pueden postularse a agencias',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Agencia no encontrada',
  })
  async applyToAgency(
    @Param('agencyId') agencyId: string,
    @Body() applyDto: ApplyAgencyDto,
    @Request() req: any,
  ) {
    try {
      const userInfo = await getUserFromToken(req.token);
      const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
      if (userRole !== 'model') {
        throw new ForbiddenException('Solo modelos pueden postularse a agencias');
      }
      return this.userService.applyToAgency(userInfo.userId, agencyId, applyDto.message);
    } catch (error: any) {
      // Log error para debugging
      this.logger.error('Error en applyToAgency', error?.stack || 'No stack trace', 'applyToAgency', {
        agencyId,
        error: error?.message || 'Error sin mensaje',
        errorName: error?.name || 'Unknown',
        errorCode: error?.code || 'NO_CODE',
        errorType: error?.constructor?.name || 'Unknown',
        isHttpException: error instanceof HttpException,
        isBadRequestException: error instanceof BadRequestException,
        isForbiddenException: error instanceof ForbiddenException,
        isNotFoundException: error instanceof NotFoundException,
        isConflictException: error instanceof ConflictException,
      });
      
      // Si es un HttpException (BadRequestException, NotFoundException, ForbiddenException, ConflictException), lanzarlo directamente
      if (error instanceof HttpException || error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      
      // Si es un Error pero no HttpException, envolverlo en BadRequestException con mensaje detallado
      if (error instanceof Error) {
        const errorMessage = error.message || 'Error desconocido';
        const errorName = error.name || 'UnknownError';
        throw new BadRequestException(`Error al aplicar a agencia: ${errorMessage} (${errorName})`);
      }
      
      // Si el error tiene un mensaje pero no es una instancia de Error
      if (error?.message) {
        throw new BadRequestException(`Error al aplicar a agencia: ${error.message}`);
      }
      
      // Cualquier otro tipo de error - devolver mensaje útil
      throw new BadRequestException(`Error al aplicar a agencia. Verifica que los datos sean correctos y que la agencia exista. Error: ${JSON.stringify(error)}`);
    }
  }

  /**
   * POST /users/models/:modelId/propose
   * Proponer representación a un modelo (solo agencias)
   * 
   * **CASOS DE USO:**
   * - Agencia quiere representar a un modelo
   * - Ofrecer términos de representación
   * - Reclutar modelos para la agencia
   */
  @Post('models/:modelId/propose')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '💼 Proponer representación a un modelo (Solo Agencias)',
    description: `
**¿Para qué sirve?**
Permite a una agencia enviar una propuesta de representación a un modelo.

**Casos de uso:**
- Agencia quiere representar a un modelo específico
- Ofrecer términos de representación
- Reclutar modelos para la agencia
- Establecer relación profesional

**Proceso:**
1. Agencia envía propuesta con mensaje y términos
2. Se crea relación en \`model_agency_relations\` con status \`proposed\`
3. Modelo recibe notificación
4. Modelo puede aceptar o rechazar la propuesta

**Restricciones:**
- Solo usuarios con rol AGENCY pueden usar este endpoint (comparación case-insensitive)
- El modelo debe existir y estar activo
- Los roles se normalizan automáticamente (se eliminan espacios y se convierten a minúsculas)

**Ejemplo de uso:**
\`\`\`
POST /users/models/550e8400-e29b-41d4-a716-446655440000/propose
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "Nos gustaría representarte. Ofrecemos marketing profesional, gestión de contenido y negociación de contratos.",
  "terms": "Comisión del 20%, exclusividad, marketing incluido, soporte 24/7"
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "message": "Propuesta enviada exitosamente"
}
\`\`\`

**Notas:**
- El modelo recibirá una notificación automática
- Los términos son opcionales pero recomendados
- Si el modelo acepta, la relación cambia a status \`active\`
    `.trim(),
  })
  @ApiParam({
    name: 'modelId',
    description: 'ID único del modelo al que se propone representación',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiBody({
    type: ProposeRepresentationDto,
    description: 'Propuesta de representación',
    examples: {
      basic: {
        summary: 'Propuesta básica',
        value: {
          message: 'Nos gustaría representarte',
        },
      },
      complete: {
        summary: 'Propuesta completa con términos',
        value: {
          message: 'Nos gustaría representarte. Somos una agencia con 10 años de experiencia.',
          terms: 'Comisión del 20%, exclusividad, marketing incluido, soporte 24/7',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '✅ Propuesta enviada exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo agencias pueden proponer representación',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Modelo no encontrado',
  })
  async proposeRepresentation(
    @Param('modelId') modelId: string,
    @Body() proposeDto: ProposeRepresentationDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (userRole !== 'agency') {
      throw new ForbiddenException('Solo agencias pueden proponer representación');
    }
    return this.userService.proposeRepresentation(userInfo.userId, modelId, proposeDto.message, proposeDto.terms);
  }

  /**
   * POST /users/agencies/:agencyId/contact
   * Contactar otra agencia (solo agencias)
   * 
   * **Endpoint Privado** - Requiere autenticación y rol AGENCY
   */
  @Post('agencies/:agencyId/contact')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Contactar otra agencia',
    description: 'Permite a una agencia contactar a otra para negociaciones, ' +
      'partnerships o transferencias de modelos. Solo usuarios con rol AGENCY pueden usar este endpoint.',
  })
  @ApiParam({ name: 'agencyId', description: 'ID de la agencia a contactar' })
  @ApiResponse({
    status: 201,
    description: 'Mensaje enviado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo agencias pueden contactar otras agencias',
  })
  @ApiResponse({
    status: 404,
    description: 'Agencia no encontrada',
  })
  async contactAgency(
    @Param('agencyId') agencyId: string,
    @Body() contactDto: ContactAgencyDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (userRole !== 'agency') {
      throw new ForbiddenException('Solo agencias pueden contactar otras agencias');
    }
    // Por ahora solo retornamos éxito, la implementación completa se hará después
    return {
      success: true,
      message: 'Mensaje enviado exitosamente',
    };
  }

  /**
   * PUT /users/:id
   * Actualizar cualquier usuario (solo admins)
   * 
   * **Endpoint Privado** - Requiere autenticación y rol de admin
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar usuario (Solo Admins)',
    description: 'Permite a un administrador actualizar cualquier usuario. ' +
      'Solo usuarios con rol de admin pueden usar este endpoint.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a actualizar' })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo administradores pueden actualizar usuarios',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async updateUser(
    @Param('id') userId: string,
    @Body() updateDto: UpdateUserDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    return this.userService.updateUser(userId, updateDto, userInfo.role as UserRole);
  }

  /**
   * DELETE /users/:id
   * Eliminar usuario (solo super admins)
   * 
   * **Endpoint Privado** - Requiere autenticación y rol ADMIN_LEVEL_3
   */
  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eliminar usuario (Solo Super Admins)',
    description: 'Elimina (soft delete) un usuario del sistema. ' +
      'Solo usuarios con rol ADMIN_LEVEL_3 pueden usar este endpoint.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a eliminar' })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo super administradores pueden eliminar usuarios',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async deleteUser(@Param('id') userId: string, @Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    return this.userService.deleteUser(userId, userInfo.role as UserRole);
  }

  /**
   * POST /users/:id/approve
   * Aprobar usuario (solo admins)
   * 
   * **CASOS DE USO:**
   * - Aprobar verificación después de revisión manual
   * - Aprobar usuarios que no pasaron verificación automática
   * - Activar badge de verificación manualmente
   */
  @Post(':id/approve')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '✅ Aprobar usuario (Solo Admins)',
    description: `
**¿Para qué sirve?**
Permite a un administrador aprobar manualmente la verificación de un usuario (modelo o agencia).

**Casos de uso:**
- Aprobar verificación después de revisión manual
- Aprobar usuarios que no pasaron verificación automática (confianza < 90%)
- Activar badge de verificación manualmente
- Corregir errores en verificación automática

**Proceso:**
1. Admin revisa documentos del usuario
2. Admin aprueba manualmente
3. Usuario recibe badge de verificación
4. Estado cambia a \`verified: true\`
5. Usuario recibe notificación automática

**Restricciones:**
- Solo usuarios con rol ADMIN pueden usar este endpoint (incluye ADMIN_LEVEL_1, ADMIN_LEVEL_2, ADMIN_LEVEL_3)
- El usuario debe existir y tener verificación pendiente
- Los roles se normalizan automáticamente (comparación case-insensitive)

**Ejemplo de uso:**
\`\`\`
POST /users/550e8400-e29b-41d4-a716-446655440000/approve
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "notes": "Documentos verificados manualmente. Todo correcto."
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "verified": true,
    "status": "active"
  }
}
\`\`\`

**Notas:**
- El usuario recibirá una notificación automática de aprobación
- Se puede agregar notas opcionales para el registro
- La aprobación activa el badge de verificación inmediatamente
    `.trim(),
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario a aprobar',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiBody({
    type: ApproveUserDto,
    description: 'Notas opcionales sobre la aprobación',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Usuario aprobado exitosamente',
    type: ApiResponseDto<UserProfileDto>,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo administradores pueden aprobar usuarios',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Usuario no encontrado',
  })
  async approveUser(
    @Param('id') userId: string,
    @Body() approveDto: ApproveUserDto,
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (!userRole.startsWith('admin')) {
      throw new ForbiddenException('Solo administradores pueden aprobar usuarios');
    }
    
    // Actualizar estado de verificación
    const result = await this.userService.updateUser(userId, { verified: true }, userInfo.role as UserRole);
    
    // Crear notificación de verificación aprobada
    try {
      const { NotificationClient } = await import('@bravas/shared');
      const notificationClient = new NotificationClient(
        process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1'
      );
      await notificationClient.createNotification({
        userId,
        type: 'verification',
        title: 'Verificación aprobada',
        message: '¡Felicidades! Tu verificación de identidad ha sido aprobada por un administrador. Ya puedes disfrutar de todas las funcionalidades de la plataforma.',
        link: '/profile',
        metadata: {
          approvedBy: userInfo.userId,
          status: 'approved',
        },
      });
    } catch (error: any) {
      this.logger.warn('Error al crear notificación de verificación aprobada', 'approveUser', {
        userId,
        error: error.message,
      });
    }
    
    return result;
  }

  /**
   * GET /users/models/:id
   * Obtener perfil de modelo específico
   * 
   * **CASOS DE USO:**
   * - Ver perfil completo de modelo desde marketplace
   * - Mostrar información detallada antes de suscribirse
   * - Ver estadísticas y reputación del modelo
   * - Analizar modelo antes de comprar contenido
   */
  @Get('models/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '👤 Obtener perfil de modelo específico',
    description: `
**¿Para qué sirve?**
Obtiene el perfil detallado de un modelo específico con información extendida.

**Casos de uso:**
- Ver perfil completo de modelo desde el marketplace
- Mostrar información detallada antes de suscribirse
- Ver estadísticas y reputación del modelo
- Analizar modelo antes de comprar contenido

**Información incluida:**
- Datos básicos: nombre, email, bio, avatar
- Estado de verificación
- Estadísticas (reputación, ventas, ganancias) - según permisos
- Precio de suscripción (si aplica)
- Información de perfil extendido

**Permisos de visualización:**
- **Sin autenticación:** Solo información pública básica
- **Autenticado (USER/MODEL):** Estadísticas básicas (reputación, ventas)
- **Admin:** Toda la información incluyendo ganancias

**Ejemplo de uso:**
\`\`\`
GET /users/models/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token} (opcional)
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "modelo@example.com",
    "fullName": "Ana Martínez",
    "role": "MODEL",
    "verified": true,
    "bio": "Modelo profesional con 5 años de experiencia",
    "avatarUrl": "https://cdn.bravas.com/avatars/model123.jpg",
    "verificationStatus": "verified",
    "stats": {
      "reputation": 90,
      "totalSales": 1250,
      "totalEarnings": 12500.50
    },
    "subscriptionPrice": 9.99,
    "country": "AR",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
\`\`\`

**Notas:**
- Las estadísticas se muestran según los permisos del solicitante
- Los admins ven toda la información
- Los usuarios normales ven información pública y estadísticas básicas
    `.trim(),
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del modelo',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Perfil de modelo obtenido exitosamente',
    type: ApiResponseDto<ModelProfileDto>,
  })
  @ApiResponse({
    status: 404,
    description: '❌ Modelo no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: '❌ El usuario no es un modelo',
  })
  async getModelProfile(
    @Param('id') modelId: string,
    @Request() req: any,
  ) {
    // Limpiar el ID de espacios en blanco
    const cleanModelId = modelId?.trim();
    
    if (!cleanModelId) {
      throw new BadRequestException('ID de modelo no válido');
    }

    let requesterRole: UserRole | undefined;
    try {
      if (req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1];
        const userInfo = await getUserFromToken(token);
        requesterRole = userInfo.role as UserRole;
      }
    } catch (error) {
      // Continuar sin rol (perfil público)
    }

    return this.userService.getModelProfile(cleanModelId, requesterRole);
  }

  /**
   * GET /users/agencies/:id
   * Obtener perfil de agencia específica
   * 
   * **CASOS DE USO:**
   * - Ver información de agencia antes de postularse
   * - Ver modelos gestionados por la agencia
   * - Contactar agencia
   * - Analizar agencia para partnership
   * 
   * **RESTRICCIÓN:** No disponible para usuarios con rol USER (compradores)
   */
  @Get('agencies/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '🏢 Obtener perfil de agencia específica',
    description: `
**¿Para qué sirve?**
Obtiene el perfil detallado de una agencia específica con información extendida.

**Casos de uso:**
- **USER**: Ver información de agencia para conectar con modelos que la agencia tiene (SOLO para ver modelos, NO para negocios)
- **MODEL**: Buscar agencias para postularse y hacer negocios de representación
- **AGENCY**: Ver información de otra agencia para contactar y hacer negocios
- Ver modelos gestionados por la agencia (disponible para todos los roles autenticados)

**Reglas de negocio:**
- ✅ **USER (compradores)**: Puede ver perfil de agencia SOLO para conectar con modelos (ver perfiles de modelos de la agencia)
- ✅ **MODEL**: Puede ver perfil de agencia para postularse y hacer negocios
- ✅ **AGENCY**: Puede ver perfil de otra agencia para contactar y hacer negocios
- ✅ **ADMIN**: Acceso completo con estadísticas

**Información incluida:**
- Datos básicos: nombre, email, bio, avatar
- Información de agencia: nombre de agencia, tipo
- Estado de verificación
- Estadísticas (total de modelos, modelos verificados) - solo para admins
- Información de perfil extendido

**Permisos de visualización:**
- **Autenticado (MODEL/AGENCY):** Información pública extendida
- **Admin:** Toda la información incluyendo estadísticas

**Ejemplo de uso:**
\`\`\`
GET /users/agencies/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "agencia@example.com",
    "fullName": "Juan Pérez",
    "role": "AGENCY",
    "verified": true,
    "bio": "Agencia profesional con 10 años de experiencia",
    "avatarUrl": "https://cdn.bravas.com/avatars/agency123.jpg",
    "agencyName": "Model Agency Pro",
    "agencyType": "full_service",
    "country": "AR",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
\`\`\`

**Notas:**
- Las estadísticas solo se muestran a administradores
- Los modelos gestionados se obtienen con GET /users/me/models (solo para la agencia misma)
    `.trim(),
  })
  @ApiParam({
    name: 'id',
    description: 'ID único de la agencia',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Perfil de agencia obtenido exitosamente',
    type: ApiResponseDto<AgencyProfileDto>,
  })
  @ApiResponse({
    status: 403,
    description: '❌ No disponible para usuarios con rol USER',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Agencia no encontrada',
  })
  @ApiResponse({
    status: 400,
    description: '❌ El usuario no es una agencia',
  })
  async getAgencyProfile(
    @Param('id') agencyId: string,
    @Request() req: any,
  ) {
    // REGLA DE NEGOCIO: USER puede ver perfil de agencia SOLO para conectar con modelos que la agencia tiene
    // No se requiere restricción aquí, USER puede ver el perfil público de la agencia
    const userInfo = await getUserFromToken(req.token);
    
    const requesterRole = userInfo.role as UserRole;

    return this.userService.getAgencyProfile(agencyId, requesterRole);
  }

  /**
   * GET /users/me/buyers
   * Listar usuarios que me compraron (solo modelos)
   * 
   * **CASOS DE USO:**
   * - Ver lista de compradores del modelo
   * - Analizar base de clientes
   * - Contactar compradores
   * - Ver estadísticas de compradores
   */
  @Get('me/buyers')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '👥 Listar mis compradores (Solo Modelos)',
    description: `
**¿Para qué sirve?**
Obtiene la lista de usuarios que han comprado contenido al modelo autenticado.

**Casos de uso:**
- Ver base de clientes del modelo
- Analizar compradores únicos
- Contactar compradores para promociones
- Ver estadísticas de compradores

**Información incluida:**
- ID y email del comprador
- Nombre completo
- Avatar
- Fecha de primera compra

**Restricciones:**
- Solo usuarios con rol MODEL pueden usar este endpoint (comparación case-insensitive)
- Los compradores se obtienen de las relaciones usuario-modelo
- Resultados paginados para mejor performance
- Los roles se normalizan automáticamente (se eliminan espacios y se convierten a minúsculas)

**Ejemplo de uso:**
\`\`\`
GET /users/me/buyers?page=1&limit=20
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "comprador@example.com",
      "fullName": "María González",
      "avatarUrl": "https://cdn.bravas.com/avatars/user456.jpg",
      "createdAt": "2024-01-10T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "totalPages": 23
  }
}
\`\`\`

**Notas:**
- Los compradores se ordenan por fecha de primera compra (más recientes primero)
- Solo muestra compradores únicos (sin duplicados)
- Requiere que exista la tabla \`user_model_relations\` con GSI
    `.trim(),
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '📄 Número de página (default: 1)',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '📊 Resultados por página (default: 20)',
    example: 20,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de compradores obtenida exitosamente',
    type: ApiResponseDto<BuyerDto[]>,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo modelos pueden ver sus compradores',
  })
  async getMyBuyers(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (userRole !== 'model') {
      throw new ForbiddenException('Solo modelos pueden ver sus compradores');
    }

    return this.userService.getMyBuyers(
      userInfo.userId,
      parseInt(page || '1'),
      parseInt(limit || '20')
    );
  }

  /**
   * GET /users/me/models
   * Mis modelos gestionados (solo agencias)
   * 
   * **CASOS DE USO:**
   * - Ver portafolio de modelos de la agencia
   * - Gestionar modelos bajo representación
   * - Analizar performance de modelos
   * - Ver estadísticas de modelos gestionados
   */
  @Get('me/models')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '👥 Mis modelos gestionados (Solo Agencias)',
    description: `
**¿Para qué sirve?**
Obtiene la lista de modelos que están bajo representación de la agencia autenticada.

**Casos de uso:**
- Ver portafolio completo de modelos
- Gestionar modelos activos
- Analizar performance de cada modelo
- Ver estadísticas de modelos gestionados

**Información incluida:**
- Datos básicos del modelo (nombre, email, avatar)
- Estado de verificación
- Reputación del modelo
- Total de ventas
- Fecha de incorporación

**Restricciones:**
- Solo usuarios con rol AGENCY pueden usar este endpoint (comparación case-insensitive)
- Solo muestra modelos con relación activa (status: 'active')
- Resultados paginados
- Los roles se normalizan automáticamente (se eliminan espacios y se convierten a minúsculas)

**Ejemplo de uso:**
\`\`\`
GET /users/me/models?page=1&limit=20
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "modelo@example.com",
      "fullName": "Ana Martínez",
      "avatarUrl": "https://cdn.bravas.com/avatars/model123.jpg",
      "verified": true,
      "reputation": 90,
      "totalSales": 2500,
      "joinedAt": "2024-01-05T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2
  }
}
\`\`\`

**Notas:**
- Solo muestra modelos con relación activa
- Requiere tabla \`model_agency_relations\` con GSI \`agencyId-status-index\`
- Los modelos se ordenan por fecha de incorporación (más recientes primero)
    `.trim(),
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '📄 Número de página (default: 1)',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '📊 Resultados por página (default: 20)',
    example: 20,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de modelos obtenida exitosamente',
    type: ApiResponseDto<ManagedModelDto[]>,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo agencias pueden ver sus modelos',
  })
  async getMyModels(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (userRole !== 'agency') {
      throw new ForbiddenException('Solo agencias pueden ver sus modelos');
    }

    return this.userService.getMyModels(
      userInfo.userId,
      parseInt(page || '1'),
      parseInt(limit || '20')
    );
  }

  /**
   * GET /users/me/buyer-stats
   * Estadísticas del buyer (solo para usuarios USER)
   */
  @Get('me/buyer-stats')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📊 Mis estadísticas como comprador',
    description: `
**¿Para qué sirve?**
Obtiene estadísticas completas del usuario autenticado como comprador (rol USER).

**Métricas incluidas:**
- \`totalSpent\`: Total gastado en la plataforma (en USD)
- \`packsPurchased\`: Número de packs comprados
- \`activeSubscriptions\`: Cantidad de suscripciones activas
- \`modelsFollowing\`: Cantidad de modelos que sigue
- \`totalTips\`: Cantidad de tips enviados
- \`totalTipsAmount\`: Monto total de tips enviados (en USD)

**Casos de uso:**
- Mostrar dashboard personal del buyer
- Ver resumen de actividad y gastos
- Implementar sección de estadísticas en perfil

**Restricciones:**
- Solo disponible para usuarios con rol USER (comparación case-insensitive)
- Requiere autenticación
- Los roles se normalizan automáticamente (se eliminan espacios y se convierten a minúsculas)

**Ejemplo de uso:**
\`\`\`
GET /users/me/buyer-stats
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "totalSpent": 150.50,
    "packsPurchased": 5,
    "activeSubscriptions": 2,
    "modelsFollowing": 10,
    "totalTips": 3,
    "totalTipsAmount": 25.00
  }
}
\`\`\`
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: '✅ Estadísticas obtenidas exitosamente',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo usuarios con rol USER pueden ver estas estadísticas',
  })
  async getBuyerStats(@Request() req: any) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    
    if (userRole !== 'user') {
      throw new ForbiddenException('Solo usuarios con rol USER pueden ver estas estadísticas');
    }

    return this.userService.getBuyerStats(userInfo.userId);
  }

  /**
   * GET /users/stats
   * Estadísticas generales de la plataforma (solo admins)
   * 
   * **CASOS DE USO:**
   * - Dashboard de administración
   * - Reportes y métricas de la plataforma
   * - Análisis de crecimiento
   * - Monitoreo de la plataforma
   */
  @Get('stats')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📊 Estadísticas generales de la plataforma (Solo Admins)',
    description: `
**¿Para qué sirve?**
Obtiene estadísticas generales y métricas de toda la plataforma BRAVAS.

**Casos de uso:**
- Mostrar dashboard de administración
- Generar reportes ejecutivos
- Analizar crecimiento de la plataforma
- Monitorear métricas clave

**Métricas incluidas:**
- \`totalUsers\`: Total de usuarios registrados
- \`totalModels\`: Total de modelos activos
- \`totalAgencies\`: Total de agencias registradas
- \`verifiedUsers\`: Usuarios verificados
- \`pendingVerifications\`: Verificaciones pendientes de revisión
- \`totalRevenue\`: Ingresos totales de la plataforma
- \`totalTransactions\`: Total de transacciones realizadas
- \`lastUpdated\`: Última actualización de las métricas

**Ejemplo de uso:**
\`\`\`
GET /users/stats
Authorization: Bearer {admin_token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": {
    "totalUsers": 10000,
    "totalModels": 2500,
    "totalAgencies": 150,
    "verifiedUsers": 8500,
    "pendingVerifications": 120,
    "totalRevenue": 500000.00,
    "totalTransactions": 50000,
    "lastUpdated": "2024-01-20T15:30:00Z"
  }
}
\`\`\`

**Restricciones:**
- Solo usuarios con rol ADMIN pueden acceder (incluye ADMIN_LEVEL_1, ADMIN_LEVEL_2, ADMIN_LEVEL_3)
- Las métricas se calculan en tiempo real
- Algunas métricas pueden requerir consultas a múltiples tablas
- Los roles se normalizan automáticamente (comparación case-insensitive)

**Notas:**
- Las métricas se actualizan automáticamente
- Para mejor performance, considera implementar caché
- Los ingresos y transacciones se obtienen del servicio de pagos
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: '✅ Estadísticas obtenidas exitosamente',
    type: ApiResponseDto<PlatformStatsDto>,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo administradores pueden ver estadísticas',
  })
  async getPlatformStats(@Request() req: any) {
    const startTime = Date.now();
    let userId: string | undefined;
    
    try {
      const userInfo = await getUserFromToken(req.token);
      userId = userInfo.userId;
      const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
      
      if (!userRole.startsWith('admin')) {
        throw new ForbiddenException('Solo administradores pueden ver estadísticas');
      }

      // Intentar obtener del caché (TTL: 5 minutos = 300 segundos)
      const cacheKey = CacheService.getPlatformStatsCacheKey();
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.log('Estadísticas de plataforma obtenidas del caché', 'getPlatformStats', { 
          userId,
          cacheHit: true 
        });
        return cached;
      }
      
      // Si no está en caché, obtener del servicio
      const result = await this.userService.getPlatformStats();
      
      // Guardar en caché (TTL: 5 minutos = 300 segundos)
      await this.cacheService.set(cacheKey, result, 300);
      
      const duration = Date.now() - startTime;
      this.logger.log('Estadísticas de plataforma obtenidas exitosamente', 'getPlatformStats', { 
        userId,
        cacheHit: false,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener estadísticas de plataforma', error?.stack, 'getPlatformStats', { 
        userId,
        error: error.message,
        duration: `${duration}ms`
      });
      throw error;
    }
  }

  /**
   * POST /users/:id/verify-payment
   * Verificar pago manualmente (solo admins)
   * 
   * **Endpoint Privado** - Requiere autenticación y rol de admin
   */
  @Post(':id/verify-payment')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verificar pago manualmente (Solo Admins)',
    description: 'Verifica un pago manualmente. ' +
      'Solo usuarios con rol de admin pueden usar este endpoint.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Pago verificado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo administradores pueden verificar pagos',
  })
  async verifyPayment(
    @Param('id') userId: string,
    @Body() body: { paymentProofId: string },
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (!userRole.startsWith('admin')) {
      throw new ForbiddenException('Solo administradores pueden verificar pagos');
    }

    return this.userService.verifyPayment(userId, body.paymentProofId, userInfo.userId);
  }

  /**
   * PUT /users/:id/support-notes
   * Agregar notas de soporte (solo support/admins)
   * 
   * **Endpoint Privado** - Requiere autenticación y rol de support o admin
   */
  @Put(':id/support-notes')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Agregar notas de soporte',
    description: 'Agrega notas de soporte a un usuario. ' +
      'Solo usuarios con rol de support o admin pueden usar este endpoint.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Nota agregada exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo support o admins pueden agregar notas',
  })
  async addSupportNotes(
    @Param('id') userId: string,
    @Body() body: { notes: string },
    @Request() req: any,
  ) {
    const userInfo = await getUserFromToken(req.token);
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    
    if (!userRole.startsWith('admin') && userRole !== 'support') {
      throw new ForbiddenException('Solo support o admins pueden agregar notas');
    }

    return this.userService.addSupportNotes(userId, body.notes, userInfo.userId);
  }

  /**
   * POST /users/models/:modelId/follow
   * Seguir a un usuario (MODEL, USER o AGENCY según reglas de negocio)
   * 
   * **REGLAS DE NEGOCIO:**
   * - MODEL puede seguir a MODEL, USER y AGENCY
   * - USER puede seguir a USER y MODEL (NO puede seguir AGENCY)
   * - AGENCY puede seguir a MODEL, USER y AGENCY
   * 
   * **CASOS DE USO:**
   * - Usuario quiere seguir a otro usuario/modelo para ver su contenido
   * - Agregar usuario a la lista de seguidos
   * - Recibir actualizaciones en el feed personalizado
   */
  @Post('models/:modelId/follow')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '👥 Seguir a un usuario',
    description: `
**¿Para qué sirve?**
Permite seguir a otros usuarios (MODEL, USER o AGENCY) según las reglas de negocio.

**REGLAS DE NEGOCIO:**
- **MODEL** puede seguir a: MODEL, USER y AGENCY
- **USER** puede seguir a: USER y MODEL (NO puede seguir AGENCY)
- **AGENCY** puede seguir a: MODEL, USER y AGENCY

**Casos de uso:**
- Seguir usuarios/modelos para ver sus posts en el feed
- Mantener lista de usuarios favoritos
- Recibir notificaciones de nuevos posts
- Modelos pueden seguir a otros modelos, usuarios y agencias
- Usuarios pueden seguir a otros usuarios y modelos (NO pueden seguir agencias)
- Agencias pueden seguir modelos, usuarios y otras agencias para monitorear contenido y competencia

**Restricciones:**
- No puedes seguirte a ti mismo
- USER no puede seguir AGENCY
- Si ya sigues al usuario, retorna éxito sin duplicar

**Ejemplo de uso:**
\`\`\`
POST /users/models/550e8400-e29b-41d4-a716-446655440000/follow
Authorization: Bearer {token}
\`\`\`

**Ejemplos de respuesta:**

**Caso 1: Seguir a un modelo (desde USER, MODEL o AGENCY)**
\`\`\`json
{
  "success": true,
  "message": "Ahora sigues a este modelo",
  "data": {
    "userId": "user_123",
    "followedUserId": "550e8400-e29b-41d4-a716-446655440000",
    "followedRole": "model",
    "followedAt": "2024-01-20T15:30:00Z"
  }
}
\`\`\`

**Caso 2: Seguir a un usuario (desde USER, MODEL o AGENCY)**
\`\`\`json
{
  "success": true,
  "message": "Ahora sigues a este usuario",
  "data": {
    "userId": "model_456",
    "followedUserId": "user_789",
    "followedRole": "user",
    "followedAt": "2024-01-20T15:30:00Z"
  }
}
\`\`\`

**Caso 3: Seguir a una agencia (desde MODEL o AGENCY)**
\`\`\`json
{
  "success": true,
  "message": "Ahora sigues a esta agencia",
  "data": {
    "userId": "model_456",
    "followedUserId": "agency_123",
    "followedRole": "agency",
    "followedAt": "2024-01-20T15:30:00Z"
  }
}
\`\`\`

**Caso 4: Ya sigues al usuario**
\`\`\`json
{
  "success": true,
  "message": "Ya sigues a este usuario",
  "data": {
    "userId": "user_123",
    "followedUserId": "550e8400-e29b-41d4-a716-446655440000",
    "followedRole": "model",
    "followedAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`
    `.trim(),
  })
  @ApiParam({
    name: 'modelId',
    description: 'ID único del usuario a seguir (puede ser MODEL, USER o AGENCY)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 201,
    description: '✅ Ahora sigues a este usuario',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '❌ No puedes seguirte a ti mismo o el usuario no existe',
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Restricción de rol: USER no puede seguir AGENCY',
  })
  @ApiResponse({
    status: 404,
    description: '❌ Usuario a seguir no encontrado',
  })
  async followModel(@Param('modelId') modelId: string, @Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      // Validar que el usuario tenga un rol válido para seguir
      const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
      if (userRole !== 'user' && userRole !== 'model' && userRole !== 'agency') {
        throw new ForbiddenException('Solo usuarios con rol USER, MODEL o AGENCY pueden seguir otros usuarios');
      }

      return this.userService.followModel(userInfo.userId, modelId, userInfo.role);
    } catch (error: any) {
      this.logger.error('Error en followModel', error?.stack, 'followModel', {
        modelId,
        error: error?.message || 'Error sin mensaje',
        errorName: error?.name || 'Unknown',
      });
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new BadRequestException(`Error al seguir usuario: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * DELETE /users/models/:modelId/follow
   * Dejar de seguir a un usuario (MODEL, USER o AGENCY)
   */
  @Delete('models/:modelId/follow')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '👥 Dejar de seguir a un usuario',
    description: `
**¿Para qué sirve?**
Permite dejar de seguir a un usuario (MODEL, USER o AGENCY) que estabas siguiendo.

**Casos de uso:**
- Dejar de seguir usuarios/modelos/agencias
- Ya no verás su contenido en tu feed personalizado
- Limpiar tu lista de seguidos

**Restricciones:**
- Solo usuarios con rol USER, MODEL o AGENCY pueden dejar de seguir
- Debes estar siguiendo al usuario para poder dejar de seguirlo

**Ejemplo de uso:**
\`\`\`
DELETE /users/models/550e8400-e29b-41d4-a716-446655440000/follow
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "message": "Dejaste de seguir a este modelo"
}
\`\`\`
    `.trim(),
  })
  @ApiParam({
    name: 'modelId',
    description: 'ID único del usuario a dejar de seguir (puede ser MODEL, USER o AGENCY)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Dejaste de seguir a este usuario',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo usuarios con rol USER, MODEL o AGENCY pueden dejar de seguir',
  })
  @ApiResponse({
    status: 404,
    description: '❌ No estás siguiendo a este usuario',
  })
  async unfollowModel(@Param('modelId') modelId: string, @Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      
      const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
      if (userRole !== 'user' && userRole !== 'model' && userRole !== 'agency') {
        throw new ForbiddenException('Solo usuarios con rol USER, MODEL o AGENCY pueden dejar de seguir usuarios');
      }

      return this.userService.unfollowModel(userInfo.userId, modelId);
    } catch (error: any) {
      this.logger.error('Error en unfollowModel', error?.stack, 'unfollowModel', {
        modelId,
        error: error?.message || 'Error sin mensaje',
        errorName: error?.name || 'Unknown',
      });
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new BadRequestException(`Error al dejar de seguir usuario: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * GET /users/me/following
   * Listar usuarios que sigo (pueden ser MODEL, USER o AGENCY)
   */
  @Get('me/following')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '👥 Listar usuarios que sigo',
    description: `
**¿Para qué sirve?**
Retorna la lista paginada de usuarios (MODEL, USER o AGENCY) que el usuario autenticado está siguiendo.

**REGLAS DE NEGOCIO:**
- **MODEL** puede seguir a: MODEL, USER y AGENCY
- **USER** puede seguir a: USER y MODEL (NO puede seguir AGENCY)
- **AGENCY** puede seguir a: MODEL, USER y AGENCY

**Casos de uso:**
- Ver lista de usuarios/modelos/agencias que sigues
- Gestionar tu lista de seguidos
- Ver información de los usuarios seguidos

**Ejemplo de uso:**
\`\`\`
GET /users/me/following?page=1&limit=20
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "modelo@example.com",
      "fullName": "Modelo Ejemplo",
      "role": "model",
      "verified": true,
      "bio": "Modelo profesional",
      "avatarUrl": "https://...",
      "country": "AR",
      "reputation": 95,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
\`\`\`
    `.trim(),
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
    description: '📊 Resultados por página (default: 20)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de usuarios seguidos obtenida exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: '❌ No autenticado',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Solo usuarios con rol USER, MODEL o AGENCY pueden ver sus seguidos',
  })
  async getFollowing(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userInfo = await getUserFromToken(req.token);
    
    const userRole = userInfo.role?.toString().trim().toLowerCase() || '';
    if (userRole !== 'user' && userRole !== 'model' && userRole !== 'agency') {
      throw new ForbiddenException('Solo usuarios con rol USER, MODEL o AGENCY pueden ver sus seguidos');
    }

    return this.userService.getFollowing(
      userInfo.userId,
      parseInt(page || '1'),
      parseInt(limit || '20')
    );
  }

  /**
   * GET /users/:id/followers
   * Ver seguidores de un usuario (puede ser MODEL, USER o AGENCY)
   */
  @Get(':id/followers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '👥 Ver seguidores de un usuario',
    description: `
**¿Para qué sirve?**
Retorna la lista paginada de usuarios que siguen a este usuario. Disponible para cualquier usuario que tenga seguidores (MODEL, USER o AGENCY).

**Casos de uso:**
- Ver quién te está siguiendo
- Ver seguidores de otros usuarios/modelos/agencias
- Analizar tu audiencia
- Verificar popularidad de un perfil

**Notas:**
- No requiere autenticación (endpoint público)
- Disponible para cualquier usuario con seguidores
- Los seguidores pueden ser de cualquier rol (USER, MODEL, AGENCY según reglas)

**Ejemplo de uso:**
\`\`\`
GET /users/550e8400-e29b-41d4-a716-446655440000/followers?page=1&limit=20
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "data": [
    {
      "userId": "user_123",
      "email": "usuario@example.com",
      "fullName": "Usuario Ejemplo",
      "avatarUrl": "https://...",
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
\`\`\`
    `.trim(),
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del usuario (puede ser MODEL, USER o AGENCY)',
    example: '550e8400-e29b-41d4-a716-446655440000',
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
    description: '📊 Resultados por página (default: 20)',
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '✅ Lista de seguidores obtenida exitosamente',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '❌ Usuario no encontrado',
  })
  async getFollowers(
    @Param('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.getFollowers(
      userId,
      parseInt(page || '1'),
      parseInt(limit || '20')
    );
  }
}
