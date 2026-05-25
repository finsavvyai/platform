/** @type {import('jest').Config} */
const config = {
    displayName: 'api',
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/*.spec.ts',
    ],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: '<rootDir>/tsconfig.json',
            },
        ],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/index.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
    coverageDirectory: '<rootDir>/coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 30000,
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    globalSetup: '<rootDir>/test/globalSetup.ts',
    globalTeardown: '<rootDir>/test/globalTeardown.ts',
    clearMocks: true,
    restoreMocks: true,
};

module.exports = config;
