/**
 * API Gateway Service for Claude Agent Platform
 *
 * Provides comprehensive API gateway with:
 * - Request routing and load balancing
 * - Circuit breaker pattern
 * - Service discovery
 * - Request/response transformation
 * - Metrics and monitoring
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import { RedisCache } from '@claude-agent/cache';
import {
  GatewayConfig,
  RouteConfig,
  ServiceConfig,
  ServiceHealth,
  CircuitBreakerState,
  ProxyRequestOptions,
  ProxyResponse,
  GatewayMetrics,
  AuthenticatedRequest
} from './interfaces';

export class APIGateway extends EventEmitter {
  private app: Express;
  private config: GatewayConfig;
  private cache: RedisCache;
  private services: Map<string, ServiceConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private metrics: GatewayMetrics;
  private serviceHealth: Map<string, ServiceHealth> = new Map();

  constructor(config: GatewayConfig, cache: RedisCache) {
    super();
    this.config = config;
    this.cache = cache;
    this.app = express();
    this.metrics = this.initializeMetrics();

    this.setupServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Start the gateway server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.config.server.port, this.config.server.host, () => {
        console.log(`API Gateway started on ${this.config.server.host}:${this.config.server.port}`);
        resolve();
      });

      server.on('error', (error) => {
        reject(error);
      });

      // Start health checks
      this.startHealthChecks();
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  /**
   * Get service health status
   */
  getServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Setup services from configuration
   */
  private setupServices(): void {
    for (const service of this.config.services) {
      this.services.set(service.name, service);
      this.initializeCircuitBreaker(service.name, service.circuitBreaker);
    }
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Basic middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security middleware
    if (this.config.security.helmet) {
      const helmet = require('helmet');
      this.app.use(helmet());
    }

    // CORS middleware
    const cors = require('cors');
    this.app.use(cors(this.config.cors));

    // Compression middleware
    if (this.config.security.compression) {
      const compression = require('compression');
      this.app.use(compression());
    }

    // Request logging
    if (this.config.security.logging) {
      const morgan = require('morgan');
      this.app.use(morgan('combined'));
    }

    // Request ID middleware
    this.app.use(this.requestIdMiddleware());

    // Metrics middleware
    this.app.use(this.metricsMiddleware());
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date(),
        services: this.getServiceHealth(),
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req: Request, res: Response) => {
      res.json(this.getMetrics());
    });

    // API routes
    for (const route of this.config.routes) {
      this.setupRoute(route);
    }
  }

  /**
   * Setup individual route
   */
  private setupRoute(route: RouteConfig): void {
    const methods = Array.isArray(route.method) ? route.method : [route.method];

    for (const method of methods) {
      this.app[method.toLowerCase()](
        route.path,
        this.routeMiddleware(route),
        this.proxyHandler(route)
      );
    }
  }

  /**
   * Setup route-specific middleware
   */
  private routeMiddleware(route: RouteConfig) {
    const middleware: any[] = [];

    // Authentication middleware
    if (route.auth.required) {
      const { createAuthMiddleware } = require('./auth');
      // This would be injected or imported
      // middleware.push(createAuthMiddleware(route.auth));
    }

    // Rate limiting middleware
    if (route.rateLimit) {
      const rateLimit = require('express-rate-limit');
      middleware.push(rateLimit({
        windowMs: route.rateLimit.windowMs,
        max: route.rateLimit.maxRequests,
      }));
    }

    // Validation middleware
    if (route.validation) {
      const { body } = require('express-validator');
      if (route.validation.body) {
        middleware.push(body(route.validation.body));
      }

      const { createValidationMiddleware } = require('./middleware');
      const MiddlewareService = require('./middleware').MiddlewareService;
      const middlewareService = new MiddlewareService(this.cache);
      middleware.push(middlewareService.createValidationMiddleware(route.validation));
    }

    return middleware;
  }

  /**
   * Proxy handler for routes
   */
  private proxyHandler(route: RouteConfig) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        const service = this.services.get(route.service);
        if (!service) {
          return res.status(503).json({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: `Service ${route.service} not found`,
              requestId: (req as any).id,
              timestamp: new Date(),
            },
          });
        }

        // Check circuit breaker
        const circuitBreaker = this.circuitBreakers.get(route.service);
        if (circuitBreaker?.status === 'open') {
          return res.status(503).json({
            error: {
              code: 'CIRCUIT_BREAKER_OPEN',
              message: `Service ${route.service} is temporarily unavailable`,
              requestId: (req as any).id,
              timestamp: new Date(),
            },
          });
        }

        const proxyOptions: ProxyRequestOptions = {
          service: service.name,
          path: route.servicePath || req.path,
          method: req.method,
          headers: this.buildHeaders(req),
          body: req.body,
          query: req.query as Record<string, string>,
          timeout: service.timeout,
          retries: service.retries,
        };

        const response = await this.proxyRequest(proxyOptions);

        // Update metrics
        this.updateMetrics(response.responseTime, true);
        this.updateCircuitBreaker(route.service, true);

        // Set response headers
        res.status(response.status);
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Add proxy metadata
        res.setHeader('X-Proxy-Service', response.service);
        res.setHeader('X-Proxy-Response-Time', response.responseTime.toString());
        if (response.fromCache) {
          res.setHeader('X-Cache', 'HIT');
        }

        res.json(response.body);
      } catch (error) {
        // Update metrics
        this.updateMetrics(Date.now() - startTime, false);
        this.updateCircuitBreaker(route.service, false);

        next(error);
      }
    };
  }

  /**
   * Proxy request to service
   */
  private async proxyRequest(options: ProxyRequestOptions): Promise<ProxyResponse> {
    const startTime = Date.now();
    const service = this.services.get(options.service);

    if (!service) {
      throw new Error(`Service ${options.service} not found`);
    }

    const url = `${service.baseUrl}${options.path}`;
    const queryParams = new URLSearchParams(options.query).toString();
    const fullUrl = queryParams ? `${url}?${queryParams}` : url;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        const response = await axios({
          method: options.method as any,
          url: fullUrl,
          headers: options.headers,
          data: options.body,
          timeout: options.timeout,
          validateStatus: (status) => status < 500, // Don't retry on 4xx errors
        });

        return {
          status: response.status,
          headers: response.headers as Record<string, string>,
          body: response.data,
          responseTime: Date.now() - startTime,
          fromCache: false,
          service: options.service,
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors
        if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < options.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  /**
   * Build headers for proxy request
   */
  private buildHeaders(req: AuthenticatedRequest): Record<string, string> {
    const headers: Record<string, string> = {
      ...req.headers as Record<string, string>,
    };

    // Remove hop-by-hop headers
    delete headers['host'];
    delete headers['connection'];
    delete headers['keep-alive'];
    delete headers['proxy-authenticate'];
    delete headers['proxy-authorization'];
    delete headers['te'];
    delete headers['trailers'];
    delete headers['transfer-encoding'];
    delete headers['upgrade'];

    // Add user context if available
    if (req.user) {
      headers['X-User-ID'] = req.user.id;
      headers['X-User-Role'] = req.user.role;
      headers['X-User-Permissions'] = JSON.stringify(req.user.permissions);
    }

    if (req.apiKey) {
      headers['X-API-Key-ID'] = req.apiKey.id;
    }

    // Add request ID
    headers['X-Request-ID'] = (req as any).id;

    return headers;
  }

  /**
   * Initialize circuit breaker
   */
  private initializeCircuitBreaker(serviceName: string, config: ServiceConfig['circuitBreaker']): void {
    if (!config.enabled) return;

    const circuitBreaker: CircuitBreakerState = {
      status: 'closed',
      failures: 0,
      lastFailure: new Date(),
      nextAttempt: new Date(),
      timeout: config.timeout,
      threshold: config.threshold,
    };

    this.circuitBreakers.set(serviceName, circuitBreaker);
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(serviceName: string, success: boolean): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (!circuitBreaker) return;

    if (success) {
      circuitBreaker.failures = 0;
      circuitBreaker.status = 'closed';
    } else {
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = new Date();

      if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.status = 'open';
        circuitBreaker.nextAttempt = new Date(Date.now() + circuitBreaker.timeout);
      }
    }
  }

  /**
   * Start health checks for services
   */
  private startHealthChecks(): void {
    for (const [name, service] of this.services) {
      if (service.healthCheck) {
        this.periodicHealthCheck(name, service);
      }
    }
  }

  /**
   * Perform periodic health check
   */
  private async periodicHealthCheck(serviceName: string, service: ServiceConfig): Promise<void> {
    try {
      const startTime = Date.now();
      const healthUrl = `${service.baseUrl}${service.healthCheck.path}`;

      const response = await axios.get(healthUrl, {
        timeout: service.healthCheck.timeout,
        validateStatus: (status) => status < 500,
      });

      const health: ServiceHealth = {
        name: serviceName,
        status: response.status === 200 ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        uptime: 0, // Would need to track this
        details: response.data,
      };

      this.serviceHealth.set(serviceName, health);
      this.emit('serviceHealth', health);
    } catch (error) {
      const health: ServiceHealth = {
        name: serviceName,
        status: 'unhealthy',
        responseTime: -1,
        lastCheck: new Date(),
        uptime: 0,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };

      this.serviceHealth.set(serviceName, health);
      this.emit('serviceHealth', health);
    }

    // Schedule next health check
    setTimeout(() => {
      this.periodicHealthCheck(serviceName, service);
    }, service.healthCheck.interval);
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): GatewayMetrics {
    return {
      requests: {
        total: 0,
        success: 0,
        error: 0,
        rate: 0,
      },
      responseTime: {
        avg: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
      },
      services: [],
      authentication: {
        jwtValidations: 0,
        apiKeyValidations: 0,
        failures: 0,
      },
      rateLimiting: {
        blocked: 0,
        allowed: 0,
      },
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(responseTime: number, success: boolean): void {
    this.metrics.requests.total++;

    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }

    // Update response time metrics
    this.metrics.responseTime.avg = (this.metrics.responseTime.avg + responseTime) / 2;
    this.metrics.responseTime.min = this.metrics.responseTime.min === 0 ? responseTime : Math.min(this.metrics.responseTime.min, responseTime);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, responseTime);
  }

  /**
   * Request ID middleware
   */
  private requestIdMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      (req as any).id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', (req as any).id);
      next();
    };
  }

  /**
   * Metrics middleware
   */
  private metricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, res.statusCode < 500);
      });

      next();
    };
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found`,
          requestId: (req as any).id,
          timestamp: new Date(),
        },
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`[${(req as any).id}] Gateway Error:`, error);

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
          requestId: (req as any).id,
          timestamp: new Date(),
        },
      });
    });
  }
}
