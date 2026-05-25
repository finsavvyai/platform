/**
 * Test user data fixtures for LunaOS E2E tests.
 * Uses factory functions to generate unique test data per run.
 */

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: 'free' | 'pro' | 'enterprise' | 'admin';
  apiKey?: string;
}

export interface TestOrganization {
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
}

const timestamp = () => Date.now().toString(36);

export function createNewCustomer(): TestUser {
  const id = timestamp();
  return {
    email: `new-customer-${id}@test.lunaos.ai`,
    password: 'Test!Passw0rd_Secure',
    name: `Test Customer ${id}`,
    role: 'free',
  };
}

export function createProUser(): TestUser {
  return {
    email: process.env.TEST_USER_EMAIL || 'pro@test.lunaos.ai',
    password: process.env.TEST_USER_PASSWORD || 'Pro!Passw0rd_Secure',
    name: 'Pro Test User',
    role: 'pro',
    apiKey: process.env.TEST_API_KEY || 'luna_test_pro_key',
  };
}

export function createEnterpriseUser(): TestUser {
  return {
    email: 'enterprise@test.lunaos.ai',
    password: 'Ent!Passw0rd_Secure',
    name: 'Enterprise Test User',
    role: 'enterprise',
    apiKey: 'luna_test_enterprise_key',
  };
}

export function createAdminUser(): TestUser {
  return {
    email: 'admin@test.lunaos.ai',
    password: 'Admin!Passw0rd_Secure',
    name: 'Admin Test User',
    role: 'admin',
    apiKey: 'luna_test_admin_key',
  };
}

export function createOrganization(): TestOrganization {
  const id = timestamp();
  return {
    name: `Test Org ${id}`,
    slug: `test-org-${id}`,
    plan: 'pro',
  };
}

export const INVALID_CREDENTIALS = {
  email: 'nonexistent@test.lunaos.ai',
  password: 'WrongPassword123!',
};

export const WEAK_PASSWORDS = [
  '123456',
  'password',
  'short',
  'nouppercase1!',
  'NOLOWERCASE1!',
  'NoSpecialChar1',
];

export const TEST_AGENT_CONFIG = {
  name: 'E2E Test Agent',
  description: 'Agent created during E2E testing',
  model: 'gpt-4',
  systemPrompt: 'You are a helpful test assistant.',
  temperature: 0.7,
  maxTokens: 1024,
};
