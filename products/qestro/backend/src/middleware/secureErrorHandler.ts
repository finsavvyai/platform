/**
 * Secure Error Handling Middleware
 *
 * This middleware provides comprehensive error handling that prevents information disclosure
 * while providing helpful error messages to users and detailed logging for developers.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface SecureErrorOptions {
  includeStackTrace?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
  userMessage?: string;
  statusCode?: number;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: number;
}

export interface SecureErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
    timestamp: number;
    retryAfter?: number;
  };
  development?: {
    stack?: string;
    details?: any;
  };
}

/**
 * Error codes that are safe to expose to users
 */
export const SAFE_ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Business Logic
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // Rate Limiting & Quotas
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',

  // System Errors (generic)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TEMPORARY_FAILURE: 'TEMPORARY_FAILURE',
} as const;

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES: Record<string, string> = {
  [SAFE_ERROR_CODES.UNAUTHORIZED]: 'Authentication required. Please log in to continue.',
  [SAFE_ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action.',
  [SAFE_ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [SAFE_ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',

  [SAFE_ERROR_CODES.VALIDATION_ERROR]: 'The provided data is invalid. Please check your input and try again.',
  [SAFE_ERROR_CODES.INVALID_INPUT]: 'Invalid input provided. Please check the format and try again.',
  [SAFE_ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required information is missing. Please complete all required fields.',

  [SAFE_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Your account plan does not include this feature.',
  [SAFE_ERROR_CODES.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
  [SAFE_ERROR_CODES.RESOURCE_CONFLICT]: 'This resource conflicts with existing data. Please check and try again.',

  [SAFE_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment before trying again.',
  [SAFE_ERROR_CODES.QUOTA_EXCEEDED]: 'You have reached your usage limit. Please upgrade your plan to continue.',

  [SAFE_ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'A required external service is currently unavailable. Please try again later.',
  [SAFE_ERROR_CODES.AI_SERVICE_UNAVAILABLE]: 'AI services are temporarily unavailable. Please try again later.',

  [SAFE_ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again or contact support.',
  [SAFE_ERROR_CODES.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable. Please try again later.',
  [SAFE_ERROR_CODES.TEMPORARY_FAILURE]: 'A temporary issue occurred. Please try again in a moment.',
};

/**
 * Error patterns that might contain sensitive information
 */
const SENSITIVE_ERROR_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /credential/i,
  /database/i,
  /sql/i,
  /query/i,
  /internal/i,
  /stack\s*trace/i,
  /file\s*path/i,
  /directory/i,
  /config/i,
  /env/i,
  /environment/i,
];

/**
 * Check if an error message contains sensitive information
 */
function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize error message to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Remove potential sensitive information
  SENSITIVE_ERROR_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // Remove file paths
  sanitized = sanitized.replace(/\/[\w\-_.\/]+/g, '/[PATH]');
  sanitized = sanitized.replace(/[A-Za-z]:\\[\w\-_.\\]+/g, '[PATH]');

  // Remove stack traces and technical details
  sanitized = sanitized.replace(/at\s+[\w\-_.]+\s*\([^)]*\)/g, '[LOCATION]');
  sanitized = sanitized.replace(/\([^)]*\)/g, '');

  // Limit length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized.trim();
}

/**
 * Generate unique error request ID
 */
function generateRequestId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Extract error context from request
 */
function extractErrorContext(req: Request): ErrorContext {
  return {
    userId: (req as any).user?.id,
    requestId: req.headers['x-request-id'] as string || generateRequestId(),
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] as string || req.headers['x-real-ip'] as string || req.connection?.remoteAddress,
    timestamp: Date.now(),
  };
}

/**
 * Categorize error type
 */
function categorizeError(error: Error): { code: keyof typeof SAFE_ERROR_CODES; statusCode: number } {
  const message = error.message.toLowerCase();

  // Authentication errors
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return { code: 'UNAUTHORIZED', statusCode: 401 };
  }

  // Authorization errors
  if (message.includes('forbidden') || message.includes('permission')) {
    return { code: 'FORBIDDEN', statusCode: 403 };
  }

  // Not found errors
  if (message.includes('not found') || message.includes('does not exist')) {
    return { code: 'RESOURCE_NOT_FOUND', statusCode: 404 };
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return { code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  // Rate limiting errors
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 };
  }

  // Database errors
  if (message.includes('database') || message.includes('sql') || message.includes('connection')) {
    return { code: 'INTERNAL_ERROR', statusCode: 500 };
  }

  // Network/External service errors
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return { code: 'EXTERNAL_SERVICE_ERROR', statusCode: 502 };
  }

  // Default to internal error
  return { code: 'INTERNAL_ERROR', statusCode: 500 };
}

/**
 * Create secure error response
 */
function createSecureErrorResponse(
  error: Error,
  context: ErrorContext,
  options: SecureErrorOptions = {}
): SecureErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const { code, statusCode } = categorizeError(error);

  // Determine user message
  let userMessage = options.userMessage || ERROR_MESSAGES[code];

  // Sanitize original error message if we need to use it
  if (!userMessage && !containsSensitiveInfo(error.message)) {
    userMessage = sanitizeErrorMessage(error.message);
  }

  const response: SecureErrorResponse = {
    success: false,
    error: {
      code,
      message: userMessage || 'An unexpected error occurred. Please try again.',
      requestId: context.requestId,
      timestamp: context.timestamp,
    },
  };

  // Include development information in development mode
  if (isDevelopment && options.includeStackTrace !== false) {
    response.development = {
      stack: error.stack,
      details: {
        originalMessage: error.message,
        name: error.name,
        context: {
          path: context.path,
          method: context.method,
          userId: context.userId,
        },
      },
    };
  }

  // Add retry information for certain error types
  if (code === 'RATE_LIMIT_EXCEEDED' || code === 'TEMPORARY_FAILURE') {
    response.error.retryAfter = 60; // 60 seconds
  }

  return response;
}

/**
 * Log error with context
 */
function logError(error: Error, context: ErrorContext, response: SecureErrorResponse): void {
  const logLevel: 'error' | 'warn' | 'info' = 'error';
  const logData: Record<string, any> = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
    response: {
      code: response.error.code,
      statusCode: response.error.code,
    },
  };

  // Add user information if available
  if (context.userId) {
    logData.user = { id: context.userId };
  }

  // Log error (always error level for now)
  logger.error('Secure error handler:', logData);

  // In production, also send to external monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Integration with external monitoring services
    // This would send to services like Sentry, DataDog, etc.
    console.error('Production Error:', JSON.stringify({
      requestId: context.requestId,
      code: response.error.code,
      message: response.error.message,
      userId: context.userId,
      path: context.path,
      timestamp: context.timestamp,
    }));
  }
}

