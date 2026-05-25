import { defineConfig } from 'vitest/config';

/**
 * Vitest config for sample project integration tests.
 * These tests validate every major OpenSyber capability
 * across 8 distinct customer personas/use cases.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 10_000,
  },
});
