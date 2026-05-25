export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'esnext',
        skipLibCheck: true,
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false
      }
    }],
  },
  testMatch: [
    '**/tests/backend/**/*.test.ts',
    '**/tests/backend/**/*.test.js'
  ],
  collectCoverageFrom: [
    'backend/src/**/*.ts',
    '!backend/src/**/*.d.ts',
    '!backend/src/index.ts',
    '!backend/src/types/**',
    '!**/node_modules/**',
    '!**/*.config.js',
    '!**/*.config.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  globalSetup: '<rootDir>/tests/backend/__tests__/globalSetup.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/backend/__tests__/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  maxWorkers: '50%',
  detectOpenHandles: true,
  forceExit: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  moduleDirectories: ['node_modules', '<rootDir>/backend/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  bail: false,
  errorOnDeprecated: true
};