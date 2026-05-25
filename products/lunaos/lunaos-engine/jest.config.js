const { pathsToModuleNameMapper } = require('ts-jest/utils');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  // Global configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/apps', '<rootDir>/tools'],

  // Module name mapping for TypeScript paths
  moduleNameMapping: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
  ],

  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'packages/**/*.{ts,tsx}',
    'apps/**/*.{ts,tsx}',
    'tools/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.d.ts',
    '!**/coverage/**',
    '!**/*.config.{js,ts}',
    '!**/__tests__/**',
    '!**/*.stories.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/index.ts',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'clover',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Higher thresholds for critical packages
    'packages/agents/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'packages/gateway/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/.next/',
    '/.nuxt/',
  ],

  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    },
  },

  // Mock patterns
  modulePathIgnorePatterns: [
    '/dist/',
    '/build/',
  ],

  // Timeout configuration
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error handling
  errorOnDeprecated: true,

  // Maximum workers
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Projects configuration for different package types
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['**/*.unit.{test,spec}.{ts,tsx,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.js'],
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['**/*.integration.{test,spec}.{ts,tsx,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],
      testTimeout: 30000,
    },
    {
      displayName: 'Component Tests',
      testMatch: ['**/*.component.{test,spec}.{ts,tsx,js}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/component.setup.js',
        '@testing-library/jest-dom/extend-expect',
      ],
    },
    {
      displayName: 'API Tests',
      testMatch: ['**/*.api.{test,spec}.{ts,tsx,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/api.setup.js'],
      testTimeout: 15000,
    },
  ],

  // Collect coverage only from specified files
  collectCoverageOnlyFrom: undefined,

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Test Report',
        logoImgPath: undefined,
        inlineSource: false,
      },
    ],
  ],
};
