/**
 * @finsavvyai/test-config — Shared Jest preset
 * Portfolio-standard coverage thresholds and reporter config
 */

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: { module: 'ESNext', moduleResolution: 'Node' },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageThresholds: {
    global: {
      branches: 85,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary', 'cobertura'],
  testTimeout: 30000,
  forceExit: true,
  maxWorkers: '50%',
};
