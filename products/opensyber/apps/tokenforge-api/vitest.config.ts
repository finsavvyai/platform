import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/types.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@opensyber/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@opensyber/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@opensyber/tokenforge/server/internal': path.resolve(__dirname, '../../packages/tokenforge/src/server/internal.ts'),
      '@opensyber/tokenforge/server': path.resolve(__dirname, '../../packages/tokenforge/src/server/index.ts'),
      '@opensyber/tokenforge/storage/internal': path.resolve(__dirname, '../../packages/tokenforge/src/server/storage/internal.ts'),
      '@opensyber/tokenforge/shared': path.resolve(__dirname, '../../packages/tokenforge/src/shared/types.ts'),
    },
  },
});
