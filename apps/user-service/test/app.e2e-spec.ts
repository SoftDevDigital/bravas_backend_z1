import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UserServiceModule } from '../src/user-service.module';

describe('UserServiceController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UserServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Agregar validación global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET) should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service');
          expect(res.body).toHaveProperty('version');
          expect(res.body).toHaveProperty('environment');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('/health/detailed (GET) should return detailed health', () => {
      return request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('service');
          expect(res.body).toHaveProperty('dependencies');
          expect(res.body.dependencies).toHaveProperty('dynamodb');
          expect(res.body.dependencies).toHaveProperty('s3');
          expect(res.body.dependencies).toHaveProperty('cognito');
          expect(res.body.dependencies).toHaveProperty('cache');
        });
    });
  });

  describe('Public Endpoints', () => {
    it('/users/models (GET) should return list of models', () => {
      return request(app.getHttpServer())
        .get('/users/models')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/users/agencies (GET) should return list of agencies', () => {
      return request(app.getHttpServer())
        .get('/users/agencies')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/users/models (GET) should validate query parameters', () => {
      return request(app.getHttpServer())
        .get('/users/models')
        .query({ page: -1, limit: 200 }) // Invalid values
        .expect(200) // Should still work but with defaults
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });
  });

  describe('Protected Endpoints', () => {
    it('/users/me (GET) should require authentication', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('/users/me/stats (GET) should require authentication', () => {
      return request(app.getHttpServer())
        .get('/users/me/stats')
        .expect(401);
    });

    it('/users/me/avatar (POST) should require authentication', () => {
      return request(app.getHttpServer())
        .post('/users/me/avatar')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          // Rate limit headers should be present
          expect(res.headers).toHaveProperty('x-ratelimit-limit');
          expect(res.headers).toHaveProperty('x-ratelimit-remaining');
        });
    });
  });
});
