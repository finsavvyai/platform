/**
 * Jest Configuration for QueryFlux OpenAI App Tests
 *
 * Comprehensive test setup with coverage reporting and
 * performance benchmarks
 */

export default {
  // Test environment
  testEnvironment: "node",

  // Roots for test files
  roots: ["<rootDir>/src", "<rootDir>/tests"],

  // Test file patterns
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],

  // TypeScript transformation
  preset: "ts-jest",

  // Module file extensions
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts",
    "!src/**/__tests__/**",
    "!src/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./src/actions/": {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    "./src/database/": {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./src/security/": {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // Module mocking
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
  },

  // Global test configuration
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Performance monitoring
  reporters: [
    "default",
    [
      "jest-html-reporters",
      {
        publicPath: "./coverage/html-report",
        filename: "report.html",
        expand: true,
        hideIcon: false,
        pageTitle: "QueryFlux OpenAI App Test Report",
      },
    ],
  ],

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Performance settings
  maxWorkers: "50%",
  maxConcurrency: 5,

  // Environment variables for testing
  testEnvironmentOptions: {
    NODE_ENV: "test",
    OPENAI_API_KEY: "test-key",
    ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
  },
};
