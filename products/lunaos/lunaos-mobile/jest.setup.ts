/**
 * Jest setup file for LunaOS Mobile.
 *
 * - Starts MSW mock server before all tests
 * - Resets handlers between tests
 * - Stops server after all tests
 * - Silences noisy RN warnings in test output
 */

import '@testing-library/jest-native/extend-expect';
import { server } from './src/test-utils/mocks/server';

// Start MSW before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers between tests to avoid state leakage
afterEach(() => {
  server.resetHandlers();
});

// Stop MSW after all tests
afterAll(() => {
  server.close();
});

// Silence specific RN warnings that clutter test output
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg.includes('Animated:') ||
    msg.includes('componentWillReceiveProps') ||
    msg.includes('componentWillMount')
  ) {
    return;
  }
  originalWarn(...args);
};
