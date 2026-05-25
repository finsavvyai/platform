import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src'],
      exclude: ['node_modules', 'dist'],
      lines: 95,
      functions: 95,
      branches: 95,
      statements: 95,
    },
  },
});
