/**
 * Middleware System for Claude Agent Platform
 *
 * Provides comprehensive middleware with:
 * - Authentication middleware
 * - Rate limiting middleware
 * - Request validation middleware
 * - CORS middleware
 * - Logging middleware
 * - Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { RequestValidator } from 'express-validator';
import { RedisRateLimit } from 'express-rate-limit';
import { RedisCache } from '@claude-agent/cache';
import { AuthenticationService } from './auth';
import {
  MiddlewareOptions,
  AuthenticatedRequest,
  RateLimitInfo,
  GatewayConfig,
  ErrorResponse,
  SuccessResponse
} from './interfaces';

export class MiddlewareManager {
  private authService: AuthenticationService;
  private cache: RedisCache;
  private config: GatewayConfig;

  constructor(
    authService: AuthenticationService,
    cache: RedisCache,
    config: GatewayConfig
  ) {
    this.authService = authService;
    this.cache = cache;
    this.config = config;
  }

  /**
   * Create authentication middleware
   */
  createAuthMiddleware(options: MiddlewareOptions['authentication'] = {}) {
    return this.authService.createAuthMiddleware(options);
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimitMiddleware(options: MiddlewareOptions['rateLimit'] = {}) {
    const keyGenerator = options.keyGenerator || this.defaultKeyGenerator;

    const rateLimiter = new RedisRateLimit({
      store: {
        type: 'redis',
        client: this.cache.getClient() as any,
        prefix: 'rate-limit:',
      },
      keyGenerator: (req: AuthenticatedRequest) => {
        // Use API key or user ID for rate limiting
        if (req.apiKey) {
          return `api_key:${req.apiKey.id}`;
        }
        if (req.user) {
          return `user:${req.user.id}`;
        }
        return `ip:${req.ip}`;
      },
      windowMs: options.windowMs || this.config.rateLimiting.windowMs,
      max: options.maxRequests || this.config.rateLimiting.maxRequests,
      skipSuccessfulRequests: options.skipSuccessfulRequests !== false,
      skipFailedRequests: options.skipFailedRequests !== false,
      onLimitReached: async (req: AuthenticatedRequest, res: Response) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
            details: {
              limit: rateLimiter.store.options.max,
              current: rateLimiter.store.options.max, // Would need to track current
              resetTime: new Date(Date.now() + rateLimiter.store.options.windowMs),
            },
          },
        });
      },
    } as any);

    return rateLimiter;
  }

  /**
   * Create CORS middleware
   */
  createCORSMiddleware(options: MiddlewareOptions['cors'] = {}) {
    const corsConfig = {
      origin: options.origin || this.config.cors.origin,
      credentials: options.credentials !== false,
      methods: options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: options.headers || ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 200,
    };

    return require('cors')(corsConfig);
  }

  /**
   * Create request validation middleware
   */
  createValidationMiddleware(schema: MiddlewareOptions['validation']) {
    const validation = new RequestValidator(schema || {});

    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Validate body
        if (schema.body) {
          await req.body(schema.body);
        }

        // Validate query parameters
        if (schema.query) {
          await req.query(schema.query);
        }

        // Validate URL parameters
        if (schema.params) {
          await req.params(schema.params);
        }

        // Validate headers
        if (schema.headers) {
          await req.headers(schema.headers);
        }

        next();
      } catch (error) {
        const errorDetails = this.formatValidationError(error);

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errorDetails,
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
          },
        });
      }
    };
  }

  /**
   * Create response middleware
   */
  createResponseMiddleware() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Add rate limit headers if available
      if ((req as any).rateLimit) {
        const rateLimit = (req as any).rateLimit as RateLimitInfo;
        res.set('X-RateLimit-Limit', rateLimit.limit.toString());
        res.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
        res.set('X-RateLimit-Reset', rateLimit.resetTime.toISOString());
      }

      // Add security headers
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('X-Frame-Options', 'DENY');
      res.set('X-XSS-Protection', '1; mode=block');
      res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.set('Content-Security-Policy', "default-src 'self'");

      // Add response ID
      res.set('X-Request-ID', req.id || require('uuid').v4());

      // Add API version
      res.set('X-API-Version', '1.0.0');

      // Format response
      const originalJson = res.json;
      res.json = function(body: any) {
        const response = this.formatResponse(body);
        originalJson.call(this, response);
      }.bind(res);

      next();
    };
  }

  /**
   * Create logging middleware
   */
  createLoggingMiddleware() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Log request
      console.log(JSON.stringify({
        type: 'request',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        requestId: req.id,
      }));

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk?: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(JSON.stringify({
          type: 'response',
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime,
          userId: req.user?.id,
          apiKeyId: req.apiKey?.id,
          requestId: req.id,
        }));

        originalEnd.call(this, chunk);
      }.bind(res);

      next();
    };
  }

  /**
   * Create error handling middleware
   */
  createErrorHandlingMiddleware() {
    return (error: Error, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      console.error(JSON.stringify({
        type: 'error',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        requestId: req.id,
      }));

      // Don't respond if headers already sent
      if (res.headersSent) {
        return next(error);
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: this.formatValidationError(error),
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
          },
        });
        return;
      }

      // Handle JWT errors
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
          },
        });
        return;
      }

      // Handle rate limit errors
      if (error.name === 'RateLimitExceeded') {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded',
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
          },
        });
        return;
      }

      // Handle API key errors
      if (error.name === 'UnauthorizedError') {
        res.status(401).json({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key',
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
          },
        });
        return;
      }

      // Handle Prisma errors
      if (error.name === 'PrismaClientKnownRequestError') {
        res.status(503).json({
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database operation failed',
            requestId: req.id || require('uuid').v4(),
            timestamp: new Date(),
          },
        });
        return;
      }

      // Handle generic errors
      const statusCode = this.getHttpStatus(error);
      res.status(statusCode).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
          requestId: req.id || require('uuid').v4(),
          timestamp: new Date(),
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      });
    };
  }

  /**
   * Create cache middleware
   */
  createCacheMiddleware(options: MiddlewareOptions['cache'] = {}) {
    const keyGenerator = options.keyGenerator || this.defaultCacheKeyGenerator;
    const ttl = options.ttl || 300000; // 5 minutes

    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const cacheKey = keyGenerator(req);

      try {
        const cachedResult = await this.cache.get<{ response: any }>(cacheKey);

        if (cachedResult && cachedResult.hit) {
          return res.json(cachedResult.value.response);
        }

        // Override res.json to cache successful GET requests
        const originalJson = res.json;
        res.json = function(body: any) {
          if (req.method === 'GET' && res.statusCode < 400) {
            this.cache.set(cacheKey, { response: body }, { ttl });
          }
          originalJson.call(this, body);
        }.bind(res);

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Default key generator for rate limiting
   */
  private defaultKeyGenerator(req: AuthenticatedRequest): string {
    if (req.apiKey) {
      return `api_key:${req.apiKey.id}`;
    }
    if (req.user) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  }

  /**
   * Default cache key generator
   */
  private defaultCacheKeyGenerator(req: AuthenticatedRequest): string {
    const userId = req.user?.id || 'anonymous';
    const path = req.path;
    const query = JSON.stringify(req.query);
    return `cache:${userId}:${path}:${query}`;
  }

  /**
   * Format response consistently
   */
  private formatResponse(body: any): SuccessResponse<any> | ErrorResponse {
    if (body && typeof body === 'object' && 'error' in body) {
      return body as ErrorResponse;
    }

    return {
      data: body,
      meta: {
        requestId: require('uuid').v4(),
        timestamp: new Date(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Get HTTP status code from error
   */
  private getHttpStatus(error: Error): number {
    if (error.message.includes('not found')) {
      return 404;
    }
    if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
      return 403;
    }
    if (error.message.includes('validation')) {
      return 400;
    }
    if (error.message.includes('timeout')) {
      return 504;
    }
    return 500;
  }

  /**
   * Format validation error details
   */
  private formatValidationError(error: any): any {
    if (error.details) {
      return error.details;
    }

    // Handle express-validator specific format
    if (error.array) {
      return {
        errors: error.array,
        message: error.message,
      };
    }

    return {
      message: error.message,
    };
  }
}
