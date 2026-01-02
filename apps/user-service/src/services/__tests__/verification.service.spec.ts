import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { VerificationService } from '../verification.service';
import { AutomationService } from '../automation.service';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';

// Mock AWS SDK
jest.mock('@bravas/shared', () => ({
  ...jest.requireActual('@bravas/shared'),
  AWSClientFactory: {
    createDynamoDBDocumentClient: jest.fn(),
    createS3Client: jest.fn(),
  },
  loadCredentials: jest.fn(),
}));

describe('VerificationService', () => {
  let service: VerificationService;
  let dynamoClient: jest.Mocked<DynamoDBDocumentClient>;
  let configService: ConfigService;
  let automationService: AutomationService;

  const mockCredentials = {
    dynamodb: {
      verificationsTable: 'test-verifications-table',
    },
    s3: {
      verificationDocsBucket: 'test-verification-docs-bucket',
    },
  };

  const mockVerification = {
    verificationId: 'verification123',
    userId: 'user123',
    status: 'pending_upload',
    submittedAt: '2025-01-01T00:00:00Z',
    selfieUrl: 's3://bucket/selfie.jpg',
    documentFrontUrl: 's3://bucket/id-front.jpg',
    documentBackUrl: 's3://bucket/id-back.jpg',
  };

  beforeEach(async () => {
    // Mock DynamoDB client
    dynamoClient = {
      send: jest.fn(),
    } as any;

    // Mock AWSClientFactory
    (AWSClientFactory.createDynamoDBDocumentClient as jest.Mock).mockReturnValue(dynamoClient);
    (AWSClientFactory.createS3Client as jest.Mock).mockReturnValue({ send: jest.fn() });
    (loadCredentials as jest.Mock).mockReturnValue(mockCredentials);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                DYNAMODB_VERIFICATIONS_TABLE: 'test-verifications-table',
                S3_VERIFICATION_DOCS_BUCKET: 'test-verification-docs-bucket',
              };
              return config[key];
            }),
          },
        },
        {
          provide: AutomationService,
          useValue: {
            automateDocumentVerification: jest.fn().mockResolvedValue({
              approved: true,
              confidence: 0.95,
            }),
            publishEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    configService = module.get<ConfigService>(ConfigService);
    automationService = module.get<AutomationService>(AutomationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getVerificationStatus', () => {
    it('should return verification status if exists', async () => {
      (dynamoClient.send as jest.Mock).mockResolvedValue({
        Items: [mockVerification],
      });

      const result = await service.getVerificationStatus('user123');

      expect(result.status).toBe('pending_upload');
      expect(result.verificationId).toBe('verification123');
      expect(dynamoClient.send).toHaveBeenCalledWith(expect.any(QueryCommand));
    });

    it('should return not_started if no verification exists', async () => {
      (dynamoClient.send as jest.Mock).mockResolvedValue({
        Items: [],
      });

      const result = await service.getVerificationStatus('user123');

      expect(result.status).toBe('not_started');
    });

    it('should handle errors gracefully', async () => {
      (dynamoClient.send as jest.Mock).mockRejectedValue(new Error('DynamoDB error'));

      const result = await service.getVerificationStatus('user123');

      expect(result.status).toBe('not_started');
    });
  });

  describe('completeVerification', () => {
    it('should complete verification successfully', async () => {
      (dynamoClient.send as jest.Mock)
        .mockResolvedValueOnce({ Item: mockVerification }) // Get verification
        .mockResolvedValueOnce({}); // Update verification

      const result = await service.completeVerification('user123', 'verification123');

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
    });

    it('should throw NotFoundException if verification does not exist', async () => {
      (dynamoClient.send as jest.Mock).mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.completeVerification('user123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if documents are incomplete', async () => {
      const incompleteVerification = {
        verificationId: 'verification123',
        userId: 'user123',
        status: 'pending_upload',
        selfieUrl: 's3://bucket/selfie.jpg',
        // Missing documentFrontUrl
      };

      (dynamoClient.send as jest.Mock).mockResolvedValueOnce({ Item: incompleteVerification });

      await expect(
        service.completeVerification('user123', 'verification123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger automation service for verification', async () => {
      (dynamoClient.send as jest.Mock)
        .mockResolvedValueOnce({ Item: mockVerification })
        .mockResolvedValueOnce({});

      await service.completeVerification('user123', 'verification123');

      // Wait for async automation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(automationService.automateDocumentVerification).toHaveBeenCalled();
    });
  });

  // uploadVerificationDocument method doesn't exist in the service
  // Tests removed as the method is not implemented
});

