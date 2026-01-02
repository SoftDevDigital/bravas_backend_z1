import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserServiceController } from './user-service.controller';
import { UserService } from './user.service';
import { CacheService } from './services/cache.service';
import { SanitizationService } from './services/sanitization.service';
import { loadCredentials, AWSClientFactory } from '@bravas/shared';

// Mock AWS SDK and shared modules
jest.mock('@bravas/shared', () => ({
  ...jest.requireActual('@bravas/shared'),
  AWSClientFactory: {
    createDynamoDBDocumentClient: jest.fn(),
  },
  loadCredentials: jest.fn(),
}));

// Mock jsdom to avoid ES module issues
jest.mock('jsdom', () => ({
  JSDOM: jest.fn(() => ({
    window: {
      DOMPurify: {
        sanitize: jest.fn((str) => str),
      },
    },
  })),
}));

describe('UserServiceController', () => {
  let userServiceController: UserServiceController;

  beforeEach(async () => {
    // Mock loadCredentials
    (loadCredentials as jest.Mock).mockReturnValue({
      dynamodb: {
        usersTable: 'test-users-table',
        userProfilesTable: 'test-user-profiles-table',
      },
    });
    (AWSClientFactory.createDynamoDBDocumentClient as jest.Mock).mockReturnValue({
      send: jest.fn(),
    });

    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserServiceController],
      providers: [
        UserService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                DYNAMODB_USERS_TABLE: 'test-users-table',
                DYNAMODB_USER_PROFILES_TABLE: 'test-user-profiles-table',
              };
              return config[key];
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            getUserProfileCacheKey: jest.fn(),
          },
        },
        SanitizationService,
      ],
    }).compile();

    userServiceController = app.get<UserServiceController>(UserServiceController);
  });

  it('should be defined', () => {
    expect(userServiceController).toBeDefined();
  });
});
