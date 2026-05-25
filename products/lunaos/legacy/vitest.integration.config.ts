import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: [
            "packages/**/test/**/*.integration.test.ts",
            "workers/**/test/**/*.integration.test.ts"
        ],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "packages/lunaforge-extension/**"
        ]
    }
});
