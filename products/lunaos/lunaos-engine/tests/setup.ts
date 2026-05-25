/**
 * Global test setup for Luna-OS
 */

import { mockEnv } from './fixtures';

// Set test environment variables
Object.entries(mockEnv).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

// Suppress console during tests unless in debug mode
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: () => {},
    debug: () => {},
    info: () => {},
  };
}
