import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import { config } from '../shared/config';
import { authService, requireAuth } from '../shared/auth';
import { CryptoUtils, EventEmitter } from '../shared/utils';
import { ApiResponse, WebSocketMessage } from '../shared/types';

interface GatewayRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (req: Request, res: Response) => Promise<void>;
  auth?: boolean;
  permissions?: string[];
  rateLimit?: boolean;
  cache?: boolean;
  version?: string;
}

interface ServiceConfig {
  name: string;
  baseUrl: string;
  healthCheck: string;
  timeout: number;
  retries: number;
  loadBalancer?: 'round-robin' | 'least-connections';
}

interface APIGatewayConfig {
  port: number;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  services: Record<string, ServiceConfig>;
  routes: GatewayRoute[];
  caching: {
    enabled: boolean;
    ttl: number;
  };
  monitoring: {
    enabled: boolean;
    provider: string;
  };
}

class APIGateway {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private config: APIGatewayConfig;
  private eventEmitter: EventEmitter;
  private cache = new Map<string, { data: any; expires: number }>();
  private serviceHealth = new Map<string, boolean>();

  constructor(config: APIGatewayConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.cors.origin,
        credentials: config.cors.credentials
      }
    });
    this.eventEmitter = new EventEmitter();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupMonitoring();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(cors(this.config.cors));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: 'Too many requests from this IP'
    });
    this.app.use('/api', limiter);

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request ID
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.id = CryptoUtils.generateId('req');
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: Object.fromEntries(this.serviceHealth),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };
      res.json(health);
    });
  }

  private setupRoutes(): void {
    // Setup authentication middleware
    this.app.use('/api', this.handleAuthentication.bind(this));

    // Setup routes
    this.config.routes.forEach(route => {
      const middleware = this.getRouteMiddleware(route);

      switch (route.method) {
        case 'GET':
          this.app.get(route.path, ...middleware, route.handler);
          break;
        case 'POST':
          this.app.post(route.path, ...middleware, route.handler);
          break;
        case 'PUT':
          this.app.put(route.path, ...middleware, route.handler);
          break;
        case 'DELETE':
          this.app.delete(route.path, ...middleware, route.handler);
          break;
        case 'PATCH':
          this.app.patch(route.path, ...middleware, route.handler);
          break;
      }
    });

    // Proxy to services
    this.app.use('/api', this.proxyToService.bind(this));

    // Error handling
    this.app.use(this.handleError.bind(this));

    // 404 handling
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found`
        }
      });
    });
  }

  private getRouteMiddleware(route: GatewayRoute): any[] {
    const middleware: any[] = [];

    if (route.auth) {
      middleware.push(requireAuth);
    }

    if (route.permissions) {
      middleware.push(this.checkPermissions(route.permissions));
    }

    if (route.rateLimit) {
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        message: 'Too many requests for this endpoint'
      });
      middleware.push(limiter);
    }

    if (route.cache) {
      middleware.push(this.cacheMiddleware(route.path));
    }

    return middleware;
  }

  private checkPermissions(requiredPermissions: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;

      if (!user || !user.permissions) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const hasAllPermissions = requiredPermissions.every(permission =>
        user.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Insufficient permissions to access this resource'
          }
        });
      }

      next();
    };
  }

  private cacheMiddleware(key: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.caching.enabled) {
        return next();
      }

      const cacheKey = `cache:${key}:${req.id}`;
      const cached = this.cache.get(cacheKey);

      if (cached && cached.expires > Date.now()) {
        return res.json(cached.data);
      }

      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data: any) {
        this.cache.set(cacheKey, {
          data,
          expires: Date.now() + this.config.caching.ttl
        });
        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  private async handleAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    try {
      const token = authHeader.substring(7);
      const user = authService.verifyAccessToken(token);

      if (user) {
        (req as any).user = user;

        // Log authentication event
        this.eventEmitter.emit('user.authenticated', {
          userId: user.sub,
          requestId: req.id,
          timestamp: new Date()
        });
      }
    } catch (error) {
      // Token is invalid, but continue processing
      console.error('Authentication error:', error);
    }

    next();
  }

  private async proxyToService(req: Request, res: Response, next: NextFunction): Promise<void> {
    const path = req.path.replace('/api/', '');
    const [serviceName, ...routeParts] = path.split('/');

    const service = this.config.services[serviceName];
    if (!service) {
      return next();
    }

    try {
      // Check service health
      if (!this.serviceHealth.get(serviceName)) {
        throw new Error(`Service ${serviceName} is unhealthy`);
      }

      // Forward request to service
      const response = await this.forwardRequest(service, req, routeParts.join('/'));

      res.json(response);
    } catch (error) {
      this.handleServiceError(serviceName, error, res);
    }
  }

  private async forwardRequest(service: ServiceConfig, req: Request, path: string): Promise<any> {
    const url = `${service.baseUrl}/${path}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`;

    const options: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': req.id,
        'X-Forwarded-For': req.ip,
        'X-Forwarded-Host': req.get('host'),
        'User-Agent': req.get('user-agent') || ''
      },
      body: JSON.stringify(req.body)
    };

    // Add authentication header if user is authenticated
    if ((req as any).user) {
      options.headers['Authorization'] = req.headers.authorization || '';
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Service returned ${response.status}`);
    }

    return await response.json();
  }

  private setupWebSocket(): void {
    // Socket.IO authentication
    this.io.use(authService.socketAuth());

    // Socket.IO connection handling
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.id} connected via WebSocket`);

      // Join user-specific room
      socket.join(`user:${socket.user.id}`);

      // Join team rooms if user is in teams
      socket.user.teams?.forEach((teamId: string) => {
        socket.join(`team:${teamId}`);
      });

      // Handle custom events
      socket.on('subscribe', (channels: string[]) => {
        channels.forEach(channel => socket.join(channel));
      });

      socket.on('unsubscribe', (channels: string[]) => {
        channels.forEach(channel => socket.leave(channel));
      });

      socket.on('message', (data: WebSocketMessage) => {
        this.handleWebSocketMessage(socket, data);
      });

      socket.on('disconnect', () => {
        console.log(`User ${socket.user.id} disconnected`);
      });
    });
  }

  private async handleWebSocketMessage(socket: any, message: WebSocketMessage): Promise<void> {
    try {
      // Validate message
      if (!message.type || !message.payload) {
        throw new Error('Invalid message format');
      }

      // Add authentication info
      message.userId = socket.user.id;
      message.timestamp = new Date();

      // Process message based on type
      switch (message.type) {
        case 'test.update':
          await this.handleTestUpdate(socket, message);
          break;
        case 'test_run.progress':
          await this.handleTestRunProgress(socket, message);
          break;
        case 'recording.start':
          await this.handleRecordingStart(socket, message);
          break;
        case 'recording.stop':
          await this.handleRecordingStop(socket, message);
          break;
        default:
          // Forward to appropriate service
          await this.forwardWebSocketMessage(message);
      }

    } catch (error) {
      socket.emit('error', {
        code: 'MESSAGE_ERROR',
        message: (error as Error).message,
        timestamp: new Date()
      });
    }
  }

  private async handleTestUpdate(socket: any, message: WebSocketMessage): Promise<void> {
    // Broadcast test update to relevant channels
    const { testId, data } = message.payload;

    this.io.to(`test:${testId}`).emit('test.updated', {
      id: message.id,
      type: message.type,
      payload: { testId, data },
      timestamp: message.timestamp,
      userId: message.userId
    });
  }

  private async handleTestRunProgress(socket: any, message: WebSocketMessage): Promise<void> {
    // Broadcast test run progress
    const { testRunId, progress } = message.payload;

    this.io.to(`testRun:${testRunId}`).emit('testRun.progress', {
      id: message.id,
      type: message.type,
      payload: { testRunId, progress },
      timestamp: message.timestamp,
      userId: message.userId
    });
  }

  private async handleRecordingStart(socket: any, message: WebSocketMessage): Promise<void> {
    // Handle recording start
    const { projectId, type } = message.payload;

    // Forward to recording service
    await this.forwardWebSocketMessage(message);

    // Broadcast to project channel
    this.io.to(`project:${projectId}`).emit('recording.started', {
      id: message.id,
      type: message.type,
      payload: { projectId, type },
      timestamp: message.timestamp,
      userId: message.userId
    });
  }

  private async handleRecordingStop(socket: any, message: WebSocketMessage): Promise<void> {
    // Handle recording stop
    const { sessionId } = message.payload;

    // Forward to recording service
    await this.forwardWebSocketMessage(message);

    // Broadcast to relevant channels
    this.io.to(`recording:${sessionId}`).emit('recording.stopped', {
      id: message.id,
      type: message.type,
      payload: { sessionId },
      timestamp: message.timestamp,
      userId: message.userId
    });
  }

  private async forwardWebSocketMessage(message: WebSocketMessage): Promise<void> {
    // Forward message to appropriate service via HTTP or internal queue
    // This would integrate with your service architecture
    console.log('Forwarding WebSocket message:', message.type);
  }

  private setupMonitoring(): void {
    if (!this.config.monitoring.enabled) return;

    // Request monitoring
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.eventEmitter.emit('request.completed', {
          requestId: req.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userId: (req as any).user?.sub,
          timestamp: new Date()
        });
      });

      next();
    });

    // Service health monitoring
    setInterval(() => {
      this.checkServiceHealth();
    }, 30000); // Check every 30 seconds
  }

  private async checkServiceHealth(): Promise<void> {
    for (const [serviceName, service] of Object.entries(this.config.services)) {
      try {
        const response = await fetch(service.healthCheck, {
          timeout: service.timeout
        });

        const isHealthy = response.ok;
        const wasHealthy = this.serviceHealth.get(serviceName);

        this.serviceHealth.set(serviceName, isHealthy);

        if (wasHealthy !== isHealthy) {
          this.eventEmitter.emit('service.health.changed', {
            serviceName,
            healthy: isHealthy,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error(`Health check failed for ${serviceName}:`, error);
        this.serviceHealth.set(serviceName, false);
      }
    }
  }

  private handleError(error: any, req: Request, res: Response, next: NextFunction): void {
    const requestId = req.id;
    const userId = (req as any).user?.sub;

    console.error(`Error in request ${requestId}:`, error);

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        details: config.get('app').debug ? error.stack : undefined,
        timestamp: new Date()
      }
    };

    res.status(error.status || 500).json(errorResponse);

    // Emit error event
    this.eventEmitter.emit('request.error', {
      requestId,
      userId,
      error: error.message,
      timestamp: new Date()
    });
  }

  private handleServiceError(serviceName: string, error: any, res: Response): void {
    console.error(`Service ${serviceName} error:`, error);

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'SERVICE_ERROR',
        message: `Service ${serviceName} is temporarily unavailable`,
        timestamp: new Date()
      }
    };

    res.status(503).json(errorResponse);
  }

  public start(): void {
    this.server.listen(this.config.port, () => {
      console.log(`API Gateway listening on port ${this.config.port}`);

      // Emit startup event
      this.eventEmitter.emit('gateway.started', {
        port: this.config.port,
        timestamp: new Date()
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('API Gateway stopped');
        resolve();
      });
    });
  }

  // Public API for broadcasting events
  public broadcast(event: string, data: any, room?: string): void {
    if (room) {
      this.io.to(room).emit(event, data);
    } else {
      this.io.emit(event, data);
    }
  }

  // Public API for getting service health
  public getServiceHealth(): Record<string, boolean> {
    return Object.fromEntries(this.serviceHealth);
  }

  // Public API for clearing cache
  public clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
    } else {
      const regex = new RegExp(pattern);
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }
}

// Default gateway configuration
const defaultConfig: APIGatewayConfig = {
  port: config.get('server').port,
  cors: {
    origin: config.get('server').cors.origin,
    credentials: config.get('server').cors.credentials
  },
  rateLimit: {
    windowMs: config.get('server').rateLimit.windowMs,
    max: config.get('server').rateLimit.max
  },
  services: {
    backend: {
      name: 'Backend API',
      baseUrl: 'http://localhost:8001',
      healthCheck: 'http://localhost:8001/health',
      timeout: 10000,
      retries: 3
    },
    recording: {
      name: 'Recording Service',
      baseUrl: 'http://localhost:8002',
      healthCheck: 'http://localhost:8002/health',
      timeout: 15000,
      retries: 3
    },
    ai: {
      name: 'AI Service',
      baseUrl: 'http://localhost:8003',
      healthCheck: 'http://localhost:8003/health',
      timeout: 30000,
      retries: 2
    }
  },
  routes: [
    // Auth routes
    {
      path: '/api/auth/login',
      method: 'POST',
      handler: async (req: Request, res: Response) => {
        const result = await authService.login(req.body, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        res.json(result);
      }
    },
    {
      path: '/api/auth/register',
      method: 'POST',
      handler: async (req: Request, res: Response) => {
        const result = await authService.register(req.body, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        res.json(result);
      }
    },
    {
      path: '/api/auth/refresh',
      method: 'POST',
      handler: async (req: Request, res: Response) => {
        const result = await authService.refreshTokens(req.body.refreshToken);
        res.json(result);
      }
    }
  ],
  caching: {
    enabled: true,
    ttl: 300000 // 5 minutes
  },
  monitoring: {
    enabled: true,
    provider: config.get('monitoring').telemetry.provider
  }
};

// Create and export gateway instance
export const gateway = new APIGateway(defaultConfig);

// Start gateway if this is the main module
if (require.main === module) {
  gateway.start();
}

export default APIGateway;