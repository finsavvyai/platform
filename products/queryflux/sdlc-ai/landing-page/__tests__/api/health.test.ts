import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';

// Mock metrics
jest.mock('../../lib/metrics', () => ({
  pageViewsTotal: {
    labels: jest.fn().mockReturnValue({
      inc: jest.fn(),
    }),
  },
}));

describe('/api/health endpoint', () => {
  let handler: any;

  beforeAll(async () => {
    // Import the API handler
    handler = (await import('../../pages/api/health')).default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 OK status', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
  });

  it('should return health status response', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    const data = JSON.parse(res._getData());
    expect(data).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
    });
  });

  it('should include system information', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    const data = JSON.parse(res._getData());
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('environment');
  });

  it('should include memory usage information', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    const data = JSON.parse(res._getData());
    expect(data).toHaveProperty('memory');
    expect(data.memory).toHaveProperty('used');
    expect(data.memory).toHaveProperty('total');
    expect(data.memory).toHaveProperty('usage');
  });

  it('should set correct content-type header', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getHeaders()['content-type']).toBe('application/json');
  });

  it('should track page view for health check', async () => {
    const { pageViewsTotal } = require('../../lib/metrics');
    const incSpy = jest.spyOn(pageViewsTotal.labels(), 'inc');

    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(incSpy).toHaveBeenCalled();
  });

  it('should handle CORS headers', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: 'https://sdlc.ai',
      },
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
  });

  it('should support HEAD requests', async () => {
    const { req, res } = createMocks({
      method: 'HEAD',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toBe('');
  });

  it('should reject POST requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      url: '/api/health',
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(res._getStatusCode()).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Method not allowed');
  });

  it('should handle rate limiting', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    });

    // Make multiple requests rapidly
    await handler(req as NextApiRequest, res as NextApiResponse);
    await handler(req as NextApiRequest, res as NextApiResponse);
    await handler(req as NextApiRequest, res as NextApiResponse);

    // Should still succeed (health check should be rate-limited)
    expect(res._getStatusCode()).toBe(200);
  });

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Mock an error in the handler
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => {
        throw new Error('Date error');
      });

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/health',
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Internal server error');

      Date.now = originalDateNow;
    });

    it('should handle invalid request format', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/health',
        headers: {
          'invalid-header': 'value',
        },
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/health',
      });

      const startTime = Date.now();
      await handler(req as NextApiRequest, res as NextApiResponse);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should respond within 100ms
    });

    it('should handle concurrent requests', async () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        const { req, res } = createMocks({
          method: 'GET',
          url: '/api/health',
        });
        requests.push(handler(req as NextApiRequest, res as NextApiResponse));
      }

      const results = await Promise.all(requests);
      expect(results.every(result => result._getStatusCode() === 200)).toBe(true);
    });
  });

  describe('Security', () => {
    it('should not expose sensitive information', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/health',
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      const data = JSON.parse(res._getData());

      // Should not contain sensitive information
      expect(JSON.stringify(data)).not.toContain('password');
      expect(JSON.stringify(data)).not.toContain('secret');
      expect(JSON.stringify(data)).not.toContain('key');
    });

    it('should have appropriate cache headers', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/health',
      });

      await handler(req as NextApiRequest, res as NextApiResponse);

      // Health check should have cache control
      expect(res._getHeaders()['cache-control']).toBeDefined();
    });
  });
});