import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { GatewayModule } from '../src/modules/gateway/gateway.module';
import { RoutingService } from '../src/modules/gateway/services/routing.service';

describe('Rate Limiting Load Tests', () => {
  let app: INestApplication;
  let routingService: RoutingService;

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
    routingService = module.get<RoutingService>(RoutingService);

    await app.init();
  }, 30000); // Increased timeout for Redis connection

  afterAll(async () => {
    await app.close();
  });

  describe('Rate Limiting Performance', () => {
    const testRoute = {
      path: '/api/v1/test-rate-limit',
      method: 'GET' as const,
      service: 'test-service',
      serviceUrl: 'http://localhost:9999',
      auth: { required: false },
      rateLimit: {
        windowMs: 60000, // 1 minute
        max: 10, // 10 requests per minute
      },
      timeout: 1000,
    };

    beforeEach(() => {
      // Add test route before each test
      routingService.addRoute(testRoute);

      // Mock downstream service
      jest.spyOn(app.get<any>('GatewayService'), 'makeDownstreamRequest')
        .mockResolvedValue({
          status: 200,
          data: { message: 'Rate limit test' },
          headers: { 'content-type': 'application/json' },
        });
    });

    afterEach(() => {
      // Clean up route after each test
      routingService.removeRoute('/api/v1/test-rate-limit');
    });

    it('should handle rate limit under normal load', async () => {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map((_, index) =>
        request(app.getHttpServer())
          .get('/api/v1/test-rate-limit')
          .set('X-Forwarded-For', `192.168.1.${index + 1}`) // Different IPs
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Response times should be reasonable
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Check rate limit headers
      responses.forEach(response => {
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        expect(response.headers).toHaveProperty('x-ratelimit-reset');
      });
    });

    it('should enforce rate limits for same IP', async () => {
      const ip = '192.168.1.100';
      const requestsOverLimit = 15; // More than the limit of 10

      const requests = Array(requestsOverLimit).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/v1/test-rate-limit')
          .set('X-Forwarded-For', ip)
      );

      const responses = await Promise.allSettled(requests);

      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      // Should have exactly 10 successful requests (the limit)
      expect(successfulResponses).toHaveLength(10);

      // Should have 5 rate limited responses
      expect(rateLimitedResponses).toHaveLength(5);

      // Check rate limited response format
      if (rateLimitedResponses[0]?.status === 'fulfilled') {
        const rateLimitedResponse = rateLimitedResponses[0].value;
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body.error).toBe('Too Many Requests');
        expect(rateLimitedResponse.body).toHaveProperty('message');
        expect(rateLimitedResponse.body).toHaveProperty('retryAfter');
      }
    });

    it('should handle different rate limits for different routes', async () => {
      // Add route with different rate limit
      const strictRoute = {
        path: '/api/v1/test-strict-limit',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        rateLimit: {
          windowMs: 60000,
          max: 3, // Very strict limit
        },
        timeout: 1000,
      };

      routingService.addRoute(strictRoute);

      const ip = '192.168.1.200';
      const requests = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/v1/test-strict-limit')
          .set('X-Forwarded-For', ip)
      );

      const responses = await Promise.allSettled(requests);

      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      // Should have exactly 3 successful requests (the strict limit)
      expect(successfulResponses).toHaveLength(3);
      expect(rateLimitedResponses).toHaveLength(2);

      // Clean up
      routingService.removeRoute('/api/v1/test-strict-limit');
    });

    it('should handle burst traffic gracefully', async () => {
      const ip = '192.168.1.50';
      const batchSize = 10;
      const totalBatches = 3;
      const delayBetweenBatches = 100; // 100ms between batches

      // Mock service to simulate some processing time
      jest.spyOn(app.get<any>('GatewayService'), 'makeDownstreamRequest')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
          return {
            status: 200,
            data: { message: 'Burst test' },
            headers: { 'content-type': 'application/json' },
          };
        });

      const allResponses = [];

      for (let batch = 0; batch < totalBatches; batch++) {
        const requests = Array(batchSize).fill(null).map(() =>
          request(app.getHttpServer())
            .get('/api/v1/test-rate-limit')
            .set('X-Forwarded-For', ip)
        );

        const batchResponses = await Promise.allSettled(requests);
        allResponses.push(...batchResponses);

        if (batch < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      const successfulResponses = allResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const rateLimitedResponses = allResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      // First batch should all succeed (within limit)
      expect(successfulResponses.length).toBeGreaterThanOrEqual(10);

      // Later batches should have rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle high load with rate limiting', async () => {
      const totalRequests = 100;
      const concurrency = 20;
      const ipRangeStart = 100;

      // Create requests from different IPs to test overall system performance
      const requests = Array(totalRequests).fill(null).map((_, index) => {
        const ip = `192.168.1.${ipRangeStart + (index % 10)}`; // 10 different IPs
        return request(app.getHttpServer())
          .get('/api/v1/test-rate-limit')
          .set('X-Forwarded-For', ip);
      });

      const startTime = Date.now();
      const responsePromises = [];

      // Send requests in batches to control concurrency
      for (let i = 0; i < totalRequests; i += concurrency) {
        const batch = requests.slice(i, i + concurrency);
        responsePromises.push(Promise.allSettled(batch));
      }

      const allBatchResults = await Promise.all(responsePromises);
      const endTime = Date.now();

      // Flatten all responses
      const allResponses = allBatchResults.flat();

      const successfulResponses = allResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const rateLimitedResponses = allResponses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );
      const failedResponses = allResponses.filter(r =>
        r.status === 'rejected'
      );

      // Performance metrics
      const totalTime = endTime - startTime;
      const averageResponseTime = totalTime / totalRequests;
      const successRate = (successfulResponses.length / totalRequests) * 100;

      console.log(`Rate Limiting Load Test Results:
        Total Requests: ${totalRequests}
        Successful: ${successfulResponses.length}
        Rate Limited: ${rateLimitedResponses.length}
        Failed: ${failedResponses.length}
        Total Time: ${totalTime}ms
        Average Response Time: ${averageResponseTime.toFixed(2)}ms
        Success Rate: ${successRate.toFixed(2)}%
      `);

      // Assertions
      expect(failedResponses.length).toBe(0); // No actual failures
      expect(successRate).toBeGreaterThan(50); // At least 50% should succeed
      expect(averageResponseTime).toBeLessThan(500); // Average under 500ms
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds

      // Verify rate limiting is working
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle rate limit headers correctly', async () => {
      const ip = '192.168.1.75';

      // First request
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/test-rate-limit')
        .set('X-Forwarded-For', ip)
        .expect(200);

      // Check rate limit headers
      expect(firstResponse.headers['x-ratelimit-limit']).toBe('10');
      expect(firstResponse.headers['x-ratelimit-remaining']).toBe('9');
      expect(firstResponse.headers['x-ratelimit-reset']).toBeDefined();

      // Make more requests to consume the limit
      for (let i = 0; i < 8; i++) {
        await request(app.getHttpServer())
          .get('/api/v1/test-rate-limit')
          .set('X-Forwarded-For', ip);
      }

      // Check final allowed request
      const finalResponse = await request(app.getHttpServer())
        .get('/api/v1/test-rate-limit')
        .set('X-Forwarded-For', ip)
        .expect(200);

      expect(finalResponse.headers['x-ratelimit-remaining']).toBe('0');

      // Next request should be rate limited
      const rateLimitedResponse = await request(app.getHttpServer())
        .get('/api/v1/test-rate-limit')
        .set('X-Forwarded-For', ip)
        .expect(429);

      expect(rateLimitedResponse.headers['x-ratelimit-limit']).toBe('10');
      expect(rateLimitedResponse.headers['x-ratelimit-remaining']).toBe('0');
      expect(rateLimitedResponse.body).toHaveProperty('retryAfter');
    });
  });

  describe('Rate Limiting Configuration Tests', () => {
    it('should handle custom rate limit configurations', async () => {
      const customRoute = {
        path: '/api/v1/test-custom-limit',
        method: 'GET' as const,
        service: 'test-service',
        serviceUrl: 'http://localhost:9999',
        auth: { required: false },
        rateLimit: {
          windowMs: 30000, // 30 seconds
          max: 5,
          message: 'Custom rate limit exceeded',
        },
        timeout: 1000,
      };

      routingService.addRoute(customRoute);

      const ip = '192.168.1.99';
      const requests = Array(7).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/v1/test-custom-limit')
          .set('X-Forwarded-For', ip)
      );

      const responses = await Promise.allSettled(requests);

      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      if (rateLimitedResponses[0]?.status === 'fulfilled') {
        const rateLimitedResponse = rateLimitedResponses[0].value;
        expect(rateLimitedResponse.body.message).toBe('Custom rate limit exceeded');
      }

      // Clean up
      routingService.removeRoute('/api/v1/test-custom-limit');
    });
  });
});
