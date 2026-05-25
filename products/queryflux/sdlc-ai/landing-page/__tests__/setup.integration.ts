import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock console methods in tests
const originalConsole = { ...console };

beforeEach(() => {
  jest.clearAllMocks();
  global.console = {
    ...originalConsole,
    // Silence console.log in tests unless explicitly needed
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});

afterEach(() => {
  global.console = originalConsole;
});

// Global test utilities
global.testUtils = {
  // Helper to create mock request/response objects
  createMockReqRes: (overrides = {}) => ({
    req: {
      method: 'GET',
      url: '/',
      headers: {},
      query: {},
      body: {},
      ...overrides.req,
    },
    res: {
      statusCode: 200,
      headers: {},
      data: '',
      _getStatusCode: jest.fn(function() { return this.statusCode; }),
      _getHeaders: jest.fn(function() { return this.headers; }),
      _getData: jest.fn(function() { return this.data; }),
      status: jest.fn(function(code) { this.statusCode = code; return this; }),
      json: jest.fn(function(data) { this.data = JSON.stringify(data); return this; }),
      setHeader: jest.fn(function(name, value) { this.headers[name] = value; return this; }),
      end: jest.fn(function(data) { this.data = data; return this; }),
      ...overrides.res,
    },
  }),

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test data
  generateTestData: (type: string) => {
    const generators = {
      demoRequest: () => ({
        name: 'Test User',
        email: 'test@example.com',
        company: 'Test Company',
        role: 'Developer',
        useCase: 'API Testing',
        message: 'This is a test demo request',
      }),
      healthCheck: () => ({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        environment: 'test',
      }),
    };
    return generators[type]?.() || {};
  },

  // Helper to mock metrics
  mockMetrics: () => ({
    pageViewsTotal: {
      labels: jest.fn().mockReturnValue({
        inc: jest.fn(),
      }),
    },
    httpRequestDuration: {
      labels: jest.fn().mockReturnValue({
        observe: jest.fn(),
      }),
    },
    demoRequestsTotal: {
      labels: jest.fn().mockReturnValue({
        inc: jest.fn(),
      }),
    },
  }),
};

// Extend Jest matchers
expect.extend({
  toBeValidHealthResponse(received) {
    const { status, timestamp, uptime, version } = received;
    const pass = status && timestamp && typeof uptime === 'number' && version;

    return {
      message: () => `expected ${received} to be a valid health response`,
      pass,
    };
  },

  toHaveValidCORSHeaders(received) {
    const requiredHeaders = ['access-control-allow-origin', 'access-control-allow-methods'];
    const headers = Object.keys(received).map(h => h.toLowerCase());
    const pass = requiredHeaders.every(header => headers.includes(header));

    return {
      message: () => `expected response to have valid CORS headers`,
      pass,
    };
  },

  toHaveValidSecurityHeaders(received) {
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy'
    ];
    const headers = Object.keys(received).map(h => h.toLowerCase());
    const pass = securityHeaders.every(header => headers.includes(header));

    return {
      message: () => `expected response to have valid security headers`,
      pass,
    };
  },
});

// Global setup and teardown
beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_URL = 'https://test.lemonsqueezy.com';
});

afterAll(async () => {
  // Cleanup test environment
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Export for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidHealthResponse(): R;
      toHaveValidCORSHeaders(): R;
      toHaveValidSecurityHeaders(): R;
    }
  }
}