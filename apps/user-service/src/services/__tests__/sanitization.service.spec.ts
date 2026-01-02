import { Test, TestingModule } from '@nestjs/testing';
import { SanitizationService } from '../sanitization.service';

// Mock DOMPurify
jest.mock('dompurify', () => {
  return jest.fn(() => ({
    sanitize: jest.fn((str: string, options?: any) => {
      // Simular sanitización básica: remover tags HTML pero mantener contenido
      if (options?.ALLOWED_TAGS?.length === 0) {
        // Remover tags y su contenido si es script
        let result = str.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        // Remover todos los demás tags HTML pero mantener el contenido
        result = result.replace(/<[^>]*>/g, '');
        return result;
      }
      // Si no hay restricciones, solo remover tags peligrosos
      return str.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    }),
  }));
});

// Mock jsdom to avoid ES module issues
jest.mock('jsdom', () => ({
  JSDOM: jest.fn(() => ({
    window: {},
  })),
}));

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationService],
    }).compile();

    service = module.get<SanitizationService>(SanitizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = service.sanitizeString(input);
      expect(result).toBe('Hello');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = service.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should handle null/undefined', () => {
      expect(service.sanitizeString(null)).toBe('');
      expect(service.sanitizeString(undefined)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate correct email', () => {
      const email = 'test@example.com';
      const result = service.sanitizeEmail(email);
      expect(result).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      const email = 'invalid-email';
      const result = service.sanitizeEmail(email);
      expect(result).toBeNull();
    });

    it('should lowercase email', () => {
      const email = 'TEST@EXAMPLE.COM';
      const result = service.sanitizeEmail(email);
      expect(result).toBe('test@example.com');
    });
  });

  describe('sanitizeUrl', () => {
    it('should validate http URL', () => {
      const url = 'http://example.com';
      const result = service.sanitizeUrl(url);
      expect(result).toBe('http://example.com');
    });

    it('should validate https URL', () => {
      const url = 'https://example.com';
      const result = service.sanitizeUrl(url);
      expect(result).toBe('https://example.com');
    });

    it('should reject invalid URL', () => {
      const url = 'not-a-url';
      const result = service.sanitizeUrl(url);
      expect(result).toBeNull();
    });
  });
});


