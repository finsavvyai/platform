const request = require('supertest');
const express = require('express');

// Mock the health-checker module
jest.mock('prom-client', () => {
  return {
    Registry: jest.fn().mockImplementation(() => ({
      setDefaultLabels: jest.fn(),
      contentType: 'text/plain',
      metrics: jest.fn().mockResolvedValue('# HELP test_metric Test metric\ntest_metric 1\n'),
    })),
    collectDefaultMetrics: jest.fn(),
    Histogram: jest.fn().mockImplementation(() => ({
      labels: jest.fn().mockReturnValue({ observe: jest.fn() }),
    })),
    Counter: jest.fn().mockImplementation(() => ({
      labels: jest.fn().mockReturnValue({ inc: jest.fn() }),
    })),
    Gauge: jest.fn().mockImplementation(() => ({
      labels: jest.fn().mockReturnValue({ set: jest.fn() }),
    })),
  };
});

// Mock fetch for service health checks
global.fetch = jest.fn();

describe('Health Checker Service', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Import the app after mocking
    delete require.cache[require.resolve('./health-checker.js')];
    app = require('./health-checker.js');
  });

  describe('GET /health', () => {
    beforeEach(() => {
      // Mock all services as healthy
      global.fetch.mockImplementation((url) => {
        if (url.includes('landing-page')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('sdlc-gateway')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('sdlc-api')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('postgres-exporter')) {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('redis-exporter')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });
    });

    it('should return healthy status for all services', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toHaveLength(5);
      expect(response.body.services.every(s => s.status === 'healthy')).toBe(true);
    });

    it('should include duration metric', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.duration).toMatch(/^\d+ms$/);
    });

    it('should include timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return degraded status when a service is down', async () => {
      // Mock one service as down
      global.fetch.mockImplementation((url) => {
        if (url.includes('sdlc-gateway')) {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true });
      });

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.some(s => s.status === 'unhealthy')).toBe(true);
    });
  });

  describe('GET /health/:service', () => {
    it('should check specific service health', async () => {
      global.fetch.mockResolvedValue({ ok: true });

      const response = await request(app)
        .get('/health/landing-page')
        .expect(200);

      expect(response.body.service).toBe('landing-page');
      expect(response.body.status).toBe('healthy');
      expect(response.body.duration).toMatch(/^\d+ms$/);
    });

    it('should return 404 for unknown service', async () => {
      const response = await request(app)
        .get('/health/unknown-service')
        .expect(404);

      expect(response.body.error).toBe('Service not found');
    });

    it('should return 503 for unhealthy service', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const response = await request(app)
        .get('/health/landing-page')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });

    it('should handle service check timeout', async () => {
      global.fetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        });
      });

      const response = await request(app)
        .get('/health/landing-page')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('GET /metrics', () => {
    it('should return metrics in prometheus format', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toContain('# HELP');
    });

    it('should handle metrics generation error', async () => {
      // Mock register.metrics to throw error
      const { register } = require('prom-client');
      register.metrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      const response = await request(app)
        .get('/metrics')
        .expect(500);

      expect(response.text).toBe('Error generating metrics');
    });
  });

  describe('GET /ready', () => {
    it('should return ready status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /live', () => {
    it('should return alive status', async () => {
      const response = await request(app)
        .get('/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect default metrics on startup', () => {
      const { collectDefaultMetrics } = require('prom-client');
      expect(collectDefaultMetrics).toHaveBeenCalledWith({
        register: expect.any(Object),
      });
    });

    it('should create custom metrics', () => {
      const { Histogram, Counter, Gauge } = require('prom-client');
      expect(Histogram).toHaveBeenCalledWith(expect.objectContaining({
        name: 'http_request_duration_ms',
        help: expect.any(String),
        labelNames: expect.any(Array),
        buckets: expect.any(Array),
      }));

      expect(Counter).toHaveBeenCalledWith(expect.objectContaining({
        name: 'http_requests_total',
        help: expect.any(String),
        labelNames: expect.any(Array),
      }));

      expect(Gauge).toHaveBeenCalledWith(expect.objectContaining({
        name: 'service_up',
        help: expect.any(String),
        labelNames: expect.any(Array),
      }));
    });
  });

  describe('Periodic Health Checks', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should run periodic health checks', () => {
      // Mock setTimeout to avoid actual periodic checks in tests
      jest.spyOn(global, 'setTimeout');
      global.setTimeout.mockImplementation((callback, delay) => {
        if (delay === 30000) {
          // Don't run the periodic check in tests
          return 1;
        }
        return setTimeout(callback, delay);
      });

      require('./health-checker.js');

      expect(global.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/health/landing-page')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });

    it('should handle unexpected errors in health checks', async () => {
      global.fetch.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body.status).toBe('error');
    });
  });
});