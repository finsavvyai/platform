/**
 * Shared test configuration for Luna-OS Wave 1 Sprint
 * Exports vitest preset and test utilities
 */

export const vitestPreset = {
  environment: 'node',
  globals: true,
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    lines: 95,
    functions: 95,
    branches: 95,
    statements: 95,
  },
};

export const testConfig = {
  timeout: 10000,
  hookTimeout: 10000,
  exclude: ['node_modules', 'dist'],
};

export interface TestEnvironment {
  NODE_ENV: 'test';
  DATABASE_URL?: string;
  REDIS_URL?: string;
  LEMONSQUEEZY_API_KEY?: string;
  JWT_SECRET?: string;
}

export const getTestEnv = (): TestEnvironment => ({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
  LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY || 'test-api-key',
  JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-do-not-use-in-production',
});
