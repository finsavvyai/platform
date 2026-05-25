import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';

// Mock metrics for integration tests
jest.mock('../../lib/metrics', () => ({
  pageViewsTotal: {
    labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
  },
  httpRequestDuration: {
    labels: jest.fn().mockReturnValue({ observe: jest.fn() }),
  },
  demoRequestsTotal: {
    labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
  },
}));

describe('Health API Integration Tests', () => {
  let handler: any;

  beforeAll(async () => {
    // Import the API handler
    handler = (await import('../../pages/api/health')).default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should respond to GET requests', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should respond to HEAD requests', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'HEAD', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should reject unsupported methods', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'POST', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Method not allowed');
      expect(data.allowed).toEqual(['GET', 'HEAD']);
    });
  });

  describe('Response Structure', () => {
    it('should return valid health response structure', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toBeValidHealthResponse();
    });

    it('should include system metrics', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());

      // Memory information
      expect(data).toHaveProperty('memory');
      expect(data.memory).toHaveProperty('used');
      expect(data.memory).toHaveProperty('total');
      expect(data.memory).toHaveProperty('usage');
      expect(typeof data.memory.used).toBe('number');
      expect(typeof data.memory.total).toBe('number');
      expect(typeof data.memory.usage).toBe('number');

      // CPU information
      expect(data).toHaveProperty('cpu');
      expect(data.cpu).toHaveProperty('user');
      expect(data.cpu).toHaveProperty('system');

      // Performance information
      expect(data).toHaveProperty('performance');
      expect(data.performance).toHaveProperty('nodeVersion');
      expect(data.performance).toHaveProperty('platform');
      expect(data.performance).toHaveProperty('arch');

      // Application information
      expect(data).toHaveProperty('application');
      expect(data.application).toHaveProperty('pid');
      expect(data.application).toHaveProperty('uptimeHours');
      expect(data.application).toHaveProperty('uptimeDays');
    });

    it('should include service dependencies', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());

      expect(data).toHaveProperty('services');
      expect(data.services).toHaveProperty('database');
      expect(data.services).toHaveProperty('external');
      expect(data.services.external).toHaveProperty('lemonsqueezy');
      expect(data.services.external).toHaveProperty('analytics');
      expect(data.services.external).toHaveProperty('cdn');
    });
  });

  describe('Headers and Security', () => {
    it('should set correct content-type header', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const headers = res._getHeaders();
      expect(headers['content-type']).toBe('application/json');
    });

    it('should set security headers', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const headers = res._getHeaders();
      expect(headers).toHaveValidSecurityHeaders();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-xss-protection']).toBe('1; mode=block');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set CORS headers', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const headers = res._getHeaders();
      expect(headers).toHaveValidCORSHeaders();
      expect(headers['access-control-allow-origin']).toBe('*');
      expect(headers['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS');
    });

    it('should set cache headers', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const headers = res._getHeaders();
      expect(headers['cache-control']).toBe('public, max-age=30');
    });
  });

  describe('Metrics Integration', () => {
    it('should track page view metrics', async () => {
      const { pageViewsTotal } = require('../../lib/metrics');
      const incSpy = jest.spyOn(pageViewsTotal.labels(), 'inc');

      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(incSpy).toHaveBeenCalled();
    });
  });

  describe('Performance and Load', () => {
    it('should respond within acceptable time limits', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      const startTime = Date.now();
      await handler(req as NextApiRequest, res as NextApiResponse);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should respond within 100ms
    });

    it('should handle concurrent requests', async () => {
      const requests = [];
      const results = [];

      for (let i = 0; i < 20; i++) {
        const { req, res } = (global as any).testUtils.createMockReqRes({
          req: { method: 'GET', url: '/api/health' }
        });
        requests.push(handler(req as NextApiRequest, res as NextApiResponse));
        results.push(res);
      }

      await Promise.all(requests);

      // All requests should succeed
      expect(results.every(res => res._getStatusCode() === 200)).toBe(true);
    });

    it('should handle rapid successive requests', async () => {
      for (let i = 0; i < 50; i++) {
        const { req, res } = (global as any).testUtils.createMockReqRes({
          req: { method: 'GET', url: '/api/health' }
        });

        await handler(req as NextApiRequest, res as NextApiResponse);
        expect(res._getStatusCode()).toBe(200);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing headers gracefully', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health', headers: {} }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle malformed query parameters', async () => {
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: {
          method: 'GET',
          url: '/api/health?invalid=query&another=value',
          query: { invalid: 'query', another: 'value' }
        }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle large header values', async () => {
      const largeHeaderValue = 'x'.repeat(1000);
      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: {
          method: 'GET',
          url: '/api/health',
          headers: { 'x-large-header': largeHeaderValue }
        }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle internal errors gracefully', async () => {
      const originalDateNow = Date.now;
      try {
        Date.now = jest.fn(() => {
          throw new Error('Simulated internal error');
        });

        const { req, res } = (global as any).testUtils.createMockReqRes({
          req: { method: 'GET', url: '/api/health' }
        });

        await handler(req as NextApiRequest, res as NextApiResponse);

        expect(res._getStatusCode()).toBe(500);
        const data = JSON.parse(res._getData());
        expect(data.status).toBe('error');
        expect(data.error).toBe('Internal server error');
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('Environment Variations', () => {
    it('should work in test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'test';

      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());
      expect(data.environment).toBe('test');

      (process.env as any).NODE_ENV = originalEnv;
    });

    it('should work in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());
      expect(data.environment).toBe('production');

      (process.env as any).NODE_ENV = originalEnv;
    });
  });

  describe('Integration with External Systems', () => {
    it('should handle missing environment variables gracefully', async () => {
      const originalVersion = process.env.npm_package_version;
      const originalBuildTime = process.env.BUILD_TIME;

      delete process.env.npm_package_version;
      delete process.env.BUILD_TIME;

      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());
      expect(data.version).toBe('1.0.0'); // Default version
      expect(data.buildTime).toBeDefined(); // Should generate current timestamp

      // Restore environment variables
      if (originalVersion) process.env.npm_package_version = originalVersion;
      if (originalBuildTime) process.env.BUILD_TIME = originalBuildTime;
    });

    it('should use custom environment variables when available', async () => {
      const originalVersion = process.env.npm_package_version;
      const originalBuildTime = process.env.BUILD_TIME;

      process.env.npm_package_version = '2.0.0-test';
      process.env.BUILD_TIME = '2025-01-01T00:00:00.000Z';

      const { req, res } = (global as any).testUtils.createMockReqRes({
        req: { method: 'GET', url: '/api/health' }
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());
      expect(data.version).toBe('2.0.0-test');
      expect(data.buildTime).toBe('2025-01-01T00:00:00.000Z');

      // Restore environment variables
      if (originalVersion) process.env.npm_package_version = originalVersion;
      if (originalBuildTime) process.env.BUILD_TIME = originalBuildTime;
    });
  });
});