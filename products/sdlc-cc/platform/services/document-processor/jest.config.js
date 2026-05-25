/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/app', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'app/**/*.ts',
    '!app/**/*.d.ts',
    '!app/**/index.ts',
    '!app/**/types.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Critical paths must hit 100% per portfolio CLAUDE.md.
    'app/processors/**/*.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
    'app/core/storage-manager.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
  testTimeout: 30000,
}
