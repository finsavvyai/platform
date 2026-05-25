// Mock react-native-worklets (must come before reanimated)
jest.mock('react-native-worklets', () => ({}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: { call: jest.fn(), createAnimatedComponent: (c) => c || View, View, Text: require('react-native').Text, ScrollView: require('react-native').ScrollView },
    useSharedValue: jest.fn((v) => ({ value: v })),
    useAnimatedStyle: jest.fn((fn) => fn()),
    withTiming: jest.fn((v) => v),
    withSpring: jest.fn((v) => v),
    withRepeat: jest.fn((v) => v),
    withSequence: jest.fn((...args) => args[0]),
    Easing: { linear: jest.fn(), ease: jest.fn(), bezier: jest.fn() },
    FadeIn: { duration: jest.fn().mockReturnThis() },
    FadeOut: { duration: jest.fn().mockReturnThis() },
    SlideInRight: { duration: jest.fn().mockReturnThis() },
    Layout: { duration: jest.fn().mockReturnThis() },
    createAnimatedComponent: (c) => c || View,
    Animated: { View, Text: require('react-native').Text, ScrollView: require('react-native').ScrollView },
  };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: false }),
  AuthenticationType: {
    FACIAL_RECOGNITION: 1,
    FINGERPRINT: 2,
  },
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: false,
  deviceName: 'Test Device',
  modelName: 'iPhone',
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'test-token' }),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  const mockInstance = {
    getString: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    delete: (key) => store.delete(key),
    remove: (key) => store.delete(key),
    contains: (key) => store.has(key),
    getAllKeys: () => [...store.keys()],
    clearAll: () => store.clear(),
  };
  return {
    MMKV: jest.fn().mockImplementation(() => mockInstance),
    createMMKV: jest.fn().mockImplementation(() => mockInstance),
  };
});

// Silence console.warn for act() warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('inside a test was not wrapped in act')) {
    return;
  }
  originalWarn.call(console, ...args);
};
