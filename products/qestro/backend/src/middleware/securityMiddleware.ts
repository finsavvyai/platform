import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { logger } from '../utils/logger.js';

// API Rate Limiting
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000),
        upgradeUrl: '/pricing'
      });
    }
  });
};

// Strict rate limits for free users
export const freeUserLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  50, // 50 requests per 15 minutes for free users
  'Free tier rate limit exceeded. Upgrade to remove restrictions.'
);

// More generous limits for paid users
export const paidUserLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  500, // 500 requests per 15 minutes for paid users
);

// Very strict limits for authentication endpoints
export const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per 15 minutes
  'Too many authentication attempts, please try again later'
);

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Request validation
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Check for suspicious patterns
  const userAgent = req.get('User-Agent') || '';
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scraper/i,
    /scanner/i,
    /hack/i,
    /exploit/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.warn(`Suspicious user agent detected: ${userAgent} from IP: ${req.ip}`);
    // Don't block, but increase monitoring
  }

  // Validate content length
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB max

  if (contentLength > maxSize) {
    res.status(413).json({ error: 'Request entity too large' });
    return;
  }

  next();
};

// Input sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .trim();
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
};

// Subscription verification middleware
export const verifyActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // TODO: Implement real-time subscription verification
    // - Check if subscription is active in Stripe
    // - Verify payment status
    // - Check for any holds or disputes
    // - Validate subscription hasn't been cancelled

    next();
  } catch (error) {
    logger.error(`Subscription verification failed: ${error}`);
    res.status(500).json({ error: 'Subscription verification failed' });
  }
};

// Prevent resource exhaustion
export const preventResourceExhaustion = (req: Request, res: Response, next: NextFunction): void => {
  // Set timeouts
  req.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });

  res.setTimeout(30000, () => {
    res.status(504).json({ error: 'Response timeout' });
  });

  next();
};

// Log security events
export const logSecurityEvents = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    };

    // Log suspicious activities
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      logger.warn('Security event', logData);
    }

    // Log slow requests
    if (duration > 5000) {
      logger.warn('Slow request', logData);
    }
  });

  next();
};

// CORS configuration
export const corsConfig = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = [
      'https://questro.io',
      'https://www.questro.io',
      'https://app.questro.io',
      'http://localhost:3000', // Development
      'http://localhost:5173'  // Vite dev server
    ];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};