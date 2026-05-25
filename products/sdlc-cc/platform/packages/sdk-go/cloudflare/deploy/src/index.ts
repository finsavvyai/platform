import { Request, Response } from '@cloudflare/workers-types';
import { Router } from 'itty-router';
import { SecurityMiddleware } from './middleware/security';
import { AuthMiddleware } from './middleware/auth';
import { RateLimitMiddleware } from './middleware/rateLimit';
import { LoggingMiddleware } from './middleware/logging';
import { ErrorHandler } from './middleware/errorHandler';
import { APIRoutes } from './routes/api';
import { WebSocketManager } from './websocket/manager';
import { AnalyticsEngine } from './analytics/engine';
import { ConfigManager } from './config/manager';

// Environment interface
interface Env {
  // KV Stores
  SDK_CONFIG: KVNamespace;
  API_CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;

  // D1 Database
  DB: D1Database;

  // Durable Objects
  WEBSOCKET_MANAGER: DurableObjectNamespace;
  STREAM_MANAGER: DurableObjectNamespace;

  // R2 Storage
  FILE_STORAGE: R2Bucket;

  // Queue
  BACKGROUND_QUEUE: Queue;

  // Analytics
  ANALYTICS: AnalyticsEngineDataset;

  // AI/ML
  AI: Fetcher; // Workers AI binding
  EMBEDDINGS: VectorizeIndex;

  // Environment Variables
  ENVIRONMENT: string;
  API_VERSION: string;
  MAX_REQUEST_SIZE: string;
  RATE_LIMIT_PER_MINUTE: string;
  CORS_ORIGINS: string;
  SECURITY_HEADERS_ENABLED: string;
  LOG_LEVEL: string;
  REQUEST_TIMEOUT: string;

  // Secrets
  JWT_SECRET: string;
  API_KEYS: string;
  DATABASE_URL: string;
  ENCRYPTION_KEY: string;
}

// Main application class
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Initialize middleware
      const securityMiddleware = new SecurityMiddleware(env);
      const authMiddleware = new AuthMiddleware(env);
      const rateLimitMiddleware = new RateLimitMiddleware(env);
      const loggingMiddleware = new LoggingMiddleware(env);
      const errorHandler = new ErrorHandler(env);

      // Initialize router
      const router = Router();

      // Global middleware
      router.all('*', securityMiddleware.handle.bind(securityMiddleware));
      router.all('*', loggingMiddleware.handle.bind(loggingMiddleware));
      router.all('*', rateLimitMiddleware.handle.bind(rateLimitMiddleware));

      // Health check endpoint (no auth required)
      router.get('/health', async (request, env) => {
        return Response.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: env.API_VERSION,
          environment: env.ENVIRONMENT,
          uptime: Date.now(),
        });
      });

      // API routes with authentication
      router.all('/api/v1/*', authMiddleware.handle.bind(authMiddleware));

      // Mount API routes
      const apiRoutes = new APIRoutes(env);
      router.mount('/api/v1', apiRoutes.getRouter());

      // WebSocket upgrade endpoint
      router.get('/ws/:id', async (request, env, ctx) => {
        const id = request.params?.id;
        if (!id) {
          return new Response('WebSocket ID required', { status: 400 });
        }

        const webSocketManager = env.WEBSOCKET_MANAGER.get(env.WEBSOCKET_MANAGER.idFromName(id));
        return webSocketManager.fetch(request);
      });

      // File upload/download endpoints
      router.get('/files/:key', async (request, env, ctx) => {
        const key = request.params?.key;
        if (!key) {
          return new Response('File key required', { status: 400 });
        }

        try {
          const object = await env.FILE_STORAGE.get(key);
          if (!object) {
            return new Response('File not found', { status: 404 });
          }

          return new Response(object.body, {
            headers: {
              'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
              'Content-Length': object.size?.toString() || '0',
              'Cache-Control': 'public, max-age=31536000',
              'ETag': object.etag || '',
            },
          });
        } catch (error) {
          console.error('File retrieval error:', error);
          return new Response('Internal server error', { status: 500 });
        }
      });

      // Static file serving for documentation
      router.get('/docs/*', async (request, env) => {
        const path = new URL(request.url).pathname;
        const key = `docs${path.replace('/docs', '')}`;

        try {
          const object = await env.FILE_STORAGE.get(key);
          if (!object) {
            return new Response('Documentation not found', { status: 404 });
          }

          return new Response(object.body, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch (error) {
          console.error('Documentation retrieval error:', error);
          return new Response('Internal server error', { status: 500 });
        }
      });

      // 404 handler
      router.all('*', () => {
        return Response.json({
          error: 'Not Found',
          message: 'The requested resource was not found',
          timestamp: new Date().toISOString(),
        }, { status: 404 });
      });

      // Handle the request
      const response = await router.handle(request, env, ctx);

      // Log analytics
      await logAnalytics(request, response, env);

      return response;

    } catch (error) {
      console.error('Unhandled error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Queue handler for background processing
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processBackgroundMessage(message, env);
      } catch (error) {
        console.error('Background processing error:', error);
      }
    }
  },

  // Durable Object stub for WebSocket management
  async webSocketMessage(message: string, env: Env): Promise<void> {
    // Handle WebSocket messages for real-time features
    try {
      const data = JSON.parse(message);
      await handleWebSocketMessage(data, env);
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  },
};

