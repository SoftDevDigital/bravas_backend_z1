import { Test, TestingModule } from '@nestjs/testing';
import { VerificationController } from '../verification.controller';
import { VerificationService } from '../../services/verification.service';
import { getUserFromToken } from '../../helpers/auth.helper';

// Mock getUserFromToken
jest.mock('../../helpers/auth.helper', () => ({
  getUserFromToken: jest.fn(),
}));

describe('VerificationController', () => {
  let controller: VerificationController;
  let verificationService: VerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        {
          provide: VerificationService,
          useValue: {
            initiateVerification: jest.fn(),
            completeVerification: jest.fn(),
            getVerificationStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VerificationController>(VerificationController);
    verificationService = module.get<VerificationService>(VerificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiateVerification', () => {
    it('should initiate verification successfully', async () => {
      (getUserFromToken as jest.Mock).mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      const mockResult = {
        verificationId: 'verification123',
        uploadUrls: {
          selfie: 'https://s3.amazonaws.com/upload-url-1',
          documentFront: 'https://s3.amazonaws.com/upload-url-2',
        },
        expiresIn: 3600,
      };

      (verificationService.initiateVerification as jest.Mock).mockResolvedValue(mockResult);

      const req = { token: 'mock-token' };
      const result = await controller.initiateVerification(req as any, {
        documentType: 'id_card',
      });

      expect(result).toEqual(mockResult);
      expect(verificationService.initiateVerification).toHaveBeenCalledWith(
        'user123',
        'id_card',
      );
    });
  });

  describe('completeVerification', () => {
    it('should complete verification successfully', async () => {
      (getUserFromToken as jest.Mock).mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      const mockResult = {
        success: true,
        message: 'Verificación completada',
        status: 'pending_review',
      };

      (verificationService.completeVerification as jest.Mock).mockResolvedValue(mockResult);

      const req = { token: 'mock-token' };
      const result = await controller.completeVerification(req as any, {
        verificationId: 'verification123',
      });

      expect(result).toEqual(mockResult);
      expect(verificationService.completeVerification).toHaveBeenCalledWith(
        'user123',
        'verification123',
      );
    });
  });

  describe('getVerificationStatus', () => {
    it('should return verification status', async () => {
      (getUserFromToken as jest.Mock).mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      const mockResult = {
        status: 'pending_review',
        verificationId: 'verification123',
      };

      (verificationService.getVerificationStatus as jest.Mock).mockResolvedValue(mockResult);

      const req = { token: 'mock-token' };
      const result = await controller.getVerificationStatus(req as any);

      expect(result).toEqual(mockResult);
      expect(verificationService.getVerificationStatus).toHaveBeenCalledWith('user123');
    });
  });
});

