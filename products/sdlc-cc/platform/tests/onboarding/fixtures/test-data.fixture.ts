import { test as base } from './pages.fixture';

/**
 * Test data fixtures for user onboarding tests
 * Provides realistic test data for various scenarios
 */

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company?: string;
}

export interface TestTenant {
  name: string;
  slug: string;
  domain?: string;
  plan?: 'free' | 'starter' | 'professional' | 'enterprise';
}

export const testUsers = {
  /**
   * Valid user for registration tests
   */
  valid: {
    email: 'test.user@example.com',
    password: 'SecurePass123!',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    company: 'Test Company Inc.',
  } as TestUser,

  /**
   * User with invalid email format
   */
  invalidEmail: {
    email: 'invalid-email-format',
    password: 'SecurePass123!',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
  } as TestUser,

  /**
   * User with weak password
   */
  weakPassword: {
    email: 'weak@example.com',
    password: '123',
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
  } as TestUser,

  /**
   * User for login tests (should match seeded data)
   */
  existing: {
    email: 'existing.user@example.com',
    password: 'ExistingPass123!',
    firstName: 'Existing',
    lastName: 'User',
    fullName: 'Existing User',
  } as TestUser,

  /**
   * Generate a unique test user with timestamp
   */
  generate: (prefix = 'test'): TestUser => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return {
      email: `${prefix}.${timestamp}.${random}@e2e-test.example.com`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: `User${timestamp}`,
      fullName: `Test User${timestamp}`,
      company: 'Test Company Inc.',
    };
  },
};

export const testTenants = {
  /**
   * Valid tenant data
   */
  valid: {
    name: 'Test Tenant',
    slug: 'test-tenant',
    domain: 'test-tenant.example.com',
    plan: 'free' as const,
  } as TestTenant,

  /**
   * Generate a unique tenant with timestamp
   */
  generate: (prefix = 'tenant'): TestTenant => {
    const timestamp = Date.now();
    return {
      name: `${prefix}-${timestamp}`,
      slug: `${prefix}-${timestamp}`.toLowerCase().replace(/\s+/g, '-'),
      domain: `${prefix}-${timestamp}.example.com`,
      plan: 'free' as const,
    };
  },
};

/**
 * Form test data for demo requests
 */
export const demoFormData = {
  valid: {
    name: 'John Doe',
    email: 'john.doe@company.com',
    company: 'Acme Corporation',
    message: 'I am interested in learning more about SDLC.ai for our team of 50+ developers.',
  },

  minimal: {
    name: 'Jane Smith',
    email: 'jane@startup.io',
    company: '',
    message: 'Quick question about pricing.',
  },

  invalid: {
    name: '',
    email: 'not-an-email',
    company: '',
    message: 'x',
  },

  generate: (prefix = 'demo'): typeof demoFormData.valid => {
    const timestamp = Date.now();
    return {
      name: `Demo User ${timestamp}`,
      email: `${prefix}.${timestamp}@example.com`,
      company: `Demo Company ${timestamp}`,
      message: `Demo request message created at ${new Date().toISOString()}`,
    };
  },
};

/**
 * PII test data for the playground
 */
export const piiTestData = {
  ssn: 'My Social Security Number is 123-45-6789.',
  email: 'Contact me at john.doe@company.com for details.',
  phone: 'Call me at (555) 123-4567 anytime.',
  creditCard: 'My credit card number is 4532-1234-5678-9010.',
  multiple: `
    Patient Information:
    Name: John Doe
    SSN: 123-45-6789
    Email: john.doe@example.com
    Phone: (555) 123-4567
    Credit Card: 4532-1234-5678-9010
    Address: 123 Main St, New York, NY 10001
  `,
  custom: (text: string) => text,
};

/**
 * API key test data
 */
export const apiKeyData = {
  valid: 'sk-sdlc-test-key-' + Date.now(),
  invalid: 'invalid-key-format',
  expired: 'sk-sdlc-expired-key',
};

/**
 * Extended test fixtures with test data (includes page objects from pages.fixture)
 */
export const test = base.extend<{
  testData: {
    users: typeof testUsers;
    tenants: typeof testTenants;
    demoFormData: typeof demoFormData;
    piiTestData: typeof piiTestData;
    apiKeyData: typeof apiKeyData;
  };
}>({
  testData: async ({ page }, use) => {
    const data = {
      users: testUsers,
      tenants: testTenants,
      demoFormData,
      piiTestData,
      apiKeyData,
    };
    await use(data);
  },
});

/**
 * Re-export everything
 */
export * from '@playwright/test';
export { expect } from '@playwright/test';
