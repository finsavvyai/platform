/**
 * Playwright Test Fixtures
 * Provides reusable test data and utilities for Playwright tests
 */

import { test as base, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

// Test data
export const testData = {
  users: {
    validUser: {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    },
    adminUser: {
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User'
    },
    invalidUser: {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    }
  },
  
  tests: {
    sampleTest: {
      name: 'Sample Login Test',
      description: 'Test user login functionality',
      type: 'web'
    },
    apiTest: {
      name: 'API Health Check',
      description: 'Test API endpoints',
      type: 'api'
    }
  },

  urls: {
    login: '/login',
    dashboard: '/dashboard',
    settings: '/settings',
    tests: '/tests'
  }
};

// Browser configurations
export const browserConfigs = {
  desktop: {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  tablet: {
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  mobile: {
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  }
};

// Test environment configurations
export const environments = {
  development: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:3001'
  },
  staging: {
    baseURL: 'https://staging.qestro.app',
    apiURL: 'https://staging-api.qestro.app'
  },
  production: {
    baseURL: 'https://qestro.app',
    apiURL: 'https://api.qestro.app'
  }
};

// Extended test fixture with page objects
type TestFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  // Login page fixture
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  // Dashboard page fixture
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  // Authenticated page fixture - automatically logs in before test
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithValidCredentials();
    await loginPage.expectLoginSuccess();
    await use(page);
  }
});

export { expect } from '@playwright/test';