/**
 * Test Setup and Database Fixtures
 */

import { describe, it, expect } from '@jest/globals';

export function createTestEnv() {
  const testData = new Map();
  
  return {
    DB: {
      prepare: (query) => ({
        bind: (...args) => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true })
        })
      }),
      batch: async (statements) => statements.map(() => ({ success: true }))
    },
    CACHE: {
      get: async (key) => testData.get(key),
      put: async (key, value) => testData.set(key, value),
      delete: async (key) => testData.delete(key)
    },
    JWT_SECRET: 'test-secret-key-minimum-32-characters-long',
    LEMONSQUEEZY_API_KEY: 'lmsq_test_key'
  };
}

describe('Setup', () => {
  it('creates test environment', () => {
    const env = createTestEnv();
    expect(env.DB).toBeDefined();
  });
});
