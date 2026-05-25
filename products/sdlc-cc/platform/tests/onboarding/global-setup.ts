import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up test environment...');

  // Log environment information
  console.log(`📊 Test environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Base URL: ${config.projects?.[0]?.use?.baseURL || 'http://localhost:3000'}`);
  console.log(`👥 Workers: ${config.workers || 1}`);

  // Set any required environment variables
  process.env.TZ = 'America/New_York';
  process.env.LANG = 'en_US.UTF-8';

  console.log('✅ Test environment setup complete');
}

export default globalSetup;
