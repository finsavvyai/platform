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
        // Portfolio baseline for the package as a whole.
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
        // AMLIQ Investigate critical-path 100% gate (per products/amliq/
        // CLAUDE.md §"Product-specific test matrix"). Aggregator + router +
        // decision blend + audit emit MUST be 100% line + branch. CI breaks
        // the build if any of these regress.
        "src/aggregator.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/router.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/decision-service.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/audit.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
