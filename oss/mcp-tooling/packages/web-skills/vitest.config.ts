import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/index.ts', 'src/types.ts', 'src/runtime/cf-browser.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
      },
    },
  },
})
