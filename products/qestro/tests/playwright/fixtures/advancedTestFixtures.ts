/**
 * Advanced Playwright Test Fixtures
 * Enhanced fixtures for comprehensive testing scenarios
 */

import { test as base, Page, Browser, BrowserContext } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { RecordingPage } from '../pages/RecordingPage';
import { TestManagementPage } from '../pages/TestManagementPage';
import { BrowserAutomationUtils, PerformanceMonitor } from '../utils/BrowserAutomationUtils';
import { PlaywrightTestHelpers } from '../utils/testHelpers';

// Extended test data with more comprehensive scenarios
export const advancedTestData = {
  users: {
    admin: {
      email: 'admin@qestro.app',
      password: 'admin123!',
      role: 'admin',
      permissions: ['create', 'read', 'update', 'delete', 'manage_users']
    },
    tester: {
      email: 'tester@qestro.app',
      password: 'tester123!',
      role: 'tester',
      permissions: ['create', 'read', 'update', 'execute_tests']
    },
    viewer: {
      email: 'viewer@qestro.app',
      password: 'viewer123!',
      role: 'viewer',
      permissions: ['read']
    },
    premium: {
      email: 'premium@qestro.app',
      password: 'premium123!',
      role: 'user',
      subscription: 'premium',
      permissions: ['create', 'read', 'update', 'delete', 'advanced_features']
    }
  },

  testScenarios: {
    webRecording: {
      name: 'E-commerce Checkout Flow',
      description: 'Record complete checkout process',
      steps: [
        'Navigate to product page',
        'Add item to cart',
        'Proceed to checkout',
        'Fill shipping information',
        'Select payment method',
        'Complete purchase'
      ],
      expectedDuration: 120000 // 2 minutes
    },
    apiTesting: {
      name: 'User Management API',
      description: 'Test user CRUD operations',
      endpoints: [
        { method: 'POST', path: '/api/users', description: 'Create user' },
        { method: 'GET', path: '/api/users/:id', description: 'Get user' },
        { method: 'PUT', path: '/api/users/:id', description: 'Update user' },
        { method: 'DELETE', path: '/api/users/:id', description: 'Delete user' }
      ]
    },
    performanceTesting: {
      name: 'Page Load Performance',
      description: 'Measure page load times',
      thresholds: {
        firstContentfulPaint: 1500,
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.1,
        firstInputDelay: 100
      }
    }
  },

  testEnvironments: {
    development: {
      name: 'Development',
      baseUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:3001',
      database: 'qestro_dev',
      features: ['debug_mode', 'mock_payments']
    },
    staging: {
      name: 'Staging',
      baseUrl: 'https://staging.qestro.app',
      apiUrl: 'https://staging-api.qestro.app',
      database: 'qestro_staging',
      features: ['real_payments', 'analytics']
    },
    production: {
      name: 'Production',
      baseUrl: 'https://qestro.app',
      apiUrl: 'https://api.qestro.app',
      database: 'qestro_prod',
      features: ['real_payments', 'analytics', 'monitoring']
    }
  },

  browserConfigurations: {
    desktop: {
      chrome: {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceScaleFactor: 1
      },
      firefox: {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
        deviceScaleFactor: 1
      },
      safari: {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        deviceScaleFactor: 1
      }
    },
    mobile: {
      iphone: {
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      },
      android: {
        viewport: { width: 412, height: 915 },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
      }
    }
  }
};

