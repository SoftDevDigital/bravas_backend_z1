import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { VerifyOTPDto } from './dto/verify-otp.dto';
import { ResendOTPDto } from './dto/resend-otp.dto';
import {
  RegisterResponseDto,
  LoginResponseDto,
  GetMeResponseDto,
  ErrorResponseDto,
} from './dto/response.dto';
import { AuthGuard } from '@bravas/shared';
import { LoggerService } from './common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './services/metrics.service';

/**
 * Controlador de autenticación
 * Endpoints simplificados - solo los esenciales
 * 
 * @tag auth
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger: LoggerService;

  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly configService: ConfigService,
    private readonly metricsService?: MetricsService,
  ) {
    this.logger = LoggerService.create('AuthController', this.configService);
  }

  /**
   * POST /auth/register
   * Registro de nuevo usuario
   * 
   * **Endpoint Público** - No requiere autenticación
   * 
   * Registra un nuevo usuario en la plataforma BRAVAS. El proceso incluye:
   * 1. Validación de mayoría de edad (18+ años)
   * 2. Registro en AWS Cognito
   * 3. Creación de perfil en DynamoDB
   * 
   * **Notas importantes:**
   * - El email debe ser único en el sistema
   * - La contraseña debe tener mínimo 8 caracteres
   * - Se enviará un email de verificación al usuario
   * - El usuario debe verificar su email antes de poder iniciar sesión
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description: 'Registra un nuevo usuario en la plataforma BRAVAS. ' +
      'Validaciones: Email debe ser válido y único, contraseña mínimo 8 caracteres, usuario debe ser mayor de edad (18+ años), rol debe ser uno de: model, agency, user, admin. ' +
      'Proceso: 1) Valida la edad del usuario, 2) Registra el usuario en AWS Cognito (NO se guarda en DynamoDB todavía), 3) Envía código OTP por email automáticamente. ' +
      'IMPORTANTE: El usuario NO se guarda en DynamoDB hasta que verifique el código OTP. Debe usar el endpoint /auth/verify-otp para verificar el código. ' +
      'Solo después de verificar el OTP, el usuario se guarda en DynamoDB y puede iniciar sesión. ' +
      'Respuesta: Retorna el email y confirma que se envió el código OTP. El usuario debe verificar su email con el código OTP recibido.',
  })
  @ApiBody({
    type: RegisterDto,
    description: 'Datos del nuevo usuario',
    examples: {
      modelo: {
        summary: 'Registro de modelo',
        value: {
          email: 'modelo@example.com',
          password: 'Password123!',
          role: 'model',
          birthDate: '2000-01-01',
          country: 'AR',
        },
      },
      agencia: {
        summary: 'Registro de agencia',
        value: {
          email: 'agencia@example.com',
          password: 'Password123!',
          role: 'agency',
          birthDate: '1990-01-01',
          country: 'MX',
        },
      },
      usuario: {
        summary: 'Registro de usuario/comprador',
        value: {
          email: 'usuario@example.com',
          password: 'Password123!',
          role: 'user',
          birthDate: '1995-05-15',
          country: 'CO',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
    type: RegisterResponseDto,
    example: {
      success: true,
      message: 'Registro exitoso. Por favor verifica tu email con el código OTP enviado.',
      email: 'usuario@example.com',
      role: 'model',
      requiresVerification: true,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o usuario menor de edad',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: 'Debes ser mayor de edad para registrarte',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/register',
    },
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está registrado',
    type: ErrorResponseDto,
    example: {
      statusCode: 409,
      message: 'El email ya está registrado',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/register',
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    const startTime = Date.now();
    
    try {
      const result = await this.authService.register(registerDto);
      
      const duration = Date.now() - startTime;
      this.logger.log('Usuario registrado exitosamente', 'register', {
        email: registerDto.email,
        role: registerDto.role,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de registro exitoso
      this.metricsService?.recordRegistration(true).catch(() => {});
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al registrar usuario', error?.stack, 'register', {
        email: registerDto.email,
        role: registerDto.role,
        error: error.message,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de registro fallido
      this.metricsService?.recordRegistration(false).catch(() => {});
      
      throw error;
    }
  }

  /**
   * POST /auth/login
   * Login de usuario
   * 
   * **Endpoint Público** - No requiere autenticación
   * 
   * Autentica un usuario y retorna tokens JWT para acceder a endpoints protegidos.
   * 
   * **Notas importantes:**
   * - El usuario debe haber verificado su email previamente
   * - Los tokens expiran en 1 hora (3600 segundos)
   * - Usa el accessToken en el header Authorization: Bearer <token>
   * - Guarda el refreshToken para renovar tokens sin re-login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión (Gestión Automática de Sesiones)',
    description: `
Autentica un usuario y retorna tokens JWT.

**GESTIÓN AUTOMÁTICA DE SESIONES:**
- Detecta automáticamente si ya existe una sesión para este dispositivo
- Si existe, actualiza la sesión existente con nuevos tokens
- Si no existe, crea una nueva sesión automáticamente
- No necesitas hacer nada especial - todo es automático

**Requisitos:**
- El usuario debe estar registrado
- El email debe estar verificado
- Las credenciales deben ser correctas

**Tokens retornados:**
- **accessToken**: Usar en header \`Authorization: Bearer <token>\` para endpoints protegidos
- **refreshToken**: Usar para renovar tokens sin re-login (se sincroniza automáticamente en todas las sesiones)
- **idToken**: Contiene información del usuario
- **expiresIn**: Tiempo de expiración en segundos (3600 = 1 hora)
- **sessionId**: ID único de la sesión (opcional, solo para referencia)

**Uso del token:**
\`\`\`
Authorization: Bearer <accessToken>
\`\`\`
    `,
  })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciales de acceso',
    examples: {
      ejemplo1: {
        summary: 'Login de usuario',
        value: {
          email: 'usuario@example.com',
          password: 'Password123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso - tokens retornados',
    type: LoginResponseDto,
    example: {
      success: true,
      data: {
        accessToken: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
        refreshToken: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
        idToken: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
        expiresIn: 3600,
        role: 'model',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o email no verificado',
    type: ErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Email o contraseña incorrectos',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/login',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación',
    type: ErrorResponseDto,
  })
  async login(@Body() loginDto: LoginDto, @Request() req: any) {
    const startTime = Date.now();
    
    try {
      // Extraer información del dispositivo automáticamente del request
      const deviceInfo = {
        deviceId: req?.headers?.['x-device-id'] || req?.headers?.['device-id'],
        deviceName: req?.headers?.['x-device-name'] || req?.headers?.['device-name'] || 'Unknown Device',
        deviceType: (req?.headers?.['x-device-type'] || req?.headers?.['device-type'] || 'web') as 'mobile' | 'desktop' | 'tablet' | 'web',
        ipAddress: req?.ip || req?.connection?.remoteAddress || req?.headers?.['x-forwarded-for']?.split(',')[0] || 'unknown',
        userAgent: req?.headers?.['user-agent'] || 'unknown',
      };

      const result = await this.authService.login(loginDto, deviceInfo);
      
      const duration = Date.now() - startTime;
      this.logger.log('Login exitoso', 'login', {
        email: loginDto.email,
        deviceType: deviceInfo.deviceType,
        sessionId: result.data?.sessionId,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de login exitoso
      this.metricsService?.recordLogin(true, deviceInfo.deviceType).catch(() => {});
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error en login', error?.stack, 'login', {
        email: loginDto.email,
        error: error.message,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de login fallido
      this.metricsService?.recordLogin(false).catch(() => {});
      
      throw error;
    }
  }

  /**
   * POST /auth/refresh
   * Renovar tokens de acceso
   * 
   * **Endpoint Público** - No requiere autenticación (usa refreshToken)
   * 
   * Renueva los tokens de acceso usando un refresh token válido.
   * Soporta multi-sesión: permite múltiples dispositivos con sesiones independientes.
   * 
   * **Multi-Sesión:**
   * - Cada dispositivo puede tener su propia sesión activa
   * - Los tokens se renuevan automáticamente sin interrumpir la sesión
   * - Ideal para mantener sesiones abiertas en múltiples dispositivos (como MercadoLibre, YouTube, etc.)
   * 
   * **Notas:**
   * - El refresh token debe ser válido y no expirado
   * - Retorna nuevos accessToken, refreshToken e idToken
   * - El email es requerido para identificar la sesión en modo multi-sesión
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar tokens de acceso (Multi-Sesión Automático)',
    description: 'Renueva los tokens de acceso usando un refresh token. ' +
      'SINCRONIZACIÓN AUTOMÁTICA: Los tokens se actualizan automáticamente en TODAS las sesiones activas del usuario. ' +
      'No necesitas hacer nada especial - simplemente usa el refresh token y todos tus dispositivos se mantendrán sincronizados. ' +
      'Requisitos: El refresh token debe ser válido y no expirado. El email es requerido para identificar la sesión. ' +
      'Retorna nuevos accessToken, refreshToken e idToken. Ideal para mantener sesiones abiertas en múltiples dispositivos como MercadoLibre, YouTube, etc.',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token para renovar',
    examples: {
      ejemplo1: {
        summary: 'Refresh token con email (multi-sesión)',
        value: {
          refreshToken: 'eyJraWQiOiJcL0tVbUtmSHZcL0x3XC9jT2JcL0...',
          email: 'usuario@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados exitosamente',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Refresh token inválido o expirado',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: 'Refresh token endpoint - implementación pendiente',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/refresh',
    },
  })
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    const startTime = Date.now();
    
    try {
      const result = await this.authService.refreshToken(refreshDto);
      
      const duration = Date.now() - startTime;
      this.logger.log('Tokens refrescados exitosamente', 'refresh', {
        email: refreshDto.email,
        sessionId: refreshDto.sessionId,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de refresh exitoso
      this.metricsService?.recordTokenRefresh(true).catch(() => {});
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al refrescar tokens', error?.stack, 'refresh', {
        email: refreshDto.email,
        error: error.message,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de refresh fallido
      this.metricsService?.recordTokenRefresh(false).catch(() => {});
      
      throw error;
    }
  }

  /**
   * GET /auth/me
   * Obtener información del usuario actual
   * 
   * **Endpoint Privado** - Requiere autenticación
   * 
   * Retorna la información del usuario autenticado basado en el token JWT.
   * 
   * **Autenticación:**
   * Incluye el token en el header:
   * \`\`\`
   * Authorization: Bearer <accessToken>
   * \`\`\`
   */
  @Get('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obtener información del usuario actual',
    description: `
Retorna la información del usuario autenticado.

**Autenticación requerida:**
Este endpoint requiere un token JWT válido en el header Authorization.

**Header requerido:**
\`\`\`
Authorization: Bearer <accessToken>
\`\`\`

**Información retornada:**
- Email del usuario
- Username en Cognito
- Atributos del usuario (rol, país, etc.)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Información del usuario obtenida exitosamente',
    type: GetMeResponseDto,
    example: {
      success: true,
      data: {
        email: 'usuario@example.com',
        username: 'usuario@example.com',
        attributes: [
          { Name: 'email', Value: 'usuario@example.com' },
          { Name: 'custom:role', Value: 'model' },
          { Name: 'custom:country', Value: 'AR' },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido, expirado o no proporcionado',
    type: ErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Token inválido o expirado',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/me',
    },
  })
  async getMe(@Request() req: any) {
    const startTime = Date.now();
    
    try {
      const result = await this.authService.getMe(req.token);
      
      const duration = Date.now() - startTime;
      this.logger.log('Información de usuario obtenida', 'getMe', {
        email: result.data?.email,
        duration: `${duration}ms`,
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener información de usuario', error?.stack, 'getMe', {
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * POST /auth/verify-otp
   * Verificar código OTP
   * 
   * **Endpoint Público** - No requiere autenticación
   * 
   * Verifica el código OTP enviado por email durante el registro.
   * Una vez verificado, el usuario puede iniciar sesión normalmente.
   * 
   * **Notas importantes:**
   * - El código OTP tiene una validez limitada (generalmente 15 minutos)
   * - Solo se puede verificar una vez
   * - Si el código expira, solicita uno nuevo con resend-otp
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar código OTP',
    description: 'Verifica el código OTP enviado por email durante el registro. ' +
      'Proceso: 1) Valida el código OTP con AWS Cognito, 2) Confirma el registro del usuario en Cognito, 3) Guarda el usuario en DynamoDB (users y user_profiles), 4) Activa la cuenta del usuario. ' +
      'IMPORTANTE: El usuario se guarda en DynamoDB SOLO después de verificar el código OTP. Si el código es incorrecto, el usuario NO se guarda en DynamoDB. ' +
      'El usuario debe estar registrado previamente (usando /auth/register). ' +
      'Requisitos: El usuario debe estar registrado (pero aún no verificado), el código OTP debe ser válido y no expirado, el código solo se puede usar una vez. ' +
      'Expiración: El código OTP expira después de 15 minutos. Si expira, solicita uno nuevo con /auth/resend-otp. ' +
      'Después de verificar: El usuario se guarda en DynamoDB, el usuario puede iniciar sesión normalmente, no es necesario verificar nuevamente.',
  })
  @ApiBody({
    type: VerifyOTPDto,
    description: 'Código OTP recibido por email',
    examples: {
      ejemplo1: {
        summary: 'Verificación de OTP',
        value: {
          email: 'usuario@example.com',
          role: 'model',
          otp: '123456',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Email verificado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Email verificado exitosamente. Tu cuenta ha sido activada.' },
        email: { type: 'string', example: 'usuario@example.com' },
        userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        role: { type: 'string', example: 'model' },
        verified: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Código OTP incorrecto, expirado o usuario ya verificado',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: 'El código OTP es incorrecto o ha expirado',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/verify-otp',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
    type: ErrorResponseDto,
  })
  async verifyOTP(@Body() verifyOTPDto: VerifyOTPDto) {
    const startTime = Date.now();
    
    try {
      const result = await this.authService.verifyOTP(verifyOTPDto);
      
      const duration = Date.now() - startTime;
      this.logger.log('OTP verificado exitosamente', 'verifyOTP', {
        email: verifyOTPDto.email,
        userId: result.userId,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de verificación exitosa
      this.metricsService?.recordOTPVerification(true).catch(() => {});
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al verificar OTP', error?.stack, 'verifyOTP', {
        email: verifyOTPDto.email,
        error: error.message,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de verificación fallida
      this.metricsService?.recordOTPVerification(false).catch(() => {});
      
      throw error;
    }
  }

  /**
   * POST /auth/resend-otp
   * Reenviar código OTP
   * 
   * **Endpoint Público** - No requiere autenticación
   * 
   * Reenvía el código OTP al email del usuario si no lo recibió o expiró.
   * 
   * **Notas importantes:**
   * - Hay un límite de reenvíos por minuto (rate limiting)
   * - Solo funciona si el usuario aún no está verificado
   * - El nuevo código tiene su propia validez
   */
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar código OTP',
    description: 'Reenvía el código OTP al email del usuario. ' +
      'Casos de uso: No recibiste el email con el código, el código expiró, perdiste el código. ' +
      'Rate Limiting: Solo puedes solicitar un nuevo código cada 1 minuto por email. ' +
      'Expiración: El código OTP expira después de 15 minutos. ' +
      'Solo funciona si el usuario aún no está verificado. Si excedes el límite, espera 1 minuto antes de intentar nuevamente.',
  })
  @ApiBody({
    type: ResendOTPDto,
    description: 'Email y rol del usuario',
    examples: {
      ejemplo1: {
        summary: 'Reenvío de OTP',
        value: {
          email: 'usuario@example.com',
          role: 'model',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Código OTP reenviado exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Código OTP reenviado exitosamente a tu email' },
        email: { type: 'string', example: 'usuario@example.com' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Usuario ya verificado o límite de intentos excedido',
    type: ErrorResponseDto,
    example: {
      statusCode: 400,
      message: 'El usuario ya está verificado',
      timestamp: '2024-01-01T00:00:00.000Z',
      path: '/api/v1/auth/resend-otp',
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
    type: ErrorResponseDto,
  })
  async resendOTP(@Body() resendOTPDto: ResendOTPDto) {
    const startTime = Date.now();
    
    try {
      const result = await this.authService.resendOTP(resendOTPDto);
      
      const duration = Date.now() - startTime;
      this.logger.log('OTP reenviado exitosamente', 'resendOTP', {
        email: resendOTPDto.email,
        duration: `${duration}ms`,
      });
      
      // Registrar métrica de reenvío de OTP
      this.metricsService?.recordOTPResend().catch(() => {});
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al reenviar OTP', error?.stack, 'resendOTP', {
        email: resendOTPDto.email,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * GET /auth/sessions
   * Listar sesiones activas del usuario
   * 
   * **Endpoint Privado** - Requiere autenticación
   * **OPCIONAL**: La gestión de sesiones es automática, esta ruta es solo para consulta
   * 
   * Retorna todas las sesiones activas del usuario autenticado.
   * Útil para ver en qué dispositivos está iniciada la sesión.
   * 
   * NOTA: La gestión de sesiones es automática. No necesitas llamar a este endpoint
   * para que funcione la multi-sesión. Los tokens se sincronizan automáticamente.
   */
  @Get('sessions')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '[Opcional] Listar sesiones activas',
    description: 'Retorna todas las sesiones activas del usuario autenticado. ' +
      'Útil para ver en qué dispositivos está iniciada la sesión y gestionar la seguridad de la cuenta. ' +
      'NOTA: La gestión de sesiones es automática. No necesitas llamar a este endpoint para que funcione la multi-sesión.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de sesiones activas',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              deviceName: { type: 'string', example: 'Chrome on Windows' },
              deviceType: { type: 'string', example: 'desktop' },
              lastActivity: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
              createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
              ipAddress: { type: 'string', example: '192.168.1.1' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
    type: ErrorResponseDto,
  })
  async getSessions(@Request() req: any) {
    const startTime = Date.now();
    
    try {
      // Obtener userId del token
      const userInfo = await this.authService.getMe(req.token);
      const email = userInfo.data.email;
      
      // Obtener userId desde DynamoDB
      const sessions = await this.sessionsService.getUserSessionsByEmail(email);
      
      // Remover información sensible (refreshToken)
      const safeSessions = sessions.map((session) => ({
        sessionId: session.sessionId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      }));

      const duration = Date.now() - startTime;
      this.logger.log('Sesiones obtenidas exitosamente', 'getSessions', {
        email,
        sessionCount: safeSessions.length,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        data: safeSessions,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al obtener sesiones', error?.stack, 'getSessions', {
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * DELETE /auth/sessions/:sessionId
   * Cerrar una sesión específica
   * 
   * **Endpoint Privado** - Requiere autenticación
   * **OPCIONAL**: Solo si necesitas cerrar una sesión específica
   * 
   * Cierra una sesión específica del usuario. Útil para cerrar sesión en un dispositivo específico.
   */
  @Delete('sessions/:sessionId')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '[Opcional] Cerrar sesión específica',
    description: 'Cierra una sesión específica del usuario autenticado. ' +
      'Útil para cerrar sesión en un dispositivo específico sin afectar otras sesiones activas. ' +
      'NOTA: La gestión de sesiones es automática. Esta ruta es opcional.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión cerrada exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Sesión cerrada exitosamente' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Sesión no encontrada',
    type: ErrorResponseDto,
  })
  async closeSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    const startTime = Date.now();
    
    try {
      const userInfo = await this.authService.getMe(req.token);
      const email = userInfo.data.email;
      
      // Obtener userId desde DynamoDB
      const sessions = await this.sessionsService.getUserSessionsByEmail(email);
      if (sessions.length === 0) {
        throw new NotFoundException('Usuario no encontrado');
      }
      const userId = sessions[0].userId;

      await this.sessionsService.closeSession(sessionId, userId);

      const duration = Date.now() - startTime;
      this.logger.log('Sesión cerrada exitosamente', 'closeSession', {
        email,
        sessionId,
        duration: `${duration}ms`,
      });

      // Registrar métrica de operación de sesión
      this.metricsService?.recordSessionOperation('close').catch(() => {});

      return {
        success: true,
        message: 'Sesión cerrada exitosamente',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al cerrar sesión', error?.stack, 'closeSession', {
        sessionId,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * DELETE /auth/sessions
   * Cerrar todas las sesiones
   * 
   * **Endpoint Privado** - Requiere autenticación
   * **OPCIONAL**: Solo si necesitas cerrar todas las sesiones
   * 
   * Cierra todas las sesiones activas del usuario. Útil para cerrar sesión en todos los dispositivos.
   */
  @Delete('sessions')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: '[Opcional] Cerrar todas las sesiones',
    description: 'Cierra todas las sesiones activas del usuario autenticado. ' +
      'Útil para cerrar sesión en todos los dispositivos de una vez, por ejemplo, si se perdió acceso a la cuenta. ' +
      'NOTA: La gestión de sesiones es automática. Esta ruta es opcional.',
  })
  @ApiResponse({
    status: 200,
    description: 'Todas las sesiones cerradas exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Todas las sesiones cerradas exitosamente' },
        closedCount: { type: 'number', example: 3 },
      },
    },
  })
  async closeAllSessions(@Request() req: any) {
    const startTime = Date.now();
    
    try {
      const userInfo = await this.authService.getMe(req.token);
      const email = userInfo.data.email;
      
      // Obtener userId desde DynamoDB
      const sessions = await this.sessionsService.getUserSessionsByEmail(email);
      if (sessions.length === 0) {
        throw new NotFoundException('Usuario no encontrado');
      }
      const userId = sessions[0].userId;

      const closedCount = await this.sessionsService.closeAllUserSessions(userId);

      const duration = Date.now() - startTime;
      this.logger.log('Todas las sesiones cerradas exitosamente', 'closeAllSessions', {
        email,
        closedCount,
        duration: `${duration}ms`,
      });

      // Registrar métrica de operación de sesión
      this.metricsService?.recordSessionOperation('closeAll').catch(() => {});

      return {
        success: true,
        message: 'Todas las sesiones cerradas exitosamente',
        closedCount,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error('Error al cerrar todas las sesiones', error?.stack, 'closeAllSessions', {
        error: error.message,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }
}
