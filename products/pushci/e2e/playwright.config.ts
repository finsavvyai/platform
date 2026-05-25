import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: "on",
    video: "on",
    trace: "on-first-retry",
    baseURL: process.env.E2E_APP_URL || "https://app.pushci.dev",
  },
  outputDir: "./test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./html-report" }]],
  projects: [
    { name: "landing", testMatch: "landing-pages.spec.ts", use: { baseURL: "https://pushci.dev" } },
    { name: "billing", testMatch: "payment-flow.spec.ts" },
    { name: "dashboard", testMatch: "dashboard-flows.spec.ts" },
  ],
});
