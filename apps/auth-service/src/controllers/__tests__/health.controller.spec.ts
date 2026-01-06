import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { CognitoIdentityProviderClient, ListUserPoolsCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Mock AWS SDK
jest.mock('@bravas/shared', () => ({
  ...jest.requireActual('@bravas/shared'),
  AWSClientFactory: {
    createCognitoClient: jest.fn(),
    createDynamoDBDocumentClient: jest.fn(),
  },
  loadCredentials: jest.fn().mockReturnValue({
    cognito: {
      userPoolId: 'test-pool-id',
    },
    dynamodb: {
      usersTable: 'test-users-table',
      sessionsTable: 'test-sessions-table',
    },
  }),
}));

describe('HealthController', () => {
  let controller: HealthController;
  let mockCognitoClient: jest.Mocked<CognitoIdentityProviderClient>;
  let mockDynamoClient: jest.Mocked<DynamoDBDocumentClient>;

  beforeEach(async () => {
    // Mock Cognito Client
    mockCognitoClient = {
      send: jest.fn(),
    } as any;

    // Mock DynamoDB Client
    mockDynamoClient = {
      send: jest.fn(),
    } as any;

    const { AWSClientFactory } = require('@bravas/shared');
    AWSClientFactory.createCognitoClient.mockReturnValue(mockCognitoClient);
    AWSClientFactory.createDynamoDBDocumentClient.mockReturnValue(mockDynamoClient);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basicHealthCheck', () => {
    it('should return basic health status', async () => {
      const result = await controller.basicHealthCheck();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('detailedHealthCheck', () => {
    it('should return detailed health status with all dependencies healthy', async () => {
      // Mock successful Cognito check
      (mockCognitoClient.send as jest.Mock).mockResolvedValue({});

      // Mock successful DynamoDB check (item not found is expected)
      (mockDynamoClient.send as jest.Mock).mockResolvedValue({});

      const result = await controller.detailedHealthCheck();

      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('overall', 'healthy');
      expect(result.dependencies).toHaveProperty('cognito');
      expect(result.dependencies).toHaveProperty('dynamodb');
      expect(result.dependencies.cognito).toHaveProperty('status', 'ok');
      expect(result.dependencies.dynamodb).toHaveProperty('status', 'ok');
    });

    it('should return degraded status if Cognito is unavailable', async () => {
      // Mock Cognito error
      (mockCognitoClient.send as jest.Mock).mockRejectedValue(
        new Error('Cognito connection error'),
      );

      // Mock successful DynamoDB check
      (mockDynamoClient.send as jest.Mock).mockResolvedValue({});

      const result = await controller.detailedHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.overall).toBe('unhealthy');
      expect(result.dependencies.cognito.status).toBe('error');
      expect(result.dependencies.cognito).toHaveProperty('message');
    });

    it('should return degraded status if DynamoDB is unavailable', async () => {
      // Mock successful Cognito check
      (mockCognitoClient.send as jest.Mock).mockResolvedValue({});

      // Mock DynamoDB table not found error
      const dynamoError = new Error('Table not found');
      (dynamoError as any).name = 'ResourceNotFoundException';
      (mockDynamoClient.send as jest.Mock).mockRejectedValue(dynamoError);

      const result = await controller.detailedHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.overall).toBe('unhealthy');
      expect(result.dependencies.dynamodb.status).toBe('error');
    });

    it('should handle missing credentials gracefully', async () => {
      const { loadCredentials } = require('@bravas/shared');
      loadCredentials.mockReturnValueOnce({
        cognito: {},
        dynamodb: {},
      });

      // Create new controller instance with empty credentials
      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
      }).compile();
      const newController = module.get<HealthController>(HealthController);

      const result = await newController.detailedHealthCheck();

      expect(result.dependencies.cognito.status).toBe('error');
      expect(result.dependencies.cognito.message).toContain('User Pool no configurado');
    });
  });
});






















