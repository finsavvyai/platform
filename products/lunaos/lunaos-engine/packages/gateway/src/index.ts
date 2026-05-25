/**
 * Main API Gateway Service for Claude Agent Platform
 *
 * Provides comprehensive API gateway with:
 * - Service routing and load balancing
 * - Authentication and authorization
 * - Rate limiting and quota management
 * - Request validation and transformation
 * - Response formatting and error handling
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import { MiddlewareManager } from './middleware';
import { AuthenticationService } from './auth';
import {
  GatewayConfig,
  RouteConfig,
  ServiceConfig,
  AuthenticatedRequest,
  ProxyRequestOptions,
  ProxyResponse,
  ErrorResponse,
  SuccessResponse,
} from './interfaces';

export class APIGateway {
  private app: Application;
  private middleware: MiddlewareManager;
  private authService: AuthenticationService;
  private cache: RedisCache;
  private messaging: QueueService;
  private config: GatewayConfig;
  private services: Map<string, ServiceConfig> = new Map();
  private routes: Map<string, RouteConfig[]> = new Map();

  constructor(config: GatewayConfig) {
    this.config = config;
    this.app = express();

    // Initialize services
    const prisma = new PrismaClient({ datasources: { db: { url: config.server.host } } });
    this.cache = new RedisCache(require('@claude-agent/cache').DEFAULT_CACHE_CONFIG.redis);
    this.authService = new AuthenticationService(prisma, this.cache, config.authentication);
    this.middleware = new MiddlewareManager(this.authService, this.cache, config);
    this.messaging = new QueueService({
      rabbitmq: {
        host: process.env.RABBITMQ_HOST || 'localhost',
        port: parseInt(process.env.RABBITMQ_PORT || '5672'),
        username: process.env.RABBITMQ_USER || 'claude_user',
        password: process.env.RABBITMQ_PASSWORD || 'claude_password',
        vhost: process.env.RABBITMQ_VHOST || '/',
      },
      queues: require('@claude-agent/messaging').DEFAULT_QUEUE_CONFIGS,
      retryPolicies: require('@claude-agent/messaging').DEFAULT_RETRY_POLICIES,
    });

    this.setupServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize the gateway
   */
  async initialize(): Promise<void> {
    await this.messaging.initialize();

    this.app.listen(this.config.server.port, this.config.server.host, () => {
      console.log(`API Gateway listening on ${this.config.server.host}:${this.config.server.port}`);
    });
  }

  /**
   * Setup services and routes
   */
  private setupServices(): void {
    // Register services from config
    this.config.services.forEach(service => {
      this.services.set(service.name, service);
    });

    // Register routes from config
    this.config.routes.forEach(route => {
      if (!this.routes.has(route.path)) {
        this.routes.set(route.path, []);
      }
      this.routes.get(route.path)!.push(route);
    });
  }

  /**
   * Setup middleware stack
   */
  private setupMiddleware(): void {
    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = uuidv4();
      next();
    });

    // Security middleware
    if (this.config.security.helmet) {
      this.app.use(helmet());
    }

    // CORS middleware
    this.app.use(this.middleware.createCORSMiddleware(this.config.cors));

    // Compression middleware
    if (this.config.security.compression) {
      this.app.use(compression());
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (this.config.security.logging) {
      this.app.use(morgan('combined'));
    }
    this.app.use(this.middleware.createLoggingMiddleware());

    // Response formatting middleware
    this.app.use(this.middleware.createResponseMiddleware());

    // Rate limiting middleware (global)
    this.app.use(this.middleware.createRateLimitMiddleware());
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        services: Array.from(this.services.keys()),
      });
    });

    // API info endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'Claude Agent Platform API',
        version: '1.0.0',
        description: 'API Gateway for Claude Agent Platform',
        endpoints: Array.from(this.routes.keys()).map(path => ({
          path,
          methods: this.routes.get(path)!.map(r => r.method),
        })),
      });
    });

    // Dynamic route handling
    this.app.all('*', this.handleDynamicRoute.bind(this));
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use(this.middleware.createErrorHandlingMiddleware());

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found`,
          requestId: req.id || uuidv4(),
          timestamp: new Date(),
        },
      });
    });
  }

  /**
   * Handle dynamic routes
   */
  private async handleDynamicRoute(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const path = req.path;
    const method = req.method.toUpperCase();

    // Find matching route configuration
    const routeConfigs = this.routes.get(path) || [];
    const routeConfig = routeConfigs.find(config =>
      Array.isArray(config.method) ? config.method.includes(method) : config.method === method
    );

    if (!routeConfig) {
      return next();
    }

    try {
      // Apply route-specific middleware
      if (routeConfig.middleware) {
        for (const middlewareName of routeConfig.middleware) {
          switch (middlewareName) {
            case 'auth':
              await new Promise((resolve) => {
                const middleware = this.middleware.createAuthMiddleware(routeConfig.auth);
                middleware(req, res, resolve);
              });
              break;
            case 'rateLimit':
              await new Promise((resolve) => {
                const middleware = this.middleware.createRateLimitMiddleware(routeConfig.rateLimit);
                middleware(req, res, resolve);
              });
              break;
            case 'cache':
              await new Promise((resolve) => {
                const middleware = this.middleware.createCacheMiddleware(routeConfig.cache);
                middleware(req, res, resolve);
              });
              break;
            case 'validation':
              await new Promise((resolve) => {
                const middleware = this.middleware.createValidationMiddleware(routeConfig.validation);
                middleware(req, res, resolve);
              });
              break;
          }
        }
      }

      // Proxy to target service
      const response = await this.proxyToService(req, routeConfig);

      // Format and send response
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Proxy request to target service
   */
  private async proxyToService(req: AuthenticatedRequest, routeConfig: RouteConfig): Promise<SuccessResponse<any>> {
    const service = this.services.get(routeConfig.service);
    if (!service) {
      throw new Error(`Service ${routeConfig.service} not found`);
    }

    const startTime = Date.now();

    try {
      // Create proxy request options
      const proxyOptions: ProxyRequestOptions = {
        service: routeConfig.service,
        path: routeConfig.servicePath || req.path,
        method: req.method,
        headers: {
          ...this.buildProxyHeaders(req),
          'X-Original-Method': req.method,
          'X-Original-Path': req.path,
          'X-Forwarded-For': `${req.protocol}://${req.get('host')}`,
          'X-Real-IP': req.ip,
        },
        body: req.body,
        query: req.query,
        timeout: service.timeout,
        retries: service.retries,
      };

      // Execute request (in a real implementation, this would make HTTP request)
      const response = await this.executeServiceRequest(proxyOptions);

      // Log successful proxy
      console.log(JSON.stringify({
        type: 'proxy',
        timestamp: new Date().toISOString(),
        method: proxyOptions.method,
        path: proxyOptions.path,
        service: proxyOptions.service,
        responseTime: Date.now() - startTime,
        status: response.status,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        requestId: req.id,
      }));

      return {
        data: response.body,
        meta: {
          requestId: req.id || uuidv4(),
          timestamp: new Date(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      // Log failed proxy
      console.error(JSON.stringify({
        type: 'proxy-error',
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        service: routeConfig.service,
        responseTime: Date.now() - startTime,
        error: error.message,
        userId: req.user?.id,
        apiKeyId: req.apiKey?.id,
        requestId: req.id,
      }));

      throw error;
    }
  }

  /**
   * Execute service request (mock implementation)
   */
  private async executeServiceRequest(options: ProxyRequestOptions): Promise<ProxyResponse> {
    // In a real implementation, this would make HTTP requests
    // For now, we'll return a mock response
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: {
        service: options.service,
        path: options.path,
        method: options.method,
        message: 'Request processed successfully',
        timestamp: new Date().toISOString(),
      },
      responseTime: 100,
      fromCache: false,
      service: options.service,
    };
  }

  /**
   * Build proxy headers
   */
  private buildProxyHeaders(req: AuthenticatedRequest): Record<string, string> {
    const headers: Record<string, string> = {};

    // Forward authentication information
    if (req.user) {
      headers['X-User-ID'] = req.user.id;
      headers['X-User-Email'] = req.user.email;
      headers['X-User-Role'] = req.user.role;
    }

    if (req.apiKey) {
      headers['X-API-Key'] = req.apiKey.key;
    }

    // Forward original headers
    if (req.headers) {
      Object.keys(req.headers)
        .filter(key => key.startsWith('x-') || key.toLowerCase() === 'content-type')
        .forEach(key => {
          headers[key] = req.headers[key] as string;
        });
    }

    return headers;
  }

  /**
   * Get Express app instance
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get configuration
   */
  getConfig(): GatewayConfig {
    return this.config;
  }

  /**
   * Get services
   */
  getServices(): Map<string, ServiceConfig> {
    return this.services;
  }

  /**
   * Get routes
   */
  getRoutes(): Map<string, RouteConfig[]> {
    return this.routes;
  }
}
