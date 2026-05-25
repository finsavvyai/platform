/**
 * Global setup for Playwright tests
 * Ensures the test environment is ready
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config) {
  console.log('🚀 Setting up Playwright test environment...');

  // Check if the dashboard server is running
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ Dashboard server is running on http://localhost:3000');
    } else {
      throw new Error(`Dashboard server returned status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Dashboard server is not accessible:', error.message);
    console.log('💡 Please ensure the Python HTTP server is running: python3 -m http.server 3000 --directory public');
    throw error;
  }

  // Create test results directory
  const testResultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
    console.log('📁 Created test-results directory');
  }

  console.log('✅ Playwright test environment is ready');
}

export default globalSetup;