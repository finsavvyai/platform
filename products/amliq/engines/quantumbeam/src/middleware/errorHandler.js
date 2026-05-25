/**
 * Error handling middleware for Cloudflare Workers
 */

import { logError } from './logging.js';
import { corsHeaders } from '../utils/cors.js';

export function errorHandler(error, request, env) {
  // Log the error
  logError(error, request, env);

  // Determine error type and status
  let status = 500;
  let message = 'Internal Server Error';
  let errorType = 'INTERNAL_ERROR';

  if (error.name === 'ValidationError') {
    status = 400;
    message = error.message;
    errorType = 'VALIDATION_ERROR';
  } else if (error.name === 'AuthenticationError') {
    status = 401;
    message = 'Authentication failed';
    errorType = 'AUTHENTICATION_ERROR';
  } else if (error.name === 'AuthorizationError') {
    status = 403;
    message = 'Access denied';
    errorType = 'AUTHORIZATION_ERROR';
  } else if (error.name === 'NotFoundError') {
    status = 404;
    message = 'Resource not found';
    errorType = 'NOT_FOUND_ERROR';
  } else if (error.name === 'RateLimitError') {
    status = 429;
    message = 'Rate limit exceeded';
    errorType = 'RATE_LIMIT_ERROR';
  }

  // Don't expose internal errors in production
  const environment = env?.ENVIRONMENT || 'development';
  if (status === 500 && (environment === 'production' || environment === 'staging')) {
    message = 'Internal Server Error';
  }

  return new Response(JSON.stringify({
    error: {
      type: errorType,
      message,
      timestamp: new Date().toISOString(),
      requestId: request?._requestId
    }
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}
