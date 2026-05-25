import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.CLAW_GATEWAY_URL || 'https://claw-gateway.broad-dew-49ad.workers.dev',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
})
