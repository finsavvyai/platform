module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|zustand|msw|@mswjs/.*|@bundled-es-modules/.*|until-async|outvariant|strict-event-emitter|@open-draft/.*|graphql|headers-polyfill)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/test-utils/**',
    '!src/**/__mocks__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // MSW 2.x ships subpath exports that Jest 29's resolver can't traverse.
    // Map the explicit subpath to the resolved CJS entry.
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js',
  },
};
