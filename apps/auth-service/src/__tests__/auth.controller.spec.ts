import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@bravas/shared';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { SessionsService } from '../sessions.service';
import { LoggerService } from '../common/logger/logger.service';
import { MetricsService } from '../services/metrics.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let sessionsService: SessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            getMe: jest.fn(),
            verifyOTP: jest.fn(),
            resendOTP: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            getUserSessionsByEmail: jest.fn(),
            closeSession: jest.fn(),
            closeAllUserSessions: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordRegistration: jest.fn().mockResolvedValue(undefined),
            recordLogin: jest.fn().mockResolvedValue(undefined),
            recordOTPVerification: jest.fn().mockResolvedValue(undefined),
            recordOTPResend: jest.fn().mockResolvedValue(undefined),
            recordTokenRefresh: jest.fn().mockResolvedValue(undefined),
            recordSessionOperation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    sessionsService = module.get<SessionsService>(SessionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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

      const mockResult = {
        success: true,
        message: 'Registro exitoso',
        email: 'test@example.com',
        requiresVerification: true,
      };

      (authService.register as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockResult);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should throw ConflictException if email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        role: UserRole.USER,
        birthDate: '2000-01-01',
      };

      (authService.register as jest.Mock).mockRejectedValue(
        new ConflictException('El email ya está registrado'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if user is underage', async () => {
      const registerDto = {
        email: 'minor@example.com',
        password: 'Password123!',
        role: UserRole.USER,
        birthDate: '2010-01-01', // Menor de edad
      };

      (authService.register as jest.Mock).mockRejectedValue(
        new BadRequestException('Debes ser mayor de edad para registrarte'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const mockResult = {
        success: true,
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          idToken: 'mock-id-token',
          expiresIn: 3600,
          sessionId: 'session-123',
        },
      };

      (authService.login as jest.Mock).mockResolvedValue(mockResult);

      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '192.168.1.1',
      };

      const result = await controller.login(loginDto, req as any);

      expect(result).toEqual(mockResult);
      expect(authService.login).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
        ip: '192.168.1.1',
      };

      (authService.login as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Email o contraseña incorrectos'),
      );

      await expect(controller.login(loginDto, req as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const refreshDto = {
        refreshToken: 'mock-refresh-token',
        email: 'test@example.com',
      };

      const mockResult = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          idToken: 'new-id-token',
          expiresIn: 3600,
        },
      };

      (authService.refreshToken as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.refresh(refreshDto);

      expect(result).toEqual(mockResult);
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshDto);
    });
  });

  describe('getMe', () => {
    it('should return user information', async () => {
      const mockResult = {
        success: true,
        data: {
          email: 'test@example.com',
          username: 'test@example.com',
          attributes: [],
        },
      };

      (authService.getMe as jest.Mock).mockResolvedValue(mockResult);

      const req = { token: 'mock-access-token' };
      const result = await controller.getMe(req as any);

      expect(result).toEqual(mockResult);
      expect(authService.getMe).toHaveBeenCalledWith('mock-access-token');
    });
  });

  describe('verifyOTP', () => {
    it('should verify OTP successfully', async () => {
      const verifyOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
        otp: '123456',
      };

      const mockResult = {
        success: true,
        message: 'Email verificado exitosamente',
        email: 'test@example.com',
        userId: 'user-123',
        role: 'user',
        verified: true,
      };

      (authService.verifyOTP as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.verifyOTP(verifyOTPDto);

      expect(result).toEqual(mockResult);
      expect(authService.verifyOTP).toHaveBeenCalledWith(verifyOTPDto);
    });

    it('should throw BadRequestException if OTP is invalid', async () => {
      const verifyOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
        otp: 'wrong-code',
      };

      (authService.verifyOTP as jest.Mock).mockRejectedValue(
        new BadRequestException('El código OTP es incorrecto o ha expirado'),
      );

      await expect(controller.verifyOTP(verifyOTPDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendOTP', () => {
    it('should resend OTP successfully', async () => {
      const resendOTPDto = {
        email: 'test@example.com',
        role: UserRole.USER,
      };

      const mockResult = {
        success: true,
        message: 'Código OTP reenviado exitosamente',
        email: 'test@example.com',
      };

      (authService.resendOTP as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.resendOTP(resendOTPDto);

      expect(result).toEqual(mockResult);
      expect(authService.resendOTP).toHaveBeenCalledWith(resendOTPDto);
    });
  });

  describe('getSessions', () => {
    it('should return user sessions', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          deviceName: 'Chrome on Windows',
          deviceType: 'desktop',
          lastActivity: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ];

      (authService.getMe as jest.Mock).mockResolvedValue({
        success: true,
        data: { email: 'test@example.com' },
      });
      (sessionsService.getUserSessionsByEmail as jest.Mock).mockResolvedValue(mockSessions);

      const req = { token: 'mock-access-token' };
      const result = await controller.getSessions(req as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('refreshToken'); // No debe exponer refreshToken
    });
  });

  describe('closeSession', () => {
    it('should close session successfully', async () => {
      (authService.getMe as jest.Mock).mockResolvedValue({
        success: true,
        data: { email: 'test@example.com' },
      });
      (sessionsService.getUserSessionsByEmail as jest.Mock).mockResolvedValue([
        { userId: 'user-123' },
      ]);
      (sessionsService.closeSession as jest.Mock).mockResolvedValue(undefined);

      const req = { token: 'mock-access-token' };
      const result = await controller.closeSession(req as any, 'session-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Sesión cerrada exitosamente');
    });

    it('should throw NotFoundException if user not found', async () => {
      (authService.getMe as jest.Mock).mockResolvedValue({
        success: true,
        data: { email: 'test@example.com' },
      });
      (sessionsService.getUserSessionsByEmail as jest.Mock).mockResolvedValue([]);

      const req = { token: 'mock-access-token' };

      await expect(controller.closeSession(req as any, 'session-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('closeAllSessions', () => {
    it('should close all sessions successfully', async () => {
      (authService.getMe as jest.Mock).mockResolvedValue({
        success: true,
        data: { email: 'test@example.com' },
      });
      (sessionsService.getUserSessionsByEmail as jest.Mock).mockResolvedValue([
        { userId: 'user-123' },
      ]);
      (sessionsService.closeAllUserSessions as jest.Mock).mockResolvedValue(3);

      const req = { token: 'mock-access-token' };
      const result = await controller.closeAllSessions(req as any);

      expect(result.success).toBe(true);
      expect(result.closedCount).toBe(3);
    });
  });
});


