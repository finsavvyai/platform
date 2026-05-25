/**
 * Production Security Configuration
 *
 * Implements comprehensive security measures for production testing
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
  };
  helmet: {
    contentSecurityPolicy: boolean;
    crossOriginEmbedderPolicy: boolean;
    hsts: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    algorithm: string;
  };
  audit: {
    enabled: boolean;
    logLevel: string;
  };
}

export const securityConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },
  helmet: {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    hsts: true
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: '24h',
    algorithm: 'HS256'
  },
  audit: {
    enabled: process.env.ENABLE_AUDIT_LOGGING === 'true',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};

// Security audit logger
export class SecurityAuditLogger {
  private static instance: SecurityAuditLogger;

  static getInstance(): SecurityAuditLogger {
    if (!SecurityAuditLogger.instance) {
      SecurityAuditLogger.instance = new SecurityAuditLogger();
    }
    return SecurityAuditLogger.instance;
  }

  async logSecurityEvent(event: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateSecureId();

    const logEntry = {
      eventId,
      timestamp,
      ...event,
      source: 'security-audit'
    };

    // In production, this would go to a secure audit log system
    console.log('[SECURITY AUDIT]', JSON.stringify(logEntry));

    // Store in database for analysis
    // await db.insert(securityAuditLogs).values(logEntry);
  }

  private generateSecureId(): string {
    return createHash('sha256')
      .update(randomBytes(32))
      .digest('hex')
      .substring(0, 16);
  }
}

// Input validation and sanitization
export class InputValidator {
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/['"]/g, '') // Remove quotes
      .trim()
      .substring(0, 1000); // Limit length
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

// Encryption utilities
export class EncryptionUtils {
  static hashPassword(password: string): string {
    const salt = randomBytes(32).toString('hex');
    const hash = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return `${salt}:${hash}`;
  }

  static verifyPassword(password: string, hashedPassword: string): boolean {
    const [salt, hash] = hashedPassword.split(':');
    const computedHash = createHash('sha256')
      .update(password + salt)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  static generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  static encryptSensitiveData(data: string, key: string): string {
    // Simple XOR encryption for demo - use AES in production
    const keyBuffer = Buffer.from(key);
    const dataBuffer = Buffer.from(data);
    const encrypted = Buffer.alloc(dataBuffer.length);

    for (let i = 0; i < dataBuffer.length; i++) {
      encrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length];
    }

    return encrypted.toString('base64');
  }
}

// Security middleware
export function createSecurityMiddleware() {
  const auditLogger = SecurityAuditLogger.getInstance();

  return {
    // Rate limiting
    rateLimiter: rateLimit({
      ...securityConfig.rateLimit,
      handler: async (req: Request, res: Response) => {
        await auditLogger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          description: 'Rate limit exceeded',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.status(429).json({
          error: 'Too many requests',
          message: securityConfig.rateLimit.message
        });
      }
    }),

    // Helmet security headers
    helmet: helmet({
      contentSecurityPolicy: securityConfig.helmet.contentSecurityPolicy,
      crossOriginEmbedderPolicy: securityConfig.helmet.crossOriginEmbedderPolicy,
      hsts: securityConfig.helmet.hsts
    }),

    // Request logging and validation
    requestValidator: async (req: Request, res: Response, next: NextFunction) => {
      // Log all requests for audit
      await auditLogger.logSecurityEvent({
        type: 'request',
        severity: 'low',
        description: `${req.method} ${req.path}`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          timestamp: new Date().toISOString()
        }
      });

      // Validate common headers
      const userAgent = req.get('User-Agent');
      if (!userAgent || userAgent.length > 500) {
        await auditLogger.logSecurityEvent({
          type: 'suspicious_request',
          severity: 'medium',
          description: 'Invalid or missing User-Agent header',
          ip: req.ip,
          userAgent
        });
      }

      next();
    },

    // Authentication middleware
    authenticateToken: async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        await auditLogger.logSecurityEvent({
          type: 'unauthorized_access',
          severity: 'medium',
          description: 'Missing authentication token',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({ error: 'Access token required' });
      }

      try {
        const decoded = jwt.verify(token, securityConfig.jwt.secret);
        (req as any).user = decoded;
        next();
      } catch (error) {
        await auditLogger.logSecurityEvent({
          type: 'invalid_token',
          severity: 'high',
          description: 'Invalid authentication token',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { error: error.message }
        });

        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    }
  };
}

// Security utilities for testing
export class SecurityTestUtils {
  static generateTestToken(payload: any): string {
    return jwt.sign(payload, securityConfig.jwt.secret, {
      expiresIn: securityConfig.jwt.expiresIn,
      algorithm: 'HS256'
    } as any);
  }

  static validateSecurityHeaders(headers: Record<string, string>): boolean {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];

    return requiredHeaders.every(header =>
      Object.keys(headers).some(h => h.toLowerCase() === header)
    );
  }

  static checkPasswordComplexity(password: string): number {
    let score = 0;

    if (password.length >= 12) score += 2;
    if (password.length >= 16) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 2;

    return Math.min(score, 10); // Max score of 10
  }
}

export default {
  securityConfig,
  SecurityAuditLogger,
  InputValidator,
  EncryptionUtils,
  createSecurityMiddleware,
  SecurityTestUtils
};