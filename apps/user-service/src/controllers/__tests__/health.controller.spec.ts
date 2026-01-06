import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from '../health.controller';
import { CacheService } from '../../services/cache.service';
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

describe('HealthController', () => {
  let controller: HealthController;
  let cacheService: CacheService;

  const mockCredentials = {
    dynamodb: {
      usersTable: 'test-users-table',
    },
    s3: {
      avatarsBucket: 'test-avatars-bucket',
    },
    cognito: {
      userPoolId: 'test-pool-id',
    },
  };

  beforeEach(async () => {
    (loadCredentials as jest.Mock).mockReturnValue(mockCredentials);
    (AWSClientFactory.createDynamoDBDocumentClient as jest.Mock).mockReturnValue({
      send: jest.fn(),
    });
    (AWSClientFactory.createS3Client as jest.Mock).mockReturnValue({
      send: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('basicHealthCheck', () => {
    it('should return basic health status', async () => {
      const result = await controller.basicHealthCheck();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('detailedHealthCheck', () => {
    it('should return detailed health status', async () => {
      const dynamoClient = (AWSClientFactory.createDynamoDBDocumentClient as jest.Mock)();
      const s3Client = (AWSClientFactory.createS3Client as jest.Mock)();

      (dynamoClient.send as jest.Mock).mockResolvedValue({});
      (s3Client.send as jest.Mock).mockResolvedValue({});
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await controller.detailedHealthCheck();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('dependencies');
      expect(result.dependencies).toHaveProperty('dynamodb');
      expect(result.dependencies).toHaveProperty('s3');
      expect(result.dependencies).toHaveProperty('cognito');
      expect(result.dependencies).toHaveProperty('cache');
    });
  });
});
























