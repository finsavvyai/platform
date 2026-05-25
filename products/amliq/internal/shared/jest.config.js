/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/workers/',
    '/ui/',
  ],
  modulePathIgnorePatterns: [
    '/node_modules/',
    '/workers/',
    '/ui/',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        esModuleInterop: true,
        strict: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@noble/hashes/sha256$': '<rootDir>/auth/__mocks__/noble-sha256.ts',
    '^@noble/hashes/hmac$': '<rootDir>/auth/__mocks__/noble-hmac.ts',
  },
};
