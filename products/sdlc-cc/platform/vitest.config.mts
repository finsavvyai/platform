import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createVitestConfig } from '@finsavvyai/test-config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const baseConfig = createVitestConfig({ environment: 'node' });

export default mergeConfig(baseConfig, defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // DLPService tests at root were written against a class impl that no
    // longer exists — the DLP service now lives in services/dlp (Python).
    // Keep the spec files until a JS DLP shim lands; exclude from CI.
    exclude: [
      'tests/dlp/**',
      'node_modules/**',
    ],
  },
}));