// Test data generators
export class TestDataGenerator {
  static generateUser(role: 'admin' | 'tester' | 'viewer' | 'user' = 'user') {
    const timestamp = Date.now();
    return {
      email: `test-${role}-${timestamp}@example.com`,
      password: `Test123!${timestamp}`,
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${timestamp}`,
      role
    };
  }

  static generateTestCase(type: 'web' | 'api' | 'mobile' = 'web') {
    const timestamp = Date.now();
    return {
      name: `Test Case ${timestamp}`,
      description: `Generated test case for ${type} testing`,
      type,
      tags: [type, 'automated', 'generated'],
      priority: 'medium' as const,
      createdAt: new Date().toISOString()
    };
  }

  static generateApiEndpoint(method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET') {
    const timestamp = Date.now();
    return {
      method,
      path: `/api/test-${timestamp}`,
      description: `Test endpoint for ${method} operations`,
      expectedStatus: method === 'POST' ? 201 : 200,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    };
  }
}

// Extended test fixtures
type AdvancedTestFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  recordingPage: RecordingPage;
  testManagementPage: TestManagementPage;
  automationUtils: BrowserAutomationUtils;
  performanceMonitor: PerformanceMonitor;
  authenticatedContext: BrowserContext;
  multiUserContext: {
    admin: BrowserContext;
    tester: BrowserContext;
    viewer: BrowserContext;
  };
  mobileContext: BrowserContext;
  testDataManager: TestDataManager;
};

export const test = base.extend<AdvancedTestFixtures>({
  // Page object fixtures
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  recordingPage: async ({ page }, use) => {
    const recordingPage = new RecordingPage(page);
    await use(recordingPage);
  },

  testManagementPage: async ({ page }, use) => {
    const testManagementPage = new TestManagementPage(page);
    await use(testManagementPage);
  },

  // Utility fixtures
  automationUtils: async ({ page }, use) => {
    const automationUtils = new BrowserAutomationUtils(page);
    await use(automationUtils);
  },

  performanceMonitor: async ({ page }, use) => {
    const performanceMonitor = new PerformanceMonitor(page);
    await use(performanceMonitor);
  },

  // Authenticated context fixture
  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'tests/playwright/auth/user.json'
    });
    await use(context);
    await context.close();
  },

  // Multi-user context fixture
  multiUserContext: async ({ browser }, use) => {
    const adminContext = await browser.newContext({
      storageState: 'tests/playwright/auth/admin.json'
    });
    const testerContext = await browser.newContext({
      storageState: 'tests/playwright/auth/tester.json'
    });
    const viewerContext = await browser.newContext({
      storageState: 'tests/playwright/auth/viewer.json'
    });

    await use({
      admin: adminContext,
      tester: testerContext,
      viewer: viewerContext
    });

    await adminContext.close();
    await testerContext.close();
    await viewerContext.close();
  },

  // Mobile context fixture
  mobileContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      ...advancedTestData.browserConfigurations.mobile.iphone,
      storageState: 'tests/playwright/auth/user.json'
    });
    await use(context);
    await context.close();
  },

  // Test data manager fixture
  testDataManager: async ({}, use) => {
    const testDataManager = new TestDataManager();
    await testDataManager.initialize();
    await use(testDataManager);
    await testDataManager.cleanup();
  }
});

// Test data management
export class TestDataManager {
  private createdUsers: string[] = [];
  private createdTests: string[] = [];
  private createdEnvironments: string[] = [];

  async initialize(): Promise<void> {
    // Set up test database state
    console.log('Initializing test data manager...');
  }

  async createTestUser(role: 'admin' | 'tester' | 'viewer' | 'user' = 'user'): Promise<any> {
    const user = TestDataGenerator.generateUser(role);
    
    // Create user via API
    const response = await fetch('/api/test-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const createdUser = await response.json();
    this.createdUsers.push(createdUser.id);
    
    return createdUser;
  }

  async createTestCase(type: 'web' | 'api' | 'mobile' = 'web'): Promise<any> {
    const testCase = TestDataGenerator.generateTestCase(type);
    
    // Create test case via API
    const response = await fetch('/api/test-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase)
    });
    
    const createdTest = await response.json();
    this.createdTests.push(createdTest.id);
    
    return createdTest;
  }

  async createTestEnvironment(name: string, config: any): Promise<any> {
    const environment = { name, ...config };
    
    // Create environment via API
    const response = await fetch('/api/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(environment)
    });
    
    const createdEnvironment = await response.json();
    this.createdEnvironments.push(createdEnvironment.id);
    
    return createdEnvironment;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up test data...');
    
    // Clean up created test data
    for (const userId of this.createdUsers) {
      try {
        await fetch(`/api/test-users/${userId}`, { method: 'DELETE' });
      } catch (error) {
        console.warn(`Failed to delete user ${userId}:`, error);
      }
    }
    
    for (const testId of this.createdTests) {
      try {
        await fetch(`/api/test-cases/${testId}`, { method: 'DELETE' });
      } catch (error) {
        console.warn(`Failed to delete test ${testId}:`, error);
      }
    }
    
    for (const envId of this.createdEnvironments) {
      try {
        await fetch(`/api/environments/${envId}`, { method: 'DELETE' });
      } catch (error) {
        console.warn(`Failed to delete environment ${envId}:`, error);
      }
    }
  }
}

// Custom test helpers
export class AdvancedTestHelpers extends PlaywrightTestHelpers {
  /**
   * Set up test environment with specific configuration
   */
  static async setupTestEnvironment(page: Page, environment: keyof typeof advancedTestData.testEnvironments): Promise<void> {
    const config = advancedTestData.testEnvironments[environment];
    
    // Set environment-specific cookies or local storage
    await page.addInitScript((config) => {
      localStorage.setItem('test-environment', JSON.stringify(config));
    }, config);
  }

  /**
   * Mock external services for testing
   */
  static async mockExternalServices(page: Page): Promise<void> {
    // Mock payment service
    await page.route('**/api/payments/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, transactionId: 'mock-123' })
      });
    });

    // Mock analytics service
    await page.route('**/api/analytics/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tracked: true })
      });
    });

    // Mock notification service
    await page.route('**/api/notifications/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent: true })
      });
    });
  }

  /**
   * Simulate network conditions for performance testing
   */
  static async simulateNetworkConditions(page: Page, condition: 'slow3g' | 'fast3g' | 'offline'): Promise<void> {
    const conditions = {
      slow3g: {
        offline: false,
        downloadThroughput: 500 * 1024 / 8, // 500 Kbps
        uploadThroughput: 500 * 1024 / 8,
        latency: 400
      },
      fast3g: {
        offline: false,
        downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
        uploadThroughput: 750 * 1024 / 8, // 750 Kbps
        latency: 150
      },
      offline: {
        offline: true,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0
      }
    };

    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', conditions[condition]);
  }

  /**
   * Generate comprehensive test report
   */
  static async generateTestReport(testResults: any[], outputPath: string): Promise<void> {
    const report = {
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.status === 'passed').length,
        failed: testResults.filter(r => r.status === 'failed').length,
        skipped: testResults.filter(r => r.status === 'skipped').length
      },
      details: testResults,
      generatedAt: new Date().toISOString()
    };

    await this.generateTestDataFile(report, outputPath);
  }
}

export { expect } from '@playwright/test';