module.exports = {
  displayName: 'integration',
  testMatch: ['<rootDir>/__tests__/integration/**/*.test.{js,ts,tsx}'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.integration.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    '^@/styles/(.*)$': '<rootDir>/styles/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  collectCoverageFrom: [
    'pages/api/**/*.{js,ts,tsx}',
    'lib/**/*.{js,ts,tsx}',
    'components/**/*.{js,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
};