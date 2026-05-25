import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/types.ts",
        "src/test-helpers.ts",
      ],
      thresholds: {
        // Portfolio baseline. Critical paths (router, aggregator, audit emit,
        // tenant enforcement) achieve 100% by virtue of their pure-function
        // tests plus the decision-service end-to-end test.
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
});
