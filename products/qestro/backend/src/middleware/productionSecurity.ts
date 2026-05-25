/**
 * Production Security Middleware
 * Comprehensive security hardening for production environment
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createHash } from 'crypto';

/**
 * Helmet security headers configuration
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

/**
 * Rate limiting configurations
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'API rate limit exceeded, please slow down.',
});

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Remove any potentially dangerous characters from query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string)
          .replace(/[<>]/g, '')
          .trim();
      }
    });
  }

  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
};

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj: any): void {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key]
        .replace(/[<>]/g, '')
        .trim();
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  });
}

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = generateRequestId();

  // Add request ID to request object
  (req as any).requestId = requestId;

  // Log request
  console.log({
    type: 'request',
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      type: 'response',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  next();
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Error handling middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId || 'unknown';

  // Log error
  console.error({
    type: 'error',
    requestId,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Send error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    error: true,
    message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: true,
    message: 'Resource not found',
    path: req.path,
    requestId: (req as any).requestId,
  });
};

/**
 * CORS configuration for production
 */
export const getCorsOptions = () => {
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  return {
    origin: (origin: string | undefined, callback: Function) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // 24 hours
  };
};

/**
 * Health check middleware
 */
export const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
    cpu: process.cpuUsage(),
  };

  res.json(health);
};

/**
 * Metrics endpoint
 */
export const metricsEndpoint = async (req: Request, res: Response) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      pid: process.pid,
      version: process.version,
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  };

  res.json(metrics);
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: true,
          message: 'Request timeout',
          requestId: (req as any).requestId,
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    next();
  };
};

/**
 * API key validation middleware (for external integrations)
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'API key required',
    });
  }

  // Validate API key (implement your own logic)
  const validApiKey = process.env.API_KEY;
  
  if (apiKey !== validApiKey) {
    return res.status(403).json({
      error: true,
      message: 'Invalid API key',
    });
  }

  next();
};

export default {
  securityHeaders,
  generalRateLimit,
  authRateLimit,
  apiRateLimit,
  sanitizeRequest,
  requestLogger,
  errorHandler,
  notFoundHandler,
  getCorsOptions,
  healthCheck,
  metricsEndpoint,
  requestTimeout,
  validateApiKey,
};
