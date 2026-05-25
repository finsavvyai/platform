/**
 * @finsavvyai/test-config — Shared Vitest preset
 */

import type { UserConfig } from 'vitest/config';

export const vitestPreset: UserConfig['test'] = {
  globals: true,
  environment: 'node',
  coverage: {
    provider: 'v8',
    thresholds: {
      branches: 85,
      functions: 85,
      lines: 90,
      statements: 90,
    },
    reporter: ['text', 'lcov', 'html', 'json-summary'],
    exclude: [
      'node_modules/**',
      '**/__tests__/**',
      '**/*.d.ts',
      '**/*.config.*',
      'coverage/**',
      'dist/**',
    ],
  },
  testTimeout: 30000,
};

export const vitestFrontendPreset: UserConfig['test'] = {
  ...vitestPreset,
  environment: 'jsdom',
  css: true,
};

export const vitestWorkersPreset: UserConfig['test'] = {
  ...vitestPreset,
  environment: 'miniflare',
};
