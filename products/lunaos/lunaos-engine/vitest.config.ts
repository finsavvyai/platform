import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', '!src/**/*.d.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      lines: 95,
      functions: 95,
      branches: 95,
      statements: 95,
      skipFull: true,
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: [
      'node_modules', 'dist', '.idea', '.git', '.cache',
      'tests/integration/**',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
