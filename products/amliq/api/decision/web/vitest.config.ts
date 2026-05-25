import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/pages/**',
      'src/components/**',
      'src/layouts/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts'],
      // format.ts is the "pure" utility module — portfolio rule says 100%
      // on critical paths. The score-color picker drives the operator's
      // risk perception; the money formatter handles financial display.
      exclude: ['**/*.test.ts', '**/types.ts'],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 95,
        // 100% on format.ts specifically — see test file for assertions.
        perFile: false,
      },
    },
  },
});
