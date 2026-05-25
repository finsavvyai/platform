import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "src/migrations/",
        "dist/"
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/*.test.ts"
    ],
    exclude: [
      "node_modules/",
      "dist/"
    ]
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  }
});
