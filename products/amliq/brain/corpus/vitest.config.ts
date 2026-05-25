import { defineConfig } from "vitest/config";

/**
 * Corpus pipeline test config. Thresholds enforce the portfolio
 * baseline (lines >= 90, branches >= 85, functions >= 90) plus the
 * critical-path gate from DESIGN.md §10:
 *   - dedupe.ts    100% line + branch (data integrity)
 *   - pipeline.ts  100% line + branch (orchestration + audit emit)
 *
 * Per-file 100% gates are enforced via the `perFile` flag combined with
 * the file-include allowlist below. If a non-critical-path file dips
 * below 90/85 it surfaces in the overall thresholds; if a critical-path
 * file drops below 100 the per-file gate fails.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/_test-helpers.ts", "src/index.ts"],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
        "src/dedupe.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        "src/pipeline.ts": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
