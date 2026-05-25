import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createVitestConfig } from '@finsavvyai/test-config';

const baseConfig = createVitestConfig({ environment: 'jsdom' });

export default mergeConfig(baseConfig, defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/integration/**', '**/lib/metrics.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
}));
