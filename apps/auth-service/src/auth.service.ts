import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AuthFlowType,
  GetUserCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, calculateSecretHash, validateAge, loadCredentials } from '@bravas/shared';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { VerifyOTPDto } from './dto/verify-otp.dto';
import { ResendOTPDto } from './dto/resend-otp.dto';
import { SessionsService } from './sessions.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private dynamoClient: DynamoDBDocumentClient;
  private credentials: ReturnType<typeof loadCredentials>;
  
  // Rate limiting para resend-otp: almacena el timestamp de la última solicitud por email
  // Key: email, Value: timestamp en milisegundos
  private resendOTPRateLimit: Map<string, number> = new Map();
  private readonly RESEND_OTP_COOLDOWN_MS = 60 * 1000; // 1 minuto en milisegundos

  constructor(
    private configService: ConfigService,
    private sessionsService: SessionsService,
  ) {
    this.credentials = loadCredentials();
    // TypeScript puede tener problemas resolviendo tipos desde librería compartida
    // Los type assertions aseguran que TypeScript reconozca los métodos correctamente
    this.cognitoClient = AWSClientFactory.createCognitoClient() as CognitoIdentityProviderClient;
    this.dynamoClient = AWSClientFactory.createDynamoDBDocumentClient() as DynamoDBDocumentClient;
    
    // Limpiar el Map periódicamente para evitar memory leaks (cada 10 minutos)
    setInterval(() => {
      const now = Date.now();
      for (const [email, timestamp] of this.resendOTPRateLimit.entries()) {
        if (now - timestamp > this.RESEND_OTP_COOLDOWN_MS) {
          this.resendOTPRateLimit.delete(email);
        }
      }
    }, 10 * 60 * 1000); // Cada 10 minutos
  }

  /**
   * Verificar si un email ya está registrado en Cognito
   */
  private async checkEmailExists(email: string): Promise<boolean> {
    try {
      const listUsersCommand = new ListUsersCommand({
        UserPoolId: this.credentials.cognito.userPoolId,
        Filter: `email = "${email}"`,
        Limit: 1,
      });

      const response = await this.cognitoClient.send(listUsersCommand);
      return (response.Users?.length ?? 0) > 0;
    } catch (error) {
      // Si hay error al verificar, intentamos el registro de todas formas
      // y manejamos el error allí
      return false;
    }
  }

  /**
   * Registro de usuario
   * 1. Valida edad (mayoría de edad)
   * 2. Valida que el rol sea público (user, model, agency)
   * 3. Verifica que el email no exista
   * 4. Registra en Cognito (NO guarda en DynamoDB todavía)
   * 5. Envía código OTP por email
   * 
   * NOTA: El usuario se guarda en DynamoDB SOLO después de verificar el OTP
   * NOTA: Los roles administrativos (admin, support, moderator) NO se pueden registrar públicamente
   */
  async register(registerDto: RegisterDto) {
    // Validar edad
    const birthDate = new Date(registerDto.birthDate);
    if (!validateAge(birthDate)) {
      throw new BadRequestException('Debes ser mayor de edad para registrarte');
    }

    // Validar que el rol sea público (no admin, support, moderator)
    const publicRoles = ['user', 'model', 'agency'];
    if (!publicRoles.includes(registerDto.role)) {
      throw new BadRequestException(
        'Los roles administrativos (admin, support, moderator) no se pueden registrar públicamente. ' +
        'Solo se pueden registrar: user, model, agency'
      );
    }

    // Verificar si el email ya está registrado
    const emailExists = await this.checkEmailExists(registerDto.email);
    if (emailExists) {
      throw new ConflictException('El email ya está registrado');
    }

    // Generar username único (UUID) porque Cognito tiene email como alias
    // Cuando email es alias, no puedes usar email como username
    const username = randomUUID();
    
    // Calcular secret hash para Cognito usando el username generado
    const secretHash = calculateSecretHash(
      username,
      this.credentials.cognito.clientId,
      this.credentials.cognito.clientSecret,
    );

    try {
      // Registrar en Cognito (esto envía automáticamente el código OTP por email)
      const signUpCommand = new SignUpCommand({
        ClientId: this.credentials.cognito.clientId,
        SecretHash: secretHash,
        Username: username, // Usar UUID como username, email va en atributos
        Password: registerDto.password,
        UserAttributes: [
          { Name: 'email', Value: registerDto.email },
          { Name: 'custom:role', Value: registerDto.role },
          { Name: 'custom:country', Value: registerDto.country || '' },
        ],
      });

      const cognitoResponse = await this.cognitoClient.send(signUpCommand);

      // NO guardamos en DynamoDB todavía
      // El usuario se guardará después de verificar el OTP en verifyOTP()

      return {
        success: true,
        message: 'Registro exitoso. Por favor verifica tu email con el código OTP enviado. El código expira en 15 minutos.',
        email: registerDto.email,
        role: registerDto.role,
        cognitoSub: cognitoResponse.UserSub, // Guardamos esto temporalmente para usar en verifyOTP
        requiresVerification: true,
      };
    } catch (error: any) {
      // Capturar diferentes tipos de errores de email duplicado
      if (
        error.name === 'UsernameExistsException' ||
        error.name === 'AliasExistsException' ||
        error.code === 'UsernameExistsException' ||
        error.code === 'AliasExistsException'
      ) {
        throw new ConflictException('El email ya está registrado');
      }
      
      // Si el mensaje de error menciona que el email ya existe
      if (error.message && (
        error.message.includes('already exists') ||
        error.message.includes('already registered') ||
        error.message.includes('ya está registrado') ||
        error.message.includes('email') && error.message.includes('exists')
      )) {
        throw new ConflictException('El email ya está registrado');
      }
      
      throw new BadRequestException(error.message || 'Error al registrar usuario');
    }
  }

  /**
   * Login de usuario
   * Retorna tokens de acceso y refresh
   * GESTIÓN AUTOMÁTICA DE SESIONES: Detecta sesiones existentes o crea nuevas automáticamente
   */
  async login(loginDto: LoginDto, deviceInfo?: {
    deviceId?: string;
    deviceName?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet' | 'web';
    ipAddress?: string;
    userAgent?: string;
  }) {
    const secretHash = calculateSecretHash(
      loginDto.email,
      this.credentials.cognito.clientId,
      this.credentials.cognito.clientSecret,
    );

    try {
      const authCommand = new InitiateAuthCommand({
        ClientId: this.credentials.cognito.clientId,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: loginDto.email,
          PASSWORD: loginDto.password,
          SECRET_HASH: secretHash,
        },
      });

      const response = await this.cognitoClient.send(authCommand);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Obtener información del usuario para crear la sesión
      const userInfo = await this.cognitoClient.send(
        new GetUserCommand({
          AccessToken: response.AuthenticationResult.AccessToken!,
        }),
      );

      const emailAttribute = userInfo.UserAttributes?.find((attr) => attr.Name === 'email');
      const email = emailAttribute?.Value || loginDto.email;
      
      // Obtener el rol del usuario
      const roleAttribute = userInfo.UserAttributes?.find((attr) => attr.Name === 'custom:role');
      const role = roleAttribute?.Value || 'user';

      // Buscar userId en DynamoDB usando el email (índice email-index en users table)
      let userId: string | undefined;
      try {
        const userResponse = await this.dynamoClient.send(
          new QueryCommand({
            TableName: this.credentials.dynamodb.usersTable,
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
              ':email': email,
            },
            Limit: 1,
          }),
        );
        userId = userResponse.Items?.[0]?.userId || userResponse.Items?.[0]?.id;
      } catch (error) {
        // Si no encontramos por email, usamos el email como identificador temporal
        console.warn('No se pudo obtener userId de DynamoDB, usando email como identificador');
      }

      // GESTIÓN AUTOMÁTICA DE SESIONES
      // 1. Buscar si existe una sesión para este dispositivo
      // 2. Si existe, actualizarla con el nuevo refreshToken
      // 3. Si no existe, crear una nueva sesión
      let sessionId: string | undefined;
      try {
        const existingSession = await this.sessionsService.findSessionByDevice(
          email,
          deviceInfo?.deviceId,
          deviceInfo?.userAgent,
        );

        if (existingSession) {
          // Actualizar sesión existente con nuevo refreshToken
          await this.sessionsService.updateSessionActivity(existingSession.sessionId);
          // Actualizar refreshToken en esta sesión específica
          await this.dynamoClient.send(
            new UpdateCommand({
              TableName: this.credentials.dynamodb.userSessionsTable,
              Key: { sessionId: existingSession.sessionId },
              UpdateExpression: 'SET refreshToken = :refreshToken, lastActivity = :lastActivity',
              ExpressionAttributeValues: {
                ':refreshToken': response.AuthenticationResult.RefreshToken!,
                ':lastActivity': new Date().toISOString(),
              },
            }),
          );
          sessionId = existingSession.sessionId;
        } else {
          // Crear nueva sesión
          const session = await this.sessionsService.createSession(
            userId || email,
            email,
            response.AuthenticationResult.RefreshToken!,
            deviceInfo || {
              deviceType: 'web',
            },
          );
          sessionId = session.sessionId;
        }
      } catch (error: any) {
        // Si falla la gestión de sesión, no es crítico - el login sigue funcionando
        console.warn('No se pudo gestionar sesión en DynamoDB:', error.message);
      }

      return {
        success: true,
        data: {
          accessToken: response.AuthenticationResult.AccessToken,
          refreshToken: response.AuthenticationResult.RefreshToken,
          idToken: response.AuthenticationResult.IdToken,
          expiresIn: response.AuthenticationResult.ExpiresIn,
          role, // Incluir el rol del usuario
          sessionId, // Incluir sessionId (opcional, para referencia del cliente)
        },
      };
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
        throw new UnauthorizedException('Email o contraseña incorrectos');
      }
      throw new BadRequestException(error.message || 'Error al iniciar sesión');
    }
  }

  /**
   * Refresh token
   * Obtiene nuevos tokens usando refresh token de Cognito
   * SINCRONIZACIÓN AUTOMÁTICA: Actualiza tokens en TODAS las sesiones activas del usuario
   * 
   * IMPORTANTE: El email es requerido porque el refresh token de Cognito es opaco
   * y no podemos extraer el username directamente
   */
  async refreshToken(refreshDto: RefreshTokenDto) {
    try {
      if (!refreshDto.email) {
        throw new BadRequestException('El email es requerido para refrescar el token');
      }

      // Calcular secret hash usando el email como username
      const secretHash = calculateSecretHash(
        refreshDto.email,
        this.credentials.cognito.clientId,
        this.credentials.cognito.clientSecret,
      );

      // Usar REFRESH_TOKEN_AUTH para obtener nuevos tokens
      const authCommand = new InitiateAuthCommand({
        ClientId: this.credentials.cognito.clientId,
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters: {
          REFRESH_TOKEN: refreshDto.refreshToken,
          SECRET_HASH: secretHash,
        },
      });

      const response = await this.cognitoClient.send(authCommand);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('No se pudieron renovar los tokens');
      }

      const newRefreshToken = response.AuthenticationResult.RefreshToken || refreshDto.refreshToken;

      // Obtener información del usuario para incluir el rol
      let role = 'user'; // Valor por defecto
      try {
        const userInfo = await this.cognitoClient.send(
          new GetUserCommand({
            AccessToken: response.AuthenticationResult.AccessToken!,
          }),
        );
        const roleAttribute = userInfo.UserAttributes?.find((attr) => attr.Name === 'custom:role');
        role = roleAttribute?.Value || 'user';
      } catch (error) {
        // Si falla obtener el rol, usamos el valor por defecto
        console.warn('No se pudo obtener el rol del usuario al refrescar token');
      }

      // SINCRONIZACIÓN AUTOMÁTICA: Actualizar refreshToken en TODAS las sesiones activas
      // Esto permite que todas las sesiones del usuario se mantengan sincronizadas
      try {
        const updatedSessions = await this.sessionsService.updateRefreshTokenForAllSessions(
          refreshDto.email,
          newRefreshToken,
        );
        
        // Si hay sessionId específico, actualizar también su última actividad
        if (refreshDto.sessionId) {
          await this.sessionsService.updateSessionActivity(refreshDto.sessionId);
        }
        
        // Log para debugging (opcional)
        if (updatedSessions > 0) {
          console.log(`Tokens sincronizados en ${updatedSessions} sesión(es) para ${refreshDto.email}`);
        }
      } catch (error: any) {
        // No es crítico si falla la sincronización - los tokens siguen siendo válidos
        console.warn('No se pudo sincronizar tokens en todas las sesiones:', error.message);
      }

      return {
        success: true,
        data: {
          accessToken: response.AuthenticationResult.AccessToken,
          refreshToken: newRefreshToken,
          idToken: response.AuthenticationResult.IdToken,
          expiresIn: response.AuthenticationResult.ExpiresIn,
          role, // Incluir el rol del usuario
        },
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw new InternalServerErrorException(
        `Error al refrescar el token: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  /**
   * Obtener información del usuario actual
   * Requiere token válido en el header
   */
  async getMe(accessToken: string) {
    try {
      const getUserCommand = new GetUserCommand({
        AccessToken: accessToken,
      });

      const cognitoUser = await this.cognitoClient.send(getUserCommand);

      // Obtener perfil de DynamoDB
      const emailAttribute = cognitoUser.UserAttributes?.find((attr) => attr.Name === 'email');
      const email = emailAttribute?.Value;

      if (!email) {
        throw new UnauthorizedException('No se pudo obtener información del usuario');
      }

      // Buscar usuario en DynamoDB por email (necesitarías un índice GSI)
      // Por ahora, simplificamos retornando info de Cognito
      return {
        success: true,
        data: {
          email,
          attributes: cognitoUser.UserAttributes,
          username: cognitoUser.Username,
        },
      };
    } catch (error: any) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Obtener el username de Cognito a partir del email
   * Necesario porque usamos UUID como username pero necesitamos el username para confirmar
   */
  private async getUsernameByEmail(email: string): Promise<string> {
    try {
      const listUsersCommand = new ListUsersCommand({
        UserPoolId: this.credentials.cognito.userPoolId,
        Filter: `email = "${email}"`,
        Limit: 1,
      });

      const response = await this.cognitoClient.send(listUsersCommand);
      
      if (!response.Users || response.Users.length === 0) {
        throw new NotFoundException('Usuario no encontrado');
      }

      const username = response.Users[0].Username;
      if (!username) {
        throw new NotFoundException('No se pudo obtener el username del usuario');
      }

      return username;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al buscar el usuario por email');
    }
  }

  /**
   * Verifica el código OTP enviado por email
   * 1. Verifica el código OTP en Cognito
   * 2. Si es correcto, confirma el registro en Cognito
   * 3. Obtiene los datos del usuario de Cognito
   * 4. Guarda el usuario en DynamoDB (users y user_profiles)
   * 
   * IMPORTANTE: El usuario se guarda en DynamoDB SOLO después de verificar el OTP
   */
  async verifyOTP(dto: VerifyOTPDto) {
    try {
      // Obtener el username del usuario usando el email
      const username = await this.getUsernameByEmail(dto.email);

      // Calcular secret hash usando el username
      const secretHash = calculateSecretHash(
        username,
        this.credentials.cognito.clientId,
        this.credentials.cognito.clientSecret,
      );

      // Confirmar el registro en Cognito (verifica el código OTP)
      const confirmCommand = new ConfirmSignUpCommand({
        ClientId: this.credentials.cognito.clientId,
        Username: username,
        ConfirmationCode: dto.otp,
        SecretHash: secretHash,
      });

      await this.cognitoClient.send(confirmCommand);

      // Obtener información completa del usuario de Cognito
      const userInfo = await this.cognitoClient.send(
        new AdminGetUserCommand({
          UserPoolId: this.credentials.cognito.userPoolId,
          Username: username,
        }),
      );

      // Extraer atributos del usuario
      const userAttributes = userInfo.UserAttributes || [];
      const emailAttr = userAttributes.find((attr) => attr.Name === 'email');
      const roleAttr = userAttributes.find((attr) => attr.Name === 'custom:role');
      const countryAttr = userAttributes.find((attr) => attr.Name === 'custom:country');
      const birthdateAttr = userAttributes.find((attr) => attr.Name === 'birthdate');

      const email = emailAttr?.Value || dto.email;
      const role = roleAttr?.Value || dto.role;
      const country = countryAttr?.Value || '';
      const birthDate = birthdateAttr?.Value || '';

      // Obtener el UserSub (sub) del usuario
      // El UserSub está en el atributo 'sub' o podemos usar el Username como identificador único
      // Como usamos UUID como username, podemos usarlo como cognitoSub
      // Pero mejor obtenemos el sub real de los atributos si existe
      const subAttr = userAttributes.find((attr) => attr.Name === 'sub');
      const cognitoSub = subAttr?.Value || username; // Usar username (UUID) como fallback

      // Crear perfil en DynamoDB (AHORA SÍ se guarda después de verificar)
      const userId = randomUUID();
      const userProfile = {
        userId,
        cognitoSub,
        email,
        role,
        birthDate: birthDate || new Date().toISOString().split('T')[0],
        country,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Guardar en tabla users
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.credentials.dynamodb.usersTable,
          Item: {
            id: userId,
            ...userProfile,
          },
        }),
      );

      // Guardar en tabla user_profiles
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.credentials.dynamodb.userProfilesTable,
          Item: userProfile,
        }),
      );

      return {
        success: true,
        message: 'Email verificado exitosamente. Tu cuenta ha sido activada.',
        email,
        userId,
        role,
        verified: true,
      };
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new BadRequestException('El código OTP es incorrecto o ha expirado');
      }
      if (error.name === 'ExpiredCodeException') {
        throw new BadRequestException('El código OTP ha expirado. Por favor solicita uno nuevo');
      }
      if (error.name === 'UserNotFoundException' || error instanceof NotFoundException) {
        throw new NotFoundException('Usuario no encontrado');
      }
      if (error.name === 'NotAuthorizedException') {
        throw new BadRequestException('El usuario ya está verificado');
      }
      if (error.name === 'AliasExistsException') {
        throw new BadRequestException('El email ya está verificado');
      }
      throw new InternalServerErrorException(
        `Error al verificar el código OTP: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  /**
   * Reenvía el código OTP al email del usuario
   * 
   * Rate Limiting: Solo se puede solicitar un nuevo código cada 1 minuto por email
   * Expiración OTP: El código OTP expira después de 15 minutos (manejado por Cognito)
   */
  async resendOTP(dto: ResendOTPDto) {
    try {
      // Verificar rate limiting: solo 1 solicitud por minuto por email
      const lastRequestTime = this.resendOTPRateLimit.get(dto.email);
      const now = Date.now();
      
      if (lastRequestTime) {
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < this.RESEND_OTP_COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((this.RESEND_OTP_COOLDOWN_MS - timeSinceLastRequest) / 1000);
          throw new BadRequestException(
            `Debes esperar ${remainingSeconds} segundo(s) antes de solicitar un nuevo código OTP. Solo puedes solicitar uno nuevo cada 1 minuto.`,
          );
        }
      }

      // Obtener el username del usuario usando el email
      const username = await this.getUsernameByEmail(dto.email);

      // Calcular secret hash usando el username
      const secretHash = calculateSecretHash(
        username,
        this.credentials.cognito.clientId,
        this.credentials.cognito.clientSecret,
      );

      // Reenviar código de confirmación
      const resendCommand = new ResendConfirmationCodeCommand({
        ClientId: this.credentials.cognito.clientId,
        Username: username,
        SecretHash: secretHash,
      });

      await this.cognitoClient.send(resendCommand);

      // Actualizar el timestamp de la última solicitud
      this.resendOTPRateLimit.set(dto.email, now);

      return {
        success: true,
        message: 'Código OTP reenviado exitosamente a tu email. El código expira en 15 minutos.',
        email: dto.email,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error; // Re-lanzar errores de rate limiting
      }
      if (error.name === 'UserNotFoundException' || error instanceof NotFoundException) {
        throw new NotFoundException('Usuario no encontrado');
      }
      if (error.name === 'InvalidParameterException') {
        throw new BadRequestException('El usuario ya está verificado');
      }
      if (error.name === 'LimitExceededException') {
        throw new BadRequestException('Has excedido el límite de intentos. Por favor espera unos minutos');
      }
      throw new InternalServerErrorException(
        `Error al reenviar el código OTP: ${error.message || 'Error desconocido'}`,
      );
    }
  }
}
