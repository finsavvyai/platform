// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";
const TRUST_URL = process.env.TRUST_URL ?? "http://localhost:8001";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: GATEWAY_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "x-tenant-id": process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000001",
    },
  },
  projects: [
    {
      name: "api",
      testDir: "./api",
      use: { baseURL: GATEWAY_URL },
    },
    {
      name: "browser-ext",
      testDir: "./browser",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:9999" },
    },
    {
      name: "smoke",
      testDir: "./smoke",
      use: { baseURL: TRUST_URL },
    },
  ],
});