/**
 * Main secure error handling middleware
 */
export function secureErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
  options: SecureErrorOptions = {}
): void {
  // Ensure we have an Error object
  const error = err instanceof Error ? err : new Error(String(err));

  // Extract context
  const context = extractErrorContext(req);

  // Create secure response
  const response = createSecureErrorResponse(error, context, options);

  // Log the error
  logError(error, context, response);

  // Set appropriate status code
  const { statusCode } = categorizeError(error);

  // Set headers for security
  res.setHeader('X-Request-ID', context.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Send response
  res.status(statusCode || 500).json(response);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a custom error with additional context
 */
export class SecureError extends Error {
  public readonly code: keyof typeof SAFE_ERROR_CODES;
  public readonly statusCode: number;
  public readonly userMessage?: string;
  public readonly retryAfter?: number;

  constructor(
    code: keyof typeof SAFE_ERROR_CODES,
    message?: string,
    options: { userMessage?: string; retryAfter?: number } = {}
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = 'SecureError';
    this.code = code;
    this.statusCode = 500; // Will be overridden by categorizeError
    this.userMessage = options.userMessage;
    this.retryAfter = options.retryAfter;
  }
}

/**
 * Factory functions for common error types
 */
export const createError = {
  unauthorized: (message?: string) => new SecureError('UNAUTHORIZED', message),
  forbidden: (message?: string) => new SecureError('FORBIDDEN', message),
  notFound: (message?: string) => new SecureError('RESOURCE_NOT_FOUND', message),
  validation: (message?: string) => new SecureError('VALIDATION_ERROR', message),
  rateLimit: (retryAfter?: number) => new SecureError('RATE_LIMIT_EXCEEDED', undefined, { retryAfter }),
  quotaExceeded: (message?: string) => new SecureError('QUOTA_EXCEEDED', message),
  externalService: (message?: string) => new SecureError('EXTERNAL_SERVICE_ERROR', message),
  internal: (message?: string) => new SecureError('INTERNAL_ERROR', message),
};

export default secureErrorHandler;
