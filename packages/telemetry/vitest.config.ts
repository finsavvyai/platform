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
        // Tamper-chain primitives are release-blocking security controls
        // (portfolio CLAUDE.md: "100% coverage for security controls").
        // chain.ts, sign.ts, verifier.ts each guarded at 100/100.
        "src/audit-tamper/chain.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/audit-tamper/sign.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/audit-tamper/verifier.ts": {
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
