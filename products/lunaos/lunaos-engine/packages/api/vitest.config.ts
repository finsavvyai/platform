import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts', 'test/chaos*.spec.ts'],
        exclude: ['node_modules/**'],
        environment: 'node',
    },
});
