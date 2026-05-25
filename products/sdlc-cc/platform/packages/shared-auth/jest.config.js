module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/types.ts',
    // api.ts is a thin Hono route-wiring layer tested via integration/e2e tests.
    '!src/api.ts',
    // index.ts is a barrel re-export with no logic.
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleNameMapper: {
    '^@supabase/supabase-js$': '<rootDir>/src/__tests__/__mocks__/supabase.ts',
  },
  // Use isolatedModules to skip full type-checking during test runs.
  // Type safety is enforced separately by `npm run typecheck`.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
};
