/**
 * API Gateway interfaces and types for Claude Agent Platform
 */

export interface GatewayConfig {
  server: {
    port: number;
    host: string;
    environment: 'development' | 'staging' | 'production';
  };
  authentication: {
    jwt: {
      secret: string;
      refreshSecret: string;
      expiresIn: string;
      refreshExpiresIn: string;
      issuer: string;
      audience: string;
    };
    apiKeys: {
      headerName: string;
      queryParam: string;
    };
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    headers: string[];
  };
  security: {
    helmet: boolean;
    compression: boolean;
    logging: boolean;
  };
  routes: RouteConfig[];
  services: ServiceConfig[];
}

export interface RouteConfig {
  path: string;
  method: string | string[];
  service: string;
  servicePath?: string;
  auth: {
    required: boolean;
    methods: ('jwt' | 'apiKey')[];
    roles?: string[];
    permissions?: string[];
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  validation?: ValidationSchema;
  middleware?: string[];
  cache?: {
    enabled: boolean;
    ttl: number;
    keyGenerator?: string;
  };
}

export interface ServiceConfig {
  name: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  circuitBreaker: {
    enabled: boolean;
    threshold: number;
    timeout: number;
  };
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
  };
}

export interface ValidationSchema {
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    apiKey?: {
      id: string;
      name: string;
      permissions: string[];
    };
  };
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  type: 'access' | 'refresh';
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  hashedKey: string;
  permissions: string[];
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  userId?: string;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  windowMs: number;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  uptime: number;
  details?: any;
}

export interface GatewayMetrics {
  requests: {
    total: number;
    success: number;
    error: number;
    rate: number;
  };
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  services: ServiceHealth[];
  authentication: {
    jwtValidations: number;
    apiKeyValidations: number;
    failures: number;
  };
  rateLimiting: {
    blocked: number;
    allowed: number;
  };
}

export interface MiddlewareOptions {
  authentication?: {
    required: boolean;
    methods: ('jwt' | 'apiKey')[];
    roles?: string[];
    permissions?: string[];
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Express.Request) => string;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
    keyGenerator?: (req: Express.Request) => string;
  };
  validation?: ValidationSchema;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: Date;
  nextAttempt: Date;
  timeout: number;
  threshold: number;
}

export interface ProxyRequestOptions {
  service: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  timeout: number;
  retries: number;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  fromCache: boolean;
  service: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    requestId: string;
    timestamp: Date;
  };
}

export interface SuccessResponse<T = any> {
  data: T;
  meta: {
    requestId: string;
    timestamp: Date;
    version: string;
    rateLimit?: RateLimitInfo;
  };
}

export type RequestHandler = (
  req: AuthenticatedRequest,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

export type MiddlewareFunction = (
  req: AuthenticatedRequest,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

export type ErrorHandler = (
  error: Error,
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) => void;
