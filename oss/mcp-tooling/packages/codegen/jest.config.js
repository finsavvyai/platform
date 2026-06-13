module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/example.ts',
    '!src/test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // codegen imports only the ExtractedEndpoint / ExtractedSchema *types* from the
  // parser. The parser's index barrel re-exports modules that aren't present in
  // this package slice, so resolve the type-only import directly to its types module.
  moduleNameMapper: {
    '^@mcpoverflow/openapi-parser$':
      '<rootDir>/node_modules/@mcpoverflow/openapi-parser/src/types.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
};
