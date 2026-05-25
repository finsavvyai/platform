import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "miniflare",
    environmentOptions: {
      kvNamespaces: ["SESSIONS", "CACHE", "REALTIME"],
      d1Databases: ["DB"],
      r2Buckets: ["ARTIFACTS", "MEDIA", "BACKUPS"],
      durableObjects: {
        COLLABORATION_DO: "CollaborationDO",
        SESSION_DO: "SessionDO",
        TEST_EXECUTION_DO: "TestExecutionDO",
      },
      bindings: {
        JWT_SECRET: "test-secret-key",
        OPENAI_API_KEY: "test-openai-key",
        HUGGINGFACE_API_KEY: "test-huggingface-key",
        LEMONSQUEEZY_API_KEY: "test-lemonsqueezy-key",
        RESEND_API_KEY: "test-resend-key",
        NODE_ENV: "test",
        ENVIRONMENT: "test",
        API_URL: "https://test-api.qestro.io",
        FRONTEND_URL: "https://test.qestro.io",
        LOG_LEVEL: "debug",
      },
    },
    coverage: {
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/index.ts",
        "node_modules/",
        "dist/",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": "/src",
      "@/workers": "/src/workers",
      "@/durable-objects": "/src/durable-objects",
      "@/utils": "/src/utils",
      "@/types": "/src/types",
      "@/db": "/src/db",
      "@/kv": "/src/kv",
      "@/storage": "/src/storage",
      "@/cache": "/src/cache",
      "@/auth": "/src/auth",
      "@/api": "/src/api",
      "@/analytics": "/src/analytics",
      "@/billing": "/src/billing",
      "@/testing": "/src/testing",
      "@/ai": "/src/ai",
      "@/compliance": "/src/compliance",
      "@/security": "/src/security",
      "@/monitoring": "/src/monitoring",
      "@/validation": "/src/validation",
      "@/optimization": "/src/optimization",
    },
  },
});
