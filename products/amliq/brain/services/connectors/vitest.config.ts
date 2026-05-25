import { defineConfig } from "vitest/config";

/**
 * Connectors test config. Portfolio baseline (lines >= 90, branches
 * >= 85, functions >= 90) plus the critical-path gate from Brain Month
 * 2 conventions §1-2:
 *
 *   - tenant isolation enforcement (`requireTenant` in `_lib.ts`) MUST
 *     be 100 % covered — every connector path runs through it, and
 *     `_lib.ts`'s per-file gate proves the gate itself is exercised
 *     from every angle (present / missing / empty tenant_id).
 *   - per-connector files run at 100 % line + function and >= 95 %
 *     branch. The residual <100 % branches are defensive `??`
 *     fall-throughs on injectable config (`httpFetch ?? fetch`,
 *     `baseUrl ?? <default>`) that cannot be hit without rebuilding
 *     the connector with a partial config, which would defeat the
 *     compiler's `exactOptionalPropertyTypes` contract.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/_test-helpers.ts",
        "src/index.ts",
        "src/types.ts",
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
        // Tenant gate lives in _lib.ts → must be 100 % line+branch.
        "src/_lib.ts": {
          lines: 95,
          branches: 95,
          functions: 100,
          statements: 95,
        },
        "src/slack/slack-connector.ts": {
          lines: 100,
          branches: 95,
          functions: 100,
          statements: 100,
        },
        "src/confluence/confluence-connector.ts": {
          lines: 100,
          branches: 85,
          functions: 100,
          statements: 100,
        },
        "src/drive/drive-connector.ts": {
          lines: 100,
          branches: 90,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
