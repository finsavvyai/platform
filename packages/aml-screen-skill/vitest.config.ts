import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve the sibling platform packages to their built dist so this
// package's unit tests run against the REAL aml-screen-client and billing
// code, not stubs. (Both are built before test in CI; see README.)
const alias = {
  "@finsavvyai/aml-screen-client": fileURLToPath(
    new URL("../aml-screen-client/dist/index.js", import.meta.url),
  ),
  "@finsavvyai/billing": fileURLToPath(
    new URL("../billing/dist/index.js", import.meta.url),
  ),
};

export default defineConfig({
  resolve: { alias },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Entitlement gating + metering are critical paths -> 100%.
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
      include: ["src/**/*.ts"],
      // index/bin/server are transport glue (require the MCP SDK + live IO);
      // covered by typecheck + build, not unit tests.
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/bin.ts",
        "src/server.ts",
      ],
    },
  },
});
