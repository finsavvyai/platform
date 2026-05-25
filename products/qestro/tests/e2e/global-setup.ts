/**
 * Global Setup for E2E Tests
 * Runs once before all tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  const { baseURL } = config.projects[0].use;

  if (!baseURL) {
    throw new Error('Base URL is not configured');
  }

  // Launch browser to check if application is running
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log(`📡 Checking if application is running at ${baseURL}...`);

    // Try to access the application
    const response = await page.goto(baseURL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Application is not accessible at ${baseURL}`);
    }

    console.log('✅ Application is running and accessible');

    // Optional: Set up test database, seed data, etc.
    // This is where you would create test users, projects, etc.

    // Store any setup data in environment or file for tests to use
    process.env.E2E_SETUP_COMPLETE = 'true';
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ E2E test environment setup complete');
}

export default globalSetup;
