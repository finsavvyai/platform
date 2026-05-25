import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/cli.ts',          // bin entry (manual smoke-tested)
        'src/cli-analyze.ts',  // bin entry
        'src/index.ts',         // SDK main barrel — covered via consumers
        'src/types.ts',         // type-only definitions
        'src/exports.ts',       // re-export barrel
      ],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
});
