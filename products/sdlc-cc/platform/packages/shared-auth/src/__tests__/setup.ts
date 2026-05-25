// Global test setup for shared-auth package
// Runs after the test framework is installed but before each test file.
import { beforeEach, afterEach, jest } from '@jest/globals';

// Suppress console noise from the production code unless a test explicitly checks it.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});
