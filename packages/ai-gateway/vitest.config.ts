import { defineConfig } from "vitest/config";

/**
 * Package-local vitest config. Mirrors the root config but adds the
 * `*.test-helpers.ts` exclusion so shared test scaffolding doesn't count
 * against coverage thresholds.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test-helpers.ts",
        "src/index.ts",
        "src/edge/index.ts",
      ],
    },
    include: ["src/**/*.test.ts"],
  },
});
