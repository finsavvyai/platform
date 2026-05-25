import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'coverage/',
        '**/*.config.ts',
        '**/types.ts'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    },
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist', '.idea', '.git', '.cache', 'tests/integration/**']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@tenantiq/db': path.resolve(__dirname, './packages/db/src'),
      '@tenantiq/shared': path.resolve(__dirname, './packages/shared/src')
    }
  }
});
