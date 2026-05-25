import { defineConfig } from "vitest/config";

/**
 * Inference subtree owns its own vitest config (per brain/CLAUDE.md):
 * coverage targets for the bridge live here, not in the brain root.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "src/index.ts", "src/types.ts"],
      thresholds: {
        // Portfolio baseline; retry + fallback critical paths covered by
        // dedicated tests aimed at 100% (see *.test.ts).
        lines: 90,
        branches: 85,
        functions: 90,
      },
    },
  },
});
