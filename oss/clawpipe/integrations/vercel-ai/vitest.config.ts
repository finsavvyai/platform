import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'clawpipe-ai': path.resolve(
        __dirname,
        'tests/__mocks__/clawpipe-ai.ts',
      ),
    },
  },
  test: {
    globals: true,
  },
});
