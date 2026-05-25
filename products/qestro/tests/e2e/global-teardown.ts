/**
 * Global Teardown for E2E Tests
 * Runs once after all tests complete
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');

  // Optional: Clean up test data, close connections, etc.
  // This is where you would delete test users, projects, etc.

  try {
    // Cleanup logic here
    console.log('✅ E2E test environment cleanup complete');
  } catch (error) {
    console.error('⚠️ Error during cleanup:', error);
    // Don't throw - cleanup errors shouldn't fail the test run
  }
}

export default globalTeardown;
