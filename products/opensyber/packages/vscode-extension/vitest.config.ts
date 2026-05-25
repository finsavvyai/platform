import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Mock the vscode module — it's only available inside the Extension Host at runtime
    alias: {
      vscode: new URL('./src/__mocks__/vscode.ts', import.meta.url).pathname,
    },
  },
})
