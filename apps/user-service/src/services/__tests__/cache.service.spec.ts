import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache.service';
import { loadCredentials, AWSClientFactory } from '@bravas/shared';

// Mock AWS SDK
jest.mock('@bravas/shared', () => ({
  ...jest.requireActual('@bravas/shared'),
  AWSClientFactory: {
    createDynamoDBDocumentClient: jest.fn(),
  },
  loadCredentials: jest.fn(),
}));

describe('CacheService', () => {
  let service: CacheService;
  let configService: ConfigService;

  const mockCredentials = {
    dynamodb: {
      cacheTable: 'test-cache-table',
    },
  };

  beforeEach(async () => {
    // Mock loadCredentials
    (loadCredentials as jest.Mock).mockReturnValue(mockCredentials);
    (AWSClientFactory.createDynamoDBDocumentClient as jest.Mock).mockReturnValue({
      send: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DYNAMODB_CACHE_TABLE') return 'test-cache-table';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cache key generation', () => {
    it('should generate user profile cache key', () => {
      const key = CacheService.getUserProfileCacheKey('user123');
      expect(key).toBe('user:profile:user123');
    });

    it('should generate marketplace cache key', () => {
      const key = CacheService.getMarketplaceCacheKey('models', { page: 1, limit: 20 });
      expect(key).toContain('marketplace:models');
    });
  });
});


