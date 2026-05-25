/**
 * Qestro Workers - Response Helpers
 *
 * Utility functions for standardizing API responses
 */

import { APIResponse, RateLimitInfo } from '@/types/common'

export class ResponseHelper {
  /**
   * Create a successful JSON response
   */
  static success<T>(data: T, meta?: Record<string, any>, status = 200): Response {
    const response: APIResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        ...meta
      }
    }

    return new Response(JSON.stringify(response), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    code = 'INTERNAL_ERROR',
    status = 500,
    details?: Record<string, any>
  ): Response {
    const response: APIResponse = {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    }

    return new Response(JSON.stringify(response), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }

  /**
   * Create a validation error response
   */
  static validation(message: string, details?: Record<string, any>): Response {
    return this.error(message, 'VALIDATION_ERROR', 400, details)
  }

  /**
   * Create an unauthorized response
   */
  static unauthorized(message = 'Unauthorized'): Response {
    return this.error(message, 'UNAUTHORIZED', 401)
  }

  /**
   * Create a forbidden response
   */
  static forbidden(message = 'Forbidden'): Response {
    return this.error(message, 'FORBIDDEN', 403)
  }

  /**
   * Create a not found response
   */
  static notFound(message = 'Resource not found'): Response {
    return this.error(message, 'NOT_FOUND', 404)
  }

  /**
   * Create a rate limit response
   */
  static rateLimit(info: RateLimitInfo): Response {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: info
      }
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': info.limit.toString(),
        'X-RateLimit-Remaining': info.remaining.toString(),
        'X-RateLimit-Reset': info.reset.toString(),
        'Retry-After': info.retryAfter?.toString() || '60'
      }
    })
  }

  /**
   * Create a server error response
   */
  static serverError(message = 'Internal server error', details?: Record<string, any>): Response {
    return this.error(message, 'SERVER_ERROR', 500, details)
  }

  /**
   * Create a CORS preflight response
   */
  static cors(origin?: string, methods?: string[], headers?: string[]): Response {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': headers?.join(', ') || 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  /**
   * Create a redirect response
   */
  static redirect(url: string, status = 302): Response {
    return new Response(null, {
      status,
      headers: {
        'Location': url
      }
    })
  }
}
