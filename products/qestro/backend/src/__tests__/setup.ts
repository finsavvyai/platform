import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/questro_test';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
  process.env.LEMON_SQUEEZY_API_KEY = 'test-lemonsqueezy-key';
});

// Global mocks
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  })),
}));

jest.mock('bull', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

// Mock database connection
jest.mock('../config/database.js', () => ({
  db: {
    query: jest.fn(),
    execute: jest.fn(),
  },
}));

// Global test utilities
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};


