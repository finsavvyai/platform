const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  // Inherits from main config but overrides for integration tests
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],

  // Module name mapper
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, {
    prefix: '<rootDir>/',
  }),

  // Integration test patterns
  testMatch: [
    '**/tests/integration/**/*.+(ts|tsx|js)',
    '**/*.integration.{test,spec}.+(ts|tsx|js)',
  ],

  // Setup files for integration tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],

  // Longer timeout for integration tests
  testTimeout: 30000,

  // Collect coverage from integration tests too
  collectCoverage: true,
  collectCoverageFrom: [
    'packages/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/*.spec.{ts,tsx}',
    '!**/index.ts',
  ],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Global variables for integration tests
  globals: {
    __INTEGRATION_TESTS__: true,
  },

  // Verbose output for debugging
  verbose: true,

  // Cache integration tests separately
  cacheDirectory: '<rootDir>/.jest-cache-integration',

  // Integration test specific setup
  globalSetup: '<rootDir>/tests/setup/integration.global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/integration.global-teardown.js',

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/unit/',
    '/e2e/',
  ],

  // Clear mocks between tests
  clearMocks: false, // Don't clear mocks for integration tests
  restoreMocks: false,

  // Error handling
  errorOnDeprecated: true,

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit-integration.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
  ],

  // Projects for different integration test types
  projects: [
    {
      displayName: 'Database Integration',
      testMatch: ['<rootDir>/tests/integration/database/**/*.integration.test.{ts,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/database.setup.js'],
      testTimeout: 45000,
    },
    {
      displayName: 'API Integration',
      testMatch: ['<rootDir>/tests/integration/api/**/*.integration.test.{ts,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/api.setup.js'],
      testTimeout: 20000,
    },
    {
      displayName: 'Plugin Integration',
      testMatch: ['<rootDir>/tests/integration/plugin/**/*.integration.test.{ts,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/plugin.setup.js'],
      testTimeout: 25000,
    },
    {
      displayName: 'Agent Integration',
      testMatch: ['<rootDir>/tests/integration/agent/**/*.integration.test.{ts,js}'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/agent.setup.js'],
      testTimeout: 35000,
    },
  ],
};
