import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["services/**/src/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "services/agents/**",
      "corpus/**",
      "inference/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "services/api/src/**/*.ts",
        "services/retrieval/src/**/*.ts",
        "services/sanctions/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test-helpers.ts",
        "**/index.ts",
        "**/types.ts",
        "services/agents/**",
        "corpus/**",
        "inference/**",
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        // Critical paths (auth.ts + audit.ts) enforced via dedicated tests
        // achieving 100% — overall thresholds remain >=90/85/90 per portfolio.
      },
    },
  },
});
