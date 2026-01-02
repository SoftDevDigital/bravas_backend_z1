import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@bravas/shared';
import { VerificationService } from '../services/verification.service';
import { getUserFromToken } from '../helpers/auth.helper';

/**
 * Controlador para gestión de verificación
 */
@ApiTags('verification')
@Controller('users/me/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * POST /users/me/verification
   * Iniciar proceso de verificación
   * 
   * **CASOS DE USO:**
   * - Modelo quiere verificar su cuenta
   * - Agencia necesita verificación
   * - Obtener badge de verificación
   * 
   * **PROCESO AUTOMÁTICO:**
   * 1. Crea registro de verificación
   * 2. Genera URLs pre-signed para S3
   * 3. Usuario sube documentos
   * 4. Sistema verifica automáticamente con Textract + Rekognition
   * 5. Si confianza ≥ 90% → Aprobación automática
   */
  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '✅ Iniciar verificación de identidad',
    description: `
**¿Para qué sirve?**
Inicia el proceso de verificación de identidad para obtener el badge de verificación.

**Casos de uso:**
- Modelo quiere verificar su cuenta para ganar credibilidad
- Agencia necesita verificación para operar
- Usuario quiere badge de verificación en su perfil

**Proceso completo:**
1. **Iniciar verificación** (este endpoint)
   - Crea registro de verificación
   - Genera URLs pre-signed para subir documentos
   - Estado: \`pending_upload\`

2. **Subir documentos** (usando URLs pre-signed)
   - Selfie del usuario
   - Documento de identidad (frente)
   - Documento de identidad (reverso, opcional)
   - Selfie con documento (opcional, recomendado)

3. **Completar verificación** (POST /users/me/verification/complete)
   - Marca verificación como lista para revisión
   - Estado: \`pending_review\`

4. **Verificación automática** (en background)
   - Textract extrae datos del documento automáticamente
   - Rekognition compara selfie con documento automáticamente
   - Si confianza ≥ 90% → Aprobación automática
   - Si confianza < 90% → Revisión manual por admin

5. **Resultado**
   - Aprobada → Usuario verificado, badge activado
   - Rechazada → Notificación con razón

**Tipos de documentos soportados:**
- \`passport\`: Pasaporte
- \`id_card\`: Cédula/DNI
- \`drivers_license\`: Licencia de conducir

**Ejemplo de uso:**
\`\`\`
POST /users/me/verification
Authorization: Bearer {token}
Content-Type: application/json

{
  "documentType": "id_card"
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "verificationId": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrls": {
    "selfie": "https://s3.amazonaws.com/.../presigned-url?expires=3600",
    "documentFront": "https://s3.amazonaws.com/.../presigned-url?expires=3600",
    "documentBack": "https://s3.amazonaws.com/.../presigned-url?expires=3600",
    "selfieWithId": "https://s3.amazonaws.com/.../presigned-url?expires=3600"
  },
  "expiresIn": 3600
}
\`\`\`

**Próximos pasos:**
1. Usar las URLs pre-signed para subir archivos a S3
2. Llamar a \`POST /users/me/verification/complete\` cuando termines
3. Esperar verificación automática o revisión manual

**Notas importantes:**
- Las URLs pre-signed expiran en 1 hora
- Solo puedes tener una verificación pendiente a la vez
- Los documentos se almacenan de forma segura en S3
- La verificación automática usa AWS Textract y Rekognition
- Si la verificación automática falla, se requiere revisión manual
    `.trim(),
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: {
          type: 'string',
          enum: ['passport', 'id_card', 'drivers_license'],
          description: 'Tipo de documento',
        },
      },
      required: ['documentType'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Proceso de verificación iniciado',
  })
  @ApiResponse({
    status: 400,
    description: 'Ya existe una verificación pendiente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  async initiateVerification(
    @Request() req: any,
    @Body() body: { documentType: string },
  ) {
    try {
      if (!body.documentType) {
        throw new BadRequestException('El tipo de documento es requerido. Valores permitidos: passport, id_card, drivers_license');
      }

      const userInfo = await getUserFromToken(req.token);
      return this.verificationService.initiateVerification(
        userInfo.userId,
        body.documentType
      );
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      throw new BadRequestException(`Error al iniciar verificación: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * POST /users/me/verification/complete
   * Completar verificación después de subir documentos
   * 
   * **CASOS DE USO:**
   * - Después de subir todos los documentos requeridos
   * - Enviar verificación para revisión
   * - Activar proceso de verificación automática
   */
  @Post('complete')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '✅ Completar verificación',
    description: `
**¿Para qué sirve?**
Completa el proceso de verificación después de subir todos los documentos requeridos a S3.

**Casos de uso:**
- Después de subir selfie y documentos usando las URLs pre-signed
- Enviar verificación para revisión automática o manual
- Activar proceso de verificación con Textract y Rekognition

**Proceso automático después de completar:**
1. Sistema verifica que todos los archivos requeridos estén subidos
2. Cambia estado a \`pending_review\`
3. Inicia verificación automática en background:
   - Textract extrae datos del documento
   - Rekognition compara selfie con documento
   - Calcula confianza de verificación
4. Si confianza ≥ 90% → Aprobación automática
5. Si confianza < 90% → Revisión manual por admin

**Archivos requeridos:**
- ✅ Selfie del usuario
- ✅ Documento de identidad (frente)
- ⚪ Documento de identidad (reverso) - opcional pero recomendado
- ⚪ Selfie con documento - opcional pero recomendado

**Ejemplo de uso:**
\`\`\`
POST /users/me/verification/complete
Authorization: Bearer {token}
Content-Type: application/json

{
  "verificationId": "550e8400-e29b-41d4-a716-446655440000"
}
\`\`\`

**Ejemplo de respuesta:**
\`\`\`json
{
  "success": true,
  "message": "Verificación enviada exitosamente. Será revisada automáticamente y por nuestro equipo.",
  "status": "pending_review"
}
\`\`\`

**Próximos pasos:**
1. Esperar verificación automática (puede tomar unos minutos)
2. Consultar estado con \`GET /users/me/verification/status\`
3. Si es aprobada → Badge de verificación activado
4. Si es rechazada → Ver razón de rechazo

**Notas importantes:**
- Debes haber subido todos los archivos requeridos antes de completar
- La verificación automática se ejecuta en background
- Si la verificación automática falla, se requiere revisión manual
- Recibirás notificación cuando la verificación sea aprobada o rechazada
    `.trim(),
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        verificationId: {
          type: 'string',
          description: 'ID de la verificación',
        },
      },
      required: ['verificationId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Verificación completada y enviada para revisión',
  })
  @ApiResponse({
    status: 400,
    description: 'Faltan archivos requeridos o estado inválido',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  async completeVerification(
    @Request() req: any,
    @Body() body: { verificationId: string },
  ) {
    try {
      if (!body.verificationId) {
        throw new BadRequestException('El ID de verificación es requerido.');
      }

      const userInfo = await getUserFromToken(req.token);
      return this.verificationService.completeVerification(
        userInfo.userId,
        body.verificationId
      );
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      throw new BadRequestException(`Error al completar verificación: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * GET /users/me/verification/status
   * Obtener estado de verificación
   * 
   * **CASOS DE USO:**
   * - Verificar estado de verificación pendiente
   * - Ver si fue aprobada o rechazada
   * - Ver razón de rechazo si aplica
   * - Mostrar estado en el frontend
   */
  @Get('status')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '📊 Estado de verificación',
    description: `
**¿Para qué sirve?**
Obtiene el estado actual del proceso de verificación del usuario autenticado.

**Casos de uso:**
- Verificar estado de verificación pendiente
- Ver si fue aprobada o rechazada
- Ver razón de rechazo si aplica
- Mostrar estado en el dashboard del usuario

**Estados posibles:**
- \`not_started\`: No ha iniciado proceso de verificación
- \`pending_upload\`: Esperando subida de documentos
- \`pending_review\`: En revisión (automática o manual)
- \`approved\`: Verificación aprobada ✅
- \`rejected\`: Verificación rechazada ❌

**Ejemplo de uso:**
\`\`\`
GET /users/me/verification/status
Authorization: Bearer {token}
\`\`\`

**Ejemplo de respuesta (aprobada):**
\`\`\`json
{
  "status": "approved",
  "verificationId": "550e8400-e29b-41d4-a716-446655440000",
  "submittedAt": "2024-01-20T10:00:00Z",
  "reviewedAt": "2024-01-20T10:05:00Z"
}
\`\`\`

**Ejemplo de respuesta (rechazada):**
\`\`\`json
{
  "status": "rejected",
  "verificationId": "550e8400-e29b-41d4-a716-446655440000",
  "submittedAt": "2024-01-20T10:00:00Z",
  "reviewedAt": "2024-01-20T10:05:00Z",
  "rejectionReason": "No se pudo verificar la coincidencia de caras. Por favor, sube una selfie más clara."
}
\`\`\`

**Ejemplo de respuesta (pendiente):**
\`\`\`json
{
  "status": "pending_review",
  "verificationId": "550e8400-e29b-41d4-a716-446655440000",
  "submittedAt": "2024-01-20T10:00:00Z"
}
\`\`\`

**Notas:**
- El estado se actualiza automáticamente cuando hay cambios
- Si no hay verificación, retorna \`not_started\`
- La razón de rechazo solo aparece si fue rechazada
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de verificación obtenido',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  async getVerificationStatus(@Request() req: any) {
    try {
      const userInfo = await getUserFromToken(req.token);
      return this.verificationService.getVerificationStatus(userInfo.userId);
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof InternalServerErrorException) {
        throw error;
      }
      if (error.message?.includes('token') || error.message?.includes('autenticación')) {
        throw new ForbiddenException('Token de autenticación inválido o expirado. Por favor, inicia sesión nuevamente.');
      }
      throw new BadRequestException(`Error al obtener estado de verificación: ${error.message || 'Error desconocido'}`);
    }
  }
}

