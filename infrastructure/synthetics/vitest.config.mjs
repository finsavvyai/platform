import { defineConfig } from "vitest/config";

// Synthetics package is pure-ESM .mjs (no TS build). Override the repo-root
// vitest config (which targets src/**/*.test.ts) to discover .test.mjs here.
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["probes/**/*.test.mjs"],
  },
});
