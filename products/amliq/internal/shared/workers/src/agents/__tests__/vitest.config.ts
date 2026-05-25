import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test configuration
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

    // Test timeout
    testTimeout: 30000,
    hookTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'coverage/'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },

    // Test reporters
    reporter: ['verbose', 'json'],
    outputFile: {
      json: './test-results/results.json'
    },

    // Test setup and teardown
    setupFiles: [],
    globalSetup: [],

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },

    // Retry configuration
    retry: 2,

    // Test sequencing
    sequence: {
      concurrent: true,
      shuffle: false,
      seed: 42
    }
  },

  // Path aliases
  resolve: {
    alias: {
      '@': '../src',
      '@agents': '../src/agents',
      '@tests': './'
    }
  },

  // TypeScript configuration
  esbuild: {
    target: 'es2020'
  }
});