import { Request, Response, NextFunction } from 'express';
import { Logger } from './logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string | undefined;
  public details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code ?? undefined;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class DocumentProcessingError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'DOCUMENT_PROCESSING_ERROR', details);
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(format: string, supportedFormats: string[]) {
    super(
      `Unsupported document format: ${format}`,
      415,
      'UNSUPPORTED_FORMAT',
      { format, supportedFormats }
    );
  }
}

export class StorageError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 503, 'STORAGE_ERROR', details);
  }
}

export class QueueError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 503, 'QUEUE_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = new Logger('ErrorHandler');

  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code || 'APP_ERROR';
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
    statusCode = 503;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  } else if (error.name === 'MulterError') {
    if (error.message.includes('File too large')) {
      statusCode = 413;
      errorCode = 'FILE_TOO_LARGE';
      message = 'File size exceeds limit';
    } else if (error.message.includes('Unexpected field')) {
      statusCode = 400;
      errorCode = 'INVALID_FIELD';
      message = 'Invalid form field';
    } else {
      statusCode = 400;
      errorCode = 'UPLOAD_ERROR';
      message = 'File upload error';
    }
  }

  // Log error details
  const errorContext = {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    body: req.body,
    params: req.params,
    query: req.query,
    statusCode,
    errorCode,
    stack: error.stack,
  };

  if (statusCode >= 500) {
    logger.error('Server Error', error, errorContext);
  } else {
    logger.warn('Client Error', { ...errorContext, message: error.message });
  }

  // Build error response
  const errorResponse: Record<string, unknown> = {
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    },
  };

  // Include details in development environment
  if (process.env.NODE_ENV === 'development' && details) {
    errorResponse.error.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map((error: { path?: string; param?: string; msg: string; value?: unknown }) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    throw new ValidationError('Validation failed', validationErrors);
  }

  next();
};
