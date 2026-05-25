export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/__tests__/**', '!src/interfaces/**'],
  coverageThreshold: {
    global: { branches: 80, lines: 80, functions: 80, statements: 80 },
  },
  verbose: true,
};
