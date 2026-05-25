/** @type {import('jest').Config} */
const config = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.(t|j)sx?$': [
            '@swc/jest',
            {
                jsc: {
                    parser: {
                        syntax: 'typescript',
                        tsx: true,
                        decorators: false,
                        dynamicImport: true,
                    },
                    transform: {
                        react: {
                            runtime: 'automatic',
                        },
                    },
                },
            },
        ],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    },
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/tests/e2e/', '<rootDir>/out/'],
    collectCoverageFrom: [
        'lib/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'store/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!lib/utils.ts',
        '!lib/investor-mode.ts',
        '!app/**/layout.tsx',
    ],
    coverageThreshold: {
        global: {
            branches: 40,
            functions: 50,
            lines: 50,
            statements: 50,
        },
        './lib/api.ts': {
            branches: 80,
            functions: 90,
            lines: 90,
            statements: 90,
        },
        './store/index.ts': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
};

module.exports = config;
