import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createVitestConfig } from '@finsavvyai/test-config';

const baseConfig = createVitestConfig({ environment: 'jsdom' });

export default mergeConfig(baseConfig, defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
  },
}));
