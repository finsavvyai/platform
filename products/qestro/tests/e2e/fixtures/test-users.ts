/**
 * Test User Fixtures
 * Predefined test users for E2E testing
 */

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'team_member';
  subscription?: 'free' | 'pro' | 'enterprise';
}

export const testUsers: Record<string, TestUser> = {
  // Standard user for most tests
  standardUser: {
    email: 'test.user@questro.test',
    password: 'Test123!@#Secure',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    subscription: 'free',
  },

  // Pro subscription user
  proUser: {
    email: 'pro.user@questro.test',
    password: 'Pro123!@#Secure',
    firstName: 'Pro',
    lastName: 'User',
    role: 'user',
    subscription: 'pro',
  },

  // Enterprise user
  enterpriseUser: {
    email: 'enterprise.user@questro.test',
    password: 'Enterprise123!@#Secure',
    firstName: 'Enterprise',
    lastName: 'User',
    role: 'user',
    subscription: 'enterprise',
  },

  // Admin user
  adminUser: {
    email: 'admin@questro.test',
    password: 'Admin123!@#Secure',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    subscription: 'enterprise',
  },

  // Team member for collaboration tests
  teamMember: {
    email: 'team.member@questro.test',
    password: 'Team123!@#Secure',
    firstName: 'Team',
    lastName: 'Member',
    role: 'team_member',
    subscription: 'pro',
  },

  // Demo user for production smoke tests
  demoUser: {
    email: 'test@questro.io',
    password: 'testpassword123',
    firstName: 'Demo',
    lastName: 'User',
    role: 'admin',
  },
};

/**
 * Generate a random test user for isolation
 */
export function generateRandomUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return {
    email: `test.${timestamp}.${random}@questro.test`,
    password: `Test${timestamp}!@#`,
    firstName: 'Test',
    lastName: `User${random}`,
    role: 'user',
    subscription: 'free',
  };
}
