/**
 * Questro Platform - Main Production Worker
 * Enterprise AI-Powered Testing Automation Platform
 *
 * This is the main entry point for the Questro platform in production.
 * It orchestrates all services including AI, test execution, SSO, monitoring,
 * and real-time collaboration features.
 */

import { AIServiceManager } from './services/ai/ai-manager';
import { TestExecutionManager } from './services/test-execution/execution-manager';
import { SSOProviderManager } from './services/sso/provider-manager';
import { DatabaseService } from './services/database-service';
import { MonitoringService } from './monitoring/metrics-collector';
import { RealtimeMonitor } from './durable-objects/test-execution-do';
import { WebSocketService } from './services/websocket-service';

interface Env {
  // Database
  DB: D1Database;

  // KV Storage
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  REALTIME: KVNamespace;
  RATELIMIT: KVNamespace;
  CONFIG: KVNamespace;
  AUDIT: KVNamespace;

  // R2 Storage
  ARTIFACTS: R2Bucket;
  MEDIA: R2Bucket;
  BACKUPS: R2Bucket;

  // Durable Objects
  COLLABORATION_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;
  TEST_EXECUTION_DO: DurableObjectNamespace;
  MONITORING_DO: DurableObjectNamespace;

  // API Keys
  OPENAI_API_KEY: string;
  HUGGINGFACE_API_KEY?: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;

  // SSO Configuration
  SSO_CONFIG: string;

  // External Services
  STRIPE_API_KEY?: string;
  LEMONSQUEEZY_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Initialize core services
      const dbService = new DatabaseService(env.DB);
      const aiManager = new AIServiceManager(env);
      const testManager = new TestExecutionManager(env, dbService);
      const ssoManager = new SSOProviderManager(env, dbService);
      const monitoringService = new MonitoringService(env);

