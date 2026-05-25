import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createVitestConfig } from '@finsavvyai/test-config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const baseConfig = createVitestConfig({ environment: 'node' });

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: [path.resolve(rootDir, 'src/__tests__/**/*.test.ts')],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/__tests__/**'],
    },
  },
}));
