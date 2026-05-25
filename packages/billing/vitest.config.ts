import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/**/index.ts"],
      thresholds: {
        // Portfolio baseline for the package as a whole.
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
        // Entitlements = permission decisions = release-blocking critical
        // path. Locked at 100% line + branch (portfolio CLAUDE.md rule:
        // "100% coverage for critical paths: permissions, security controls").
        "src/entitlements.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
    include: ["src/**/*.test.ts"],
  },
});
