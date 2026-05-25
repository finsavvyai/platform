module.exports = {
  preset: 'jest-expo',
  watchman: false,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-modules-core|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-mmkv|react-native-worklets|zustand|lucide-react-native|@gorhom/bottom-sheet)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['./jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/components/atoms/AnimatedPressable.tsx',
    '!src/components/atoms/AnimatedCard.tsx',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
