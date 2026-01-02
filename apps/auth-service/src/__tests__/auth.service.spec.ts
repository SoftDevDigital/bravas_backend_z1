import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRole, AWSClientFactory, loadCredentials } from '@bravas/shared';
import { AuthService } from '../auth.service';
import { SessionsService } from '../sessions.service';

// Mock AWS SDK
jest.mock('@bravas/shared', () => ({
  ...jest.requireActual('@bravas/shared'),
  AWSClientFactory: {
    createCognitoClient: jest.fn(),
    createDynamoDBDocumentClient: jest.fn(),
  },
  loadCredentials: jest.fn(),
  calculateSecretHash: jest.fn((username, clientId, secret) => `hash-${username}`),
  validateAge: jest.fn((birthDate) => {
    const age = new Date().getFullYear() - birthDate.getFullYear();
    return age >= 18;
  }),
}));

describe('AuthService', () => {
  let service: AuthService;
  let sessionsService: SessionsService;
  let cognitoClient: any;
  let dynamoClient: any;

  const mockCredentials = {
    cognito: {
      userPoolId: 'test-pool-id',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
    dynamodb: {
      usersTable: 'test-users-table',
      userProfilesTable: 'test-user-profiles-table',
      userSessionsTable: 'test-sessions-table',
    },
  };

  beforeEach(async () => {
    // Mock Cognito client
    cognitoClient = {
      send: jest.fn(),
    };

    // Mock DynamoDB client
    dynamoClient = {
      send: jest.fn(),
    };

    // Mock AWSClientFactory
    (AWSClientFactory.createCognitoClient as jest.Mock).mockReturnValue(cognitoClient);
    (AWSClientFactory.createDynamoDBDocumentClient as jest.Mock).mockReturnValue(dynamoClient);
    (loadCredentials as jest.Mock).mockReturnValue(mockCredentials);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            createSession: jest.fn(),
            findSessionByDevice: jest.fn(),
            updateSessionActivity: jest.fn(),
            getUserSessionsByEmail: jest.fn(),
            closeSession: jest.fn(),
            closeAllUserSessions: jest.fn(),
            updateRefreshTokenForAllSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    sessionsService = module.get<SessionsService>(SessionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'Password123!',
        role: UserRole.USER,
        birthDate: '2000-01-01',
        country: 'AR',
      };

      (cognitoClient.send as jest.Mock)
        .mockResolvedValueOnce({ Users: [] }) // checkEmailExists
        .mockResolvedValueOnce({
          UserSub: 'cognito-sub-123',
        }); // SignUpCommand

      const result = await service.register(registerDto);

      expect(result.success).toBe(true);
      expect(result.email).toBe(registerDto.email);
      expect(result.requiresVerification).toBe(true);
    });

    it('should throw ConflictException if email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        role: UserRole.USER,
        birthDate: '2000-01-01',
      };

      (cognitoClient.send as jest.Mock).mockResolvedValueOnce({
        Users: [{ Username: 'existing-user' }],
      }); // checkEmailExists

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if user is underage', async () => {
      const registerDto = {
        email: 'minor@example.com',
        password: 'Password123!',
        role: UserRole.USER,
        birthDate: '2010-01-01',
      };

      // Mock validateAge to return false for this test
      const shared = require('@bravas/shared');
      const originalValidateAge = shared.validateAge;
      shared.validateAge = jest.fn().mockReturnValue(false);

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);

      // Restore original
      shared.validateAge = originalValidateAge;
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const deviceInfo = {
        deviceType: 'web' as const,
      };

      (cognitoClient.send as jest.Mock)
        .mockResolvedValueOnce({
          AuthenticationResult: {
            AccessToken: 'access-token',
            RefreshToken: 'refresh-token',
            IdToken: 'id-token',
            ExpiresIn: 3600,
          },
        }) // InitiateAuthCommand
        .mockResolvedValueOnce({
          UserAttributes: [{ Name: 'email', Value: 'test@example.com' }],
        }); // GetUserCommand

      (dynamoClient.send as jest.Mock).mockResolvedValueOnce({
        Items: [{ userId: 'user-123' }],
      }); // QueryCommand for userId

      (sessionsService.findSessionByDevice as jest.Mock).mockResolvedValue(null);
      (sessionsService.createSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-123',
      });

      const result = await service.login(loginDto, deviceInfo);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
      expect(result.data).toHaveProperty('sessionId');
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const error = new Error('Invalid credentials');
      error.name = 'NotAuthorizedException';
      (cognitoClient.send as jest.Mock).mockRejectedValue(error);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('should return user information', async () => {
      (cognitoClient.send as jest.Mock).mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'test@example.com' },
          { Name: 'custom:role', Value: 'user' },
        ],
        Username: 'test@example.com',
      });

      const result = await service.getMe('mock-access-token');

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      const error = new Error('Invalid token');
      error.name = 'NotAuthorizedException';
      (cognitoClient.send as jest.Mock).mockRejectedValue(error);

      await expect(service.getMe('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP successfully and create user in DynamoDB', async () => {
      const verifyOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
        otp: '123456',
      };

      (cognitoClient.send as jest.Mock)
        .mockResolvedValueOnce({
          Users: [{ Username: 'uuid-username' }],
        }) // getUsernameByEmail - ListUsersCommand
        .mockResolvedValueOnce({}) // ConfirmSignUpCommand
        .mockResolvedValueOnce({
          UserAttributes: [
            { Name: 'email', Value: 'test@example.com' },
            { Name: 'custom:role', Value: 'user' },
            { Name: 'sub', Value: 'cognito-sub-123' },
          ],
        }); // AdminGetUserCommand

      (dynamoClient.send as jest.Mock)
        .mockResolvedValueOnce({}) // PutCommand - users table
        .mockResolvedValueOnce({}); // PutCommand - user_profiles table

      const result = await service.verifyOTP(verifyOTPDto);

      expect(result.success).toBe(true);
      expect(result.email).toBe(verifyOTPDto.email);
      expect(result.verified).toBe(true);
      expect(result.userId).toBeDefined();
      expect(dynamoClient.send).toHaveBeenCalledTimes(2); // users and user_profiles
    });

    it('should throw BadRequestException if OTP is incorrect', async () => {
      const verifyOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
        otp: 'wrong-code',
      };

      const error = new Error('Invalid code');
      error.name = 'CodeMismatchException';

      (cognitoClient.send as jest.Mock)
        .mockResolvedValueOnce({
          Users: [{ Username: 'uuid-username' }],
        })
        .mockRejectedValueOnce(error); // ConfirmSignUpCommand

      await expect(service.verifyOTP(verifyOTPDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendOTP', () => {
    it('should resend OTP successfully', async () => {
      const resendOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
      };

      (cognitoClient.send as jest.Mock)
        .mockResolvedValueOnce({
          Users: [{ Username: 'uuid-username' }],
        }) // getUsernameByEmail
        .mockResolvedValueOnce({}); // ResendConfirmationCodeCommand

      const result = await service.resendOTP(resendOTPDto);

      expect(result.success).toBe(true);
      expect(result.email).toBe(resendOTPDto.email);
    });

    it('should throw BadRequestException if rate limit is exceeded', async () => {
      const resendOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
      };

      // Simular que hay una solicitud reciente
      const serviceAny = service as any;
      serviceAny.resendOTPRateLimit.set(resendOTPDto.email, Date.now() - 1000); // Hace 1 segundo

      await expect(service.resendOTP(resendOTPDto)).rejects.toThrow(BadRequestException);
    });
  });
});

