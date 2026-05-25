import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "responsive-*.spec.ts",
  timeout: 60_000,
  retries: 1,
  use: {
    headless: true,
    screenshot: "on",
    trace: "on-first-retry",
  },
  outputDir: "./test-results/responsive",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./html-report/responsive" }]],
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