// Security middleware implementation
class SecurityMiddleware {
  constructor(private env: Env) {}

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<void> {
    // Add security headers
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    };

    // Add headers to response (this would be handled by the router)
    ctx.waitUntil(
      (async () => {
        // Security validation logic here
        await this.validateRequest(request);
      })()
    );
  }

  private async validateRequest(request: Request): Promise<void> {
    const url = new URL(request.url);

    // Validate request size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > parseInt(this.env.MAX_REQUEST_SIZE)) {
      throw new Error('Request too large');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i,  // XSS
      /javascript:/i,  // JavaScript protocol
      /data:/i,  // Data protocol
    ];

    const requestText = await request.text();
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestText)) {
        throw new Error('Suspicious content detected');
      }
    }
  }
}

// Authentication middleware implementation
class AuthMiddleware {
  constructor(private env: Env) {}

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<void> {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    // Validate JWT token
    const token = authHeader.replace('Bearer ', '');
    const isValid = await this.validateToken(token);

    if (!isValid) {
      throw new Error('Invalid authentication token');
    }
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      // JWT validation logic here
      // This would use the JWT_SECRET environment variable
      return token.length > 0; // Simplified validation
    } catch (error) {
      return false;
    }
  }
}

// Rate limiting middleware implementation
class RateLimitMiddleware {
  constructor(private env: Env) {}

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<void> {
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    const key = `rate_limit:${clientIP}`;

    // Check rate limit
    const current = await this.env.RATE_LIMIT.get(key);
    const limit = parseInt(this.env.RATE_LIMIT_PER_MINUTE);

    if (current && parseInt(current) >= limit) {
      throw new Error('Rate limit exceeded');
    }

    // Increment counter
    ctx.waitUntil(
      this.env.RATE_LIMIT.put(key, (parseInt(current || '0') + 1).toString(), {
        expirationTtl: 60, // 1 minute
      })
    );
  }
}

// Logging middleware implementation
class LoggingMiddleware {
  constructor(private env: Env) {}

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<void> {
    const start = Date.now();

    ctx.waitUntil(
      (async () => {
        const duration = Date.now() - start;
        const logData = {
          method: request.method,
          url: request.url,
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('cf-connecting-ip'),
          duration,
          timestamp: new Date().toISOString(),
        };

        // Log to analytics
        await this.env.ANALYTICS.writeDataPoint({
          blobs: [logData.method, logData.url, logData.userAgent, logData.ip],
          doubles: [logData.duration],
          indexes: [logData.timestamp],
        });
      })()
    );
  }
}

// Error handler implementation
class ErrorHandler {
  constructor(private env: Env) {}

  async handle(error: Error, request: Request): Promise<Response> {
    console.error('Request error:', error);

    const errorResponse = {
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    };

    return Response.json(errorResponse, { status: 500 });
  }
}

// Analytics logging function
async function logAnalytics(request: Request, response: Response, env: Env): Promise<void> {
  try {
    const url = new URL(request.url);

    await env.ANALYTICS.writeDataPoint({
      blobs: [
        request.method,
        url.pathname,
        response.status.toString(),
        request.headers.get('user-agent') || '',
        request.headers.get('cf-connecting-ip') || '',
      ],
      doubles: [
        Date.now(),
        response.headers.get('content-length') ?
          parseFloat(response.headers.get('content-length')!) : 0,
      ],
      indexes: [new Date().toISOString()],
    });
  } catch (error) {
    console.error('Analytics logging error:', error);
  }
}

// Background message processing
async function processBackgroundMessage(message: unknown, env: Env): Promise<void> {
  const { type, data } = message.body;

  switch (type) {
    case 'analytics':
      await processAnalyticsData(data, env);
      break;
    case 'cleanup':
      await performCleanupTasks(data, env);
      break;
    case 'notification':
      await sendNotification(data, env);
      break;
    default:
      console.warn('Unknown background message type:', type);
  }
}

// WebSocket message handler
async function handleWebSocketMessage(data: unknown, env: Env): Promise<void> {
  const { type, payload } = data;

  switch (type) {
    case 'subscribe':
      await handleSubscription(payload, env);
      break;
    case 'message':
      await handleRealtimeMessage(payload, env);
      break;
    case 'presence':
      await handlePresenceUpdate(payload, env);
      break;
    default:
      console.warn('Unknown WebSocket message type:', type);
  }
}

// Helper functions for background processing
async function processAnalyticsData(data: unknown, env: Env): Promise<void> {
  // Process analytics data
  console.log('Processing analytics data:', data);
}

async function performCleanupTasks(data: unknown, env: Env): Promise<void> {
  // Perform cleanup tasks
  console.log('Performing cleanup tasks:', data);
}

async function sendNotification(data: unknown, env: Env): Promise<void> {
  // Send notifications
  console.log('Sending notification:', data);
}

async function handleSubscription(data: unknown, env: Env): Promise<void> {
  // Handle WebSocket subscriptions
  console.log('Handling subscription:', data);
}

async function handleRealtimeMessage(data: unknown, env: Env): Promise<void> {
  // Handle real-time messages
  console.log('Handling real-time message:', data);
}

async function handlePresenceUpdate(data: unknown, env: Env): Promise<void> {
  // Handle presence updates
  console.log('Handling presence update:', data);
}
