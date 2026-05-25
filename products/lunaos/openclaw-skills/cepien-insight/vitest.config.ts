import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
        globals: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['plugin.ts', 'helpers.ts'],
            thresholds: {
                lines: 90,
                branches: 85,
                functions: 90,
                statements: 90,
            },
        },
    },
});
