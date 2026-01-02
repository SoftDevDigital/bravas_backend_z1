import { Injectable } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Servicio para sanitizar inputs de usuario
 * Previene XSS y limpia datos de entrada
 */
@Injectable()
export class SanitizationService {
  private readonly purify: ReturnType<typeof DOMPurify>;

  constructor() {
    // Crear window object para DOMPurify en Node.js
    const window = new JSDOM('').window;
    this.purify = DOMPurify(window as any);
  }

  /**
   * Sanitiza un string removiendo HTML y scripts maliciosos
   */
  sanitizeString(input: string | null | undefined): string {
    if (!input) return '';
    
    // Primero limpiar espacios en blanco
    const trimmed = input.trim();
    
    // Sanitizar con DOMPurify
    const sanitized = this.purify.sanitize(trimmed, {
      ALLOWED_TAGS: [], // No permitir ningún tag HTML
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // Mantener el contenido pero sin tags
    });

    return sanitized;
  }

  /**
   * Sanitiza un objeto recursivamente
   */
  sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = { ...obj };

    for (const key in sanitized) {
      if (sanitized.hasOwnProperty(key)) {
        const value = sanitized[key];

        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value) as any;
        } else if (Array.isArray(value)) {
          sanitized[key] = value.map((item) =>
            typeof item === 'string' ? this.sanitizeString(item) : this.sanitizeObject(item)
          ) as any;
        } else if (value && typeof value === 'object') {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
    }

    return sanitized;
  }

  /**
   * Sanitiza un array de strings
   */
  sanitizeStringArray(input: string[]): string[] {
    if (!Array.isArray(input)) return [];
    return input.map((item) => this.sanitizeString(item));
  }

  /**
   * Valida y sanitiza una URL
   */
  sanitizeUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    const trimmed = url.trim();
    
    // Validar que sea una URL válida
    try {
      const urlObj = new URL(trimmed);
      // Solo permitir http y https
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return null;
      }
      return trimmed;
    } catch {
      return null;
    }
  }

  /**
   * Sanitiza un email (solo valida formato, no sanitiza contenido)
   */
  sanitizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;

    const trimmed = email.trim().toLowerCase();
    
    // Validar formato básico de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  /**
   * Sanitiza un número de teléfono (solo dígitos, espacios, +, -, (, ))
   */
  sanitizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;

    const trimmed = phone.trim();
    
    // Solo permitir dígitos, espacios, +, -, (, )
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    if (!phoneRegex.test(trimmed)) {
      return null;
    }

    return trimmed;
  }
}

