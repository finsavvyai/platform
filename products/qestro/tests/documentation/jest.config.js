/**
 * Jest Configuration for Documentation Tests
 *
 * Configures Jest for comprehensive documentation testing with
 * appropriate timeouts, reporters, and test patterns.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/documentation/**/*.test.ts',
    '**/tests/documentation/**/*.test.js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/.next/',
    '/.git/'
  ],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/documentation/jest.setup.js'
  ],

  // Global configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'tests/documentation/**/*.ts',
    'tests/documentation/**/*.js',
    '!tests/documentation/**/*.test.ts',
    '!tests/documentation/**/*.test.js',
    '!tests/documentation/**/*.d.ts',
    '!tests/documentation/jest.config.js',
    '!tests/documentation/jest.setup.js'
  ],
  coverageDirectory: 'coverage/documentation',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'clover'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 75,
      statements: 75
    }
  },

  // Test timeout (longer for documentation tests)
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'documentation-test-results.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'documentation-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Documentation Test Report',
        logoImgPath: undefined,
        inlineSource: false
      }
    ]
  ],

  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Error handling
  errorOnDeprecated: true,
  warnOnDeprecated: true,

  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Test results processor
  testResultsProcessor: undefined,

  // Performance monitoring
  maxWorkers: '50%',

  // Test sequencing
  maxConcurrency: 5,

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-documentation',

  // Silent mode (controlled by environment variable)
  silent: process.env.DOCUMENTATION_TESTS_SILENT === 'true'
};
