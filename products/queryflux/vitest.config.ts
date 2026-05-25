import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/setupTests.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['_archive/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html', 'json-summary'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/api/**',
          '_archive/**',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
      css: {
        modules: {
          classNameStrategy: 'non-scoped',
        },
      },
    },
  })
);
