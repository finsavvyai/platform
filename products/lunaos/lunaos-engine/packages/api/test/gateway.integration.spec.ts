import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { GatewayModule } from '../src/modules/gateway/gateway.module';
import { GatewayService } from '../src/modules/gateway/gateway.service';
import { RoutingService } from '../src/modules/gateway/services/routing.service';
import { CircuitBreakerService } from '../src/modules/gateway/services/circuit-breaker.service';

describe('Gateway Integration Tests', () => {
  let app: INestApplication;
  let gatewayService: GatewayService;
  let routingService: RoutingService;
  let circuitBreakerService: CircuitBreakerService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            PORT: 3000,
            NODE_ENV: 'test',
            JWT_SECRET: 'test-secret',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
          })],
        }),
        HttpModule.register({
          timeout: 5000,
        }),
        GatewayModule,
      ],
    }).compile();

    app = module.createNestApplication();
    gatewayService = module.get<GatewayService>(GatewayService);
    routingService = module.get<RoutingService>(RoutingService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check Endpoints', () => {
    it('should return gateway health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('services');
      expect(response.body.status).toBe('healthy');
    });

    it('should return available routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/routes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Check for default routes
      const routePaths = response.body.map(r => r.path);
      expect(routePaths).toContain('/api/v1/health');
      expect(routePaths).toContain('/api/v1/auth/*');
      expect(routePaths).toContain('/api/v1/users/*');
    });

    it('should return gateway metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('totalRequests');
      expect(response.body).toHaveProperty('successfulRequests');
      expect(response.body).toHaveProperty('failedRequests');
      expect(response.body).toHaveProperty('averageResponseTime');
      expect(response.body).toHaveProperty('requestsPerMinute');
      expect(response.body).toHaveProperty('activeConnections');
      expect(response.body).toHaveProperty('circuitBreakerTrips');
    });
  });

  describe('Request Routing', () => {
    it('should route requests to correct services', async () => {
      // Add a test route that points to a mock service
      const testRoute = {
        path: '/api/v1/test',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      // Mock the downstream service call
      const mockResponse = { message: 'Test service response' };
      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: mockResponse,
          headers: { 'content-type': 'application/json' },
        });

      const response = await request(app.getHttpServer())
        .get('/api/v1/test')
        .expect(200);

      expect(response.body).toEqual(mockResponse);
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.error).toBe('Not Found');
    });

    it('should handle different HTTP methods', async () => {
      const testRoute = {
        path: '/api/v1/test-methods',
        method: ['POST', 'PUT', 'DELETE'] as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      // Mock downstream service calls
      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: { method: 'test' },
          headers: { 'content-type': 'application/json' },
        });

      await request(app.getHttpServer())
        .post('/api/v1/test-methods')
        .expect(200);

      await request(app.getHttpServer())
        .put('/api/v1/test-methods')
        .expect(200);

      await request(app.getHttpServer())
        .delete('/api/v1/test-methods')
        .expect(200);
    });
  });

  describe('Path Parameter Routing', () => {
    it('should handle path parameters correctly', async () => {
      const testRoute = {
        path: '/api/v1/users/:userId',
        method: 'GET' as const,
        service: 'user-service',
        serviceUrl: 'http://localhost:3002',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      const mockResponse = { userId: '123', name: 'Test User' };
      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: mockResponse,
          headers: { 'content-type': 'application/json' },
        });

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/123')
        .expect(200);

      expect(response.body).toEqual(mockResponse);
    });

    it('should handle wildcard routes', async () => {
      const testRoute = {
        path: '/api/v1/files/*',
        method: 'GET' as const,
        service: 'file-service',
        serviceUrl: 'http://localhost:3008',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      const mockResponse = { filename: 'test.pdf', size: 1024 };
      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: mockResponse,
          headers: { 'content-type': 'application/json' },
        });

      const response = await request(app.getHttpServer())
        .get('/api/v1/files/documents/test.pdf')
        .expect(200);

      expect(response.body).toEqual(mockResponse);
    });
  });

  describe('Request/Response Headers', () => {
    it('should add tracking headers to requests', async () => {
      const testRoute = {
        path: '/api/v1/test-headers',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      let capturedHeaders: any = {};
      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockImplementation(async (req: any, route: any) => {
          capturedHeaders = req.headers;
          return {
            status: 200,
            data: { success: true },
            headers: { 'content-type': 'application/json' },
          };
        });

      await request(app.getHttpServer())
        .get('/api/v1/test-headers')
        .expect(200);

      expect(capturedHeaders).toHaveProperty('X-Gateway-Request-Id');
      expect(capturedHeaders).toHaveProperty('X-Gateway-Service');
      expect(capturedHeaders).toHaveProperty('X-Gateway-Timestamp');
      expect(capturedHeaders['X-Gateway-Service']).toBe('test-service');
    });

    it('should include response tracking headers', async () => {
      const testRoute = {
        path: '/api/v1/test-response-headers',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: { success: true },
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-cache',
          },
        });

      const response = await request(app.getHttpServer())
        .get('/api/v1/test-response-headers')
        .expect(200);

      expect(response.headers).toHaveProperty('x-gateway-response-time');
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers).toHaveProperty('cache-control');
    });
  });

  describe('Error Handling', () => {
    it('should handle downstream service errors', async () => {
      const testRoute = {
        path: '/api/v1/test-error',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app.getHttpServer())
        .get('/api/v1/test-error')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should handle timeout errors', async () => {
      const testRoute = {
        path: '/api/v1/test-timeout',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 100,
      };

      routingService.addRoute(testRoute);

      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));

      const response = await request(app.getHttpServer())
        .get('/api/v1/test-timeout')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const testServiceName = 'test-circuit-service';
      const testRoute = {
        path: '/api/v1/test-circuit',
        method: 'GET' as const,
        service: testServiceName,
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      // Simulate multiple failures to open circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure(testServiceName);
      }

      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockRejectedValue(new Error('Service failing'));

      const response = await request(app.getHttpServer())
        .get('/api/v1/test-circuit')
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should show circuit breaker status in health check', async () => {
      // Open a circuit breaker
      await circuitBreakerService.recordFailure('auth-service');
      await circuitBreakerService.recordFailure('auth-service');
      await circuitBreakerService.recordFailure('auth-service');
      await circuitBreakerService.recordFailure('auth-service');
      await circuitBreakerService.recordFailure('auth-service');

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const authService = response.body.services.find((s: any) => s.service === 'auth-service');
      expect(authService).toBeDefined();
      expect(authService.status).toBe('DOWN');
      expect(authService.circuitBreakerState.state).toBe('OPEN');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const testRoute = {
        path: '/api/v1/test-concurrent',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        timeout: 1000,
      };

      routingService.addRoute(testRoute);

      jest.spyOn(gatewayService as any, 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: { requestId: 'test' },
          headers: { 'content-type': 'application/json' },
        });

      // Make 10 concurrent requests
      const requests = Array(10).fill(null).map(() =>
        request(app.getHttpServer()).get('/api/v1/test-concurrent')
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('requestId');
      });

      // Check metrics
      const metricsResponse = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(metricsResponse.body.totalRequests).toBeGreaterThanOrEqual(10);
      expect(metricsResponse.body.successfulRequests).toBeGreaterThanOrEqual(10);
    });
  });
});