      // Health check endpoint
      if (path === '/health' && method === 'GET') {
        const health = await this.checkHealth(env, dbService);
        return new Response(JSON.stringify(health), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // API Routes
      if (path.startsWith('/api/')) {
        return await this.handleAPIRoutes(request, env, ctx, {
          dbService,
          aiManager,
          testManager,
          ssoManager,
          monitoringService
        });
      }

      // WebSocket endpoint
      if (path === '/ws') {
        return this.handleWebSocket(request, env, ctx);
      }

      // Durable Object endpoints
      if (path.startsWith('/do/')) {
        return await this.handleDurableObject(request, env, ctx);
      }

      // Static assets and frontend
      if (path === '/' || path.startsWith('/static/') || path.startsWith('/assets/')) {
        return await this.handleStaticAssets(request, env);
      }

      // Default 404
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: `Endpoint ${method} ${path} not found`,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  },

  async handleAPIRoutes(request: Request, env: Env, ctx: ExecutionContext, services: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // AI Services Routes
    if (path.startsWith('/api/ai/')) {
      return await this.handleAIRoutes(request, env, services.aiManager, services.dbService);
    }

    // Test Execution Routes
    if (path.startsWith('/api/test-execution/')) {
      return await this.handleTestExecutionRoutes(request, env, services.testManager, services.dbService);
    }

    // SSO Routes
    if (path.startsWith('/api/sso/')) {
      return await this.handleSSORoutes(request, env, services.ssoManager, services.dbService);
    }

    // Monitoring Routes
    if (path.startsWith('/api/monitoring/')) {
      return await this.handleMonitoringRoutes(request, env, services.monitoringService, services.dbService);
    }

    // Database Routes
    if (path.startsWith('/api/database/')) {
      return await this.handleDatabaseRoutes(request, env, services.dbService);
    }

    // Auth Routes
    if (path.startsWith('/api/auth/')) {
      return await this.handleAuthRoutes(request, env, services.dbService);
    }

    // Projects Routes
    if (path.startsWith('/api/projects/')) {
      return await this.handleProjectRoutes(request, env, services.dbService);
    }

    // Analytics Routes
    if (path.startsWith('/api/analytics/')) {
      return await this.handleAnalyticsRoutes(request, env, services.dbService);
    }

    return new Response(JSON.stringify({
      error: 'API Endpoint Not Found',
      message: `API endpoint ${method} ${path} not implemented`
    }), { status: 404 });
  },

  async handleAIRoutes(request: Request, env: Env, aiManager: AIServiceManager, dbService: DatabaseService): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (path) {
        case '/api/ai/generate-test':
          if (method === 'POST') {
            const body = await request.json() as { description: string; platform: string; };
            const result = await aiManager.generateTest(body.description, body.platform);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/ai/optimize-test':
          if (method === 'POST') {
            const body = await request.json() as { testCode: string; };
            const result = await aiManager.optimizeTest(body.testCode);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/ai/analyze-failure':
          if (method === 'POST') {
            const body = await request.json() as { error: string; context: any; };
            const result = await aiManager.analyzeFailure(body.error, body.context);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/ai/usage':
          if (method === 'GET') {
            const usage = await aiManager.getUsageStats();
            return new Response(JSON.stringify(usage), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/ai/models':
          if (method === 'GET') {
            const models = await aiManager.getAvailableModels();
            return new Response(JSON.stringify(models), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/ai/health':
          if (method === 'GET') {
            const health = await aiManager.getHealthStatus();
            return new Response(JSON.stringify(health), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'AI Service Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      error: 'Method Not Allowed',
      message: `Method ${method} not allowed for ${path}`
    }), { status: 405 });
  },

  async handleTestExecutionRoutes(request: Request, env: Env, testManager: TestExecutionManager, dbService: DatabaseService): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (path) {
        case '/api/test-execution/execute':
          if (method === 'POST') {
            const body = await request.json();
            const result = await testManager.executeTest(body);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/test-execution/status':
          if (method === 'GET') {
            const sessionId = url.searchParams.get('sessionId');
            if (!sessionId) {
              return new Response(JSON.stringify({ error: 'Session ID required' }), { status: 400 });
            }
            const status = await testManager.getExecutionStatus(sessionId);
            return new Response(JSON.stringify(status), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/test-execution/cancel':
          if (method === 'POST') {
            const body = await request.json() as { sessionId: string; };
            const result = await testManager.cancelExecution(body.sessionId);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/test-execution/artifacts':
          if (method === 'GET') {
            const sessionId = url.searchParams.get('sessionId');
            if (!sessionId) {
              return new Response(JSON.stringify({ error: 'Session ID required' }), { status: 400 });
            }
            const artifacts = await testManager.getArtifacts(sessionId);
            return new Response(JSON.stringify(artifacts), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Test Execution Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      error: 'Method Not Allowed',
      message: `Method ${method} not allowed for ${path}`
    }), { status: 405 });
  },

  async handleSSORoutes(request: Request, env: Env, ssoManager: SSOProviderManager, dbService: DatabaseService): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (path) {
        case '/api/sso/providers':
          if (method === 'GET') {
            const providers = await ssoManager.getAvailableProviders();
            return new Response(JSON.stringify(providers), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/sso/initiate':
          if (method === 'POST') {
            const body = await request.json() as { providerId: string; returnUrl?: string; };
            const result = await ssoManager.initiateSSO(body.providerId, body.returnUrl);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/sso/callback':
          if (method === 'POST') {
            const body = await request.json();
            const result = await ssoManager.handleSSOCallback(body);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/sso/user-info':
          if (method === 'GET') {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader) {
              return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 });
            }
            const userInfo = await ssoManager.getUserInfo(authHeader);
            return new Response(JSON.stringify(userInfo), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/sso/logout':
          if (method === 'POST') {
            const authHeader = request.headers.get('Authorization');
            const result = await ssoManager.logout(authHeader);
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'SSO Service Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      error: 'Method Not Allowed',
      message: `Method ${method} not allowed for ${path}`
    }), { status: 405 });
  },

  async handleMonitoringRoutes(request: Request, env: Env, monitoringService: MonitoringService, dbService: DatabaseService): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (path) {
        case '/api/monitoring/metrics':
          if (method === 'GET') {
            const metrics = await monitoringService.getCurrentMetrics();
            return new Response(JSON.stringify(metrics), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/monitoring/health':
          if (method === 'GET') {
            const health = await monitoringService.getSystemHealth();
            return new Response(JSON.stringify(health), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/api/monitoring/alerts':
          if (method === 'GET') {
            const alerts = await monitoringService.getActiveAlerts();
            return new Response(JSON.stringify(alerts), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Monitoring Service Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      error: 'Method Not Allowed',
      message: `Method ${method} not allowed for ${path}`
    }), { status: 405 });
  },

  async handleDatabaseRoutes(request: Request, env: Env, dbService: DatabaseService): Promise<Response> {
    // Database operation handlers
    return new Response(JSON.stringify({
      message: 'Database routes operational',
      timestamp: new Date().toISOString()
    }));
  },

  async handleAuthRoutes(request: Request, env: Env, dbService: DatabaseService): Promise<Response> {
    // Authentication handlers
    return new Response(JSON.stringify({
      message: 'Auth routes operational',
      timestamp: new Date().toISOString()
    }));
  },

  async handleProjectRoutes(request: Request, env: Env, dbService: DatabaseService): Promise<Response> {
    // Project management handlers
    return new Response(JSON.stringify({
      message: 'Project routes operational',
      timestamp: new Date().toISOString()
    }));
  },

  async handleAnalyticsRoutes(request: Request, env: Env, dbService: DatabaseService): Promise<Response> {
    // Analytics handlers
    return new Response(JSON.stringify({
      message: 'Analytics routes operational',
      timestamp: new Date().toISOString()
    }));
  },

  async handleWebSocket(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // WebSocket upgrade and handling
    const webSocketService = new WebSocketService(env);
    return webSocketService.handleConnection(request);
  },

  async handleDurableObject(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route to appropriate Durable Object
    if (path.startsWith('/do/test-execution/')) {
      const id = env.TEST_EXECUTION_DO.idFromName(path.split('/')[3]);
      const stub = env.TEST_EXECUTION_DO.get(id);
      return stub.fetch(request);
    }

    if (path.startsWith('/do/collaboration/')) {
      const id = env.COLLABORATION_DO.idFromName(path.split('/')[3]);
      const stub = env.COLLABORATION_DO.get(id);
      return stub.fetch(request);
    }

    if (path.startsWith('/do/session/')) {
      const id = env.SESSION_DO.idFromName(path.split('/')[3]);
      const stub = env.SESSION_DO.get(id);
      return stub.fetch(request);
    }

    return new Response('Durable Object not found', { status: 404 });
  },

  async handleStaticAssets(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve static assets from R2 storage
    if (path.startsWith('/static/') || path.startsWith('/assets/')) {
      const objectKey = path.substring(1); // Remove leading slash
      const object = await env.MEDIA.get(objectKey);

      if (object) {
        return new Response(object.body, {
          headers: {
            'Content-Type': this.getContentType(objectKey),
            'Cache-Control': 'public, max-age=31536000',
          }
        });
      }
    }

    // Serve main frontend application
    if (path === '/') {
      const indexHtml = await env.MEDIA.get('index.html');
      if (indexHtml) {
        return new Response(indexHtml.body, {
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600',
          }
        });
      }
    }

    return new Response('Asset not found', { status: 404 });
  },

  async checkHealth(env: Env, dbService: DatabaseService): Promise<any> {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        ai: 'unknown',
        storage: 'unknown',
        durable_objects: 'unknown'
      },
      version: '1.0.0',
      uptime: Date.now()
    };

    try {
      // Check database
      await dbService.query('SELECT 1');
      health.services.database = 'healthy';
    } catch (error) {
      health.services.database = 'unhealthy';
      health.status = 'degraded';
    }

    try {
      // Check AI services
      const aiManager = new AIServiceManager(env);
      const aiHealth = await aiManager.getHealthStatus();
      health.services.ai = aiHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    } catch (error) {
      health.services.ai = 'unhealthy';
      health.status = 'degraded';
    }

    try {
      // Check storage
      await env.MEDIA.head('health-check');
      health.services.storage = 'healthy';
    } catch (error) {
      health.services.storage = 'unhealthy';
      health.status = 'degraded';
    }

    return health;
  },

  getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject'
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }
};
