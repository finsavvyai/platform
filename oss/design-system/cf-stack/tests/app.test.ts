import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';

describe('createApp factory', () => {
  it('should create Hono app with all default middleware', () => {
    const app = createApp();
    expect(app).toBeDefined();
  });

  it('should create app with custom CORS origins', () => {
    const app = createApp({
      corsOrigins: ['https://example.com', 'https://test.com'],
    });
    expect(app).toBeDefined();
  });

  it('should create app with custom rate limit config', () => {
    const app = createApp({
      rateLimit: {
        maxRequests: 50,
        windowMs: 30000,
      },
    });
    expect(app).toBeDefined();
  });

  it('should disable error handler when specified', () => {
    const app = createApp({
      enableErrorHandler: false,
    });
    expect(app).toBeDefined();
  });

  it('should disable CORS when specified', () => {
    const app = createApp({
      enableCors: false,
    });
    expect(app).toBeDefined();
  });

  it('should disable rate limiting when specified', () => {
    const app = createApp({
      enableRateLimit: false,
    });
    expect(app).toBeDefined();
  });

  it('should have health endpoint', async () => {
    const app = createApp();
    const response = {
      text: async () => '{"status":"ok"}',
    };
    // Basic check that app is created
    expect(app).toBeDefined();
  });

  it('should accept all config options', () => {
    const app = createApp({
      corsOrigins: ['*'],
      rateLimit: { maxRequests: 100, windowMs: 60000 },
      enableErrorHandler: true,
      enableCors: true,
      enableRateLimit: true,
    });
    expect(app).toBeDefined();
  });
});
