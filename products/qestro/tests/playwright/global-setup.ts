/**
 * Global Playwright Setup
 *
 * This file runs once before all tests and sets up the testing environment.
 * It handles database connections, test data preparation, and global configurations.
 */

import { chromium, FullConfig } from "@playwright/test";
import { DatabaseHelper } from "../utils/test-helpers";
import { TestDataGenerator } from "../utils/test-data-generator";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting global Playwright setup...");

  const startTime = Date.now();

  try {
    // 1. Environment Setup
    console.log("📋 Setting up test environment...");
    await setupEnvironment();

    // 2. Database Setup
    console.log("🗄️ Setting up test database...");
    const dbHelper = new DatabaseHelper(
      process.env.TEST_DB_URL || "sqlite::memory:",
    );
    await dbHelper.connect();

    // 3. Test Data Preparation
    console.log("📊 Preparing test data...");
    await prepareTestData(dbHelper);

    // 4. Browser Configuration
    console.log("🌐 Configuring browser settings...");
    await configureBrowserSettings();

    // 5. Mock Services Setup
    console.log("🔧 Setting up mock services...");
    await setupMockServices();

    // 6. Performance Baseline
    console.log("📈 Establishing performance baseline...");
    await establishPerformanceBaseline();

    const setupTime = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${setupTime}ms`);

    // Store global state for tests to use
    process.env.GLOBAL_SETUP_COMPLETE = "true";
    process.env.SETUP_START_TIME = startTime.toString();
  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  }
}

/**
 * Setup test environment variables and configurations
 */
async function setupEnvironment() {
  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.TEST_MODE = "e2e";

  // Configure test timeouts
  process.env.TEST_TIMEOUT = "60000";
  process.env.TEST_ACTION_TIMEOUT = "30000";

  // Set test URLs
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const apiUrl = process.env.API_BASE_URL || "http://localhost:8000";
  const wsUrl = process.env.WS_URL || "ws://localhost:8080";

  process.env.TEST_BASE_URL = baseUrl;
  process.env.TEST_API_URL = apiUrl;
  process.env.TEST_WS_URL = wsUrl;

  // Configure logging
  process.env.TEST_LOG_LEVEL = process.env.CI ? "warn" : "info";

  console.log(`  📍 Base URL: ${baseUrl}`);
  console.log(`  🔗 API URL: ${apiUrl}`);
  console.log(`  🌐 WebSocket URL: ${wsUrl}`);
}

/**
 * Setup database and run migrations if needed
 */
async function prepareTestData(dbHelper: DatabaseHelper) {
  try {
    // Run database migrations
    console.log("  🔄 Running database migrations...");
    await dbHelper.query(`
      CREATE TABLE IF NOT EXISTS test_results (
        id TEXT PRIMARY KEY,
        test_name TEXT NOT NULL,
        status TEXT NOT NULL,
        duration INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Seed essential test data
    console.log("  🌱 Seeding essential test data...");

    // Create test users
    const testUsers = await TestDataGenerator.generateTestUser("admin");
    await dbHelper.query(
      "INSERT OR REPLACE INTO users (id, email, name, role) VALUES (?, ?, ?, ?)",
      [testUsers.id, testUsers.email, testUsers.fullName, testUsers.role],
    );

    // Create test project
    const testProject = await TestDataGenerator.generateTestProject();
    await dbHelper.query(
      "INSERT OR REPLACE INTO projects (id, name, type, framework, created_by) VALUES (?, ?, ?, ?, ?)",
      [
        testProject.id,
        testProject.name,
        testProject.type,
        testProject.framework,
        testUsers.id,
      ],
    );

    // Verify data integrity
    const integrityCheck = await dbHelper.verifyDataIntegrity();
    if (!integrityCheck) {
      throw new Error("Database integrity check failed");
    }

    console.log("  ✅ Database setup completed");
  } catch (error) {
    console.error("  ❌ Database setup failed:", error);
    throw error;
  }
}

/**
 * Configure global browser settings
 */
async function configureBrowserSettings() {
  // Configure browser launch options for consistent testing
  const browserOptions = {
    // Ignore HTTPS errors for testing
    ignoreHTTPSErrors: true,

    // Set consistent viewport
    viewport: { width: 1920, height: 1080 },

    // Disable features that might interfere with tests
    args: [
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--disable-popup-blocking",
    ],

    // Set user agent
    userAgent: "Questro-E2E-Tests/1.0 (Playwright)",
  };

  // Store browser options for tests to use
  process.env.BROWSER_OPTIONS = JSON.stringify(browserOptions);

  console.log("  🌐 Browser settings configured");
}

/**
 * Setup mock services and APIs
 */
async function setupMockServices() {
  // Mock external services that tests shouldn't hit directly
  const mockServices = {
    analytics: {
      endpoint: "/api/analytics/*",
      response: { success: true, data: {} },
    },
    notifications: {
      endpoint: "/api/notifications/*",
      response: { success: true, sent: true },
    },
    fileUpload: {
      endpoint: "/api/upload/*",
      response: { success: true, fileId: "mock-file-id" },
    },
  };

  // Store mock service configurations
  process.env.MOCK_SERVICES = JSON.stringify(mockServices);

  console.log("  🔧 Mock services configured");
}

/**
 * Establish performance baselines for comparison
 */
async function establishPerformanceBaseline() {
  // Launch a temporary browser to measure baseline performance
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Measure basic page load performance
    const startTime = Date.now();
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:3000");
    const loadTime = Date.now() - startTime;

    // Store baseline metrics
    const baseline = {
      pageLoadTime: loadTime,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
    };

    process.env.PERFORMANCE_BASELINE = JSON.stringify(baseline);

    console.log(`  📈 Baseline page load time: ${loadTime}ms`);
  } catch (error) {
    console.warn("  ⚠️ Could not establish performance baseline:", error);
  } finally {
    await browser.close();
  }
}

/**
 * Cleanup function in case setup needs to be aborted
 */
async function cleanup() {
  console.log("🧹 Cleaning up global setup...");

  try {
    // Clean up any temporary resources
    delete process.env.GLOBAL_SETUP_COMPLETE;
    delete process.env.SETUP_START_TIME;

    console.log("✅ Global setup cleanup completed");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

// Handle process termination gracefully
process.on("SIGINT", async () => {
  console.log("🛑 Received SIGINT, cleaning up...");
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Received SIGTERM, cleaning up...");
  await cleanup();
  process.exit(0);
});

// Export for potential use in other scripts
export default globalSetup;
