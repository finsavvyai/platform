/**
 * Global teardown for Playwright tests
 * Clean up after test execution
 */

async function globalTeardown(config) {
  console.log('🧹 Cleaning up Playwright test environment...');

  // Perform any necessary cleanup
  // For example: close database connections, clear temporary files, etc.

  console.log('✅ Playwright test teardown completed');
}

export default globalTeardown;