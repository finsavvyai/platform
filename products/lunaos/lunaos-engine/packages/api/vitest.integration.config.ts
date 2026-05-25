import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        include: ['test/sso-integration.test.ts'],
        environment: 'node',
    },
});
