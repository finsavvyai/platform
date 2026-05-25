/**
 * Seed data for integration tests.
 *
 * Provides factory functions to insert test records into D1
 * and constants for commonly referenced test entities.
 */

import { createTables } from './test-schema';
import { createTestJWT } from './test-jwt';

// Reexport for convenience
export { createTables } from './test-schema';
export { createTestJWT } from './test-jwt';

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

export const TEST_USER = {
  id: 'user-integration-001',
  email: 'test@lunaos.ai',
  name: 'Integration Tester',
  passwordHash: '',
  tier: 'pro',
  createdAt: '2026-01-01T00:00:00Z',
};

export const TEST_ADMIN = {
  id: 'admin-integration-001',
  email: 'admin@lunaos.ai',
  name: 'Admin Tester',
  passwordHash: '',
  tier: 'team',
  createdAt: '2026-01-01T00:00:00Z',
};

export const TEST_FREE_USER = {
  id: 'user-integration-free',
  email: 'free@lunaos.ai',
  name: 'Free Tier User',
  passwordHash: '',
  tier: 'free',
  createdAt: '2026-01-01T00:00:00Z',
};

export const TEST_TEAM = {
  id: 'team-integration-001',
  name: 'Test Team',
  ownerId: TEST_USER.id,
  createdAt: '2026-01-01T00:00:00Z',
};

export const TEST_AGENT = {
  id: 'agent-integration-001',
  name: 'Echo Agent',
  description: 'Returns the input as output',
  type: 'custom',
  userId: TEST_USER.id,
  config: JSON.stringify({ handler: 'echo' }),
  createdAt: '2026-01-01T00:00:00Z',
};

export const TEST_CHAIN = {
  id: 'chain-integration-001',
  name: 'Test Chain',
  userId: TEST_USER.id,
  nodes: JSON.stringify([
    { id: 'n1', type: 'prompt', config: { prompt: 'Hello' } },
    { id: 'n2', type: 'output', config: {} },
  ]),
  edges: JSON.stringify([{ from: 'n1', to: 'n2' }]),
  createdAt: '2026-01-01T00:00:00Z',
};

export const TEST_API_KEY = {
  id: 'apikey-integration-001',
  userId: TEST_USER.id,
  name: 'Test API Key',
  keyPrefix: 'sk_live_test',
  keyHash: '',
  scopes: JSON.stringify(['agents:read', 'agents:execute']),
  createdAt: '2026-01-01T00:00:00Z',
};

/** Raw API key value (before hashing) for test requests */
export const TEST_API_KEY_RAW = 'sk_live_test_integration_key_001';

// -------------------------------------------------------------------
// Hashing helpers
// -------------------------------------------------------------------

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// -------------------------------------------------------------------
// D1 seed functions
// -------------------------------------------------------------------

/** Insert seed users into D1 */
export async function seedUsers(db: D1Database): Promise<void> {
  const testPwHash = await hashPassword('TestPassword123!');
  const users = [
    { ...TEST_USER, passwordHash: testPwHash },
    { ...TEST_ADMIN, passwordHash: testPwHash },
    { ...TEST_FREE_USER, passwordHash: testPwHash },
  ];
  for (const u of users) {
    await db
      .prepare(
        `INSERT OR REPLACE INTO users (id, email, name, password_hash, tier, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(u.id, u.email, u.name, u.passwordHash, u.tier, u.createdAt)
      .run();
  }
}

/** Insert seed agents into D1 */
export async function seedAgents(db: D1Database): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO agents (id, name, description, type, user_id, config, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      TEST_AGENT.id, TEST_AGENT.name, TEST_AGENT.description,
      TEST_AGENT.type, TEST_AGENT.userId, TEST_AGENT.config,
      TEST_AGENT.createdAt,
    )
    .run();
}

/** Insert seed chains into D1 */
export async function seedChains(db: D1Database): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO chains (id, name, user_id, nodes, edges, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      TEST_CHAIN.id, TEST_CHAIN.name, TEST_CHAIN.userId,
      TEST_CHAIN.nodes, TEST_CHAIN.edges, TEST_CHAIN.createdAt,
    )
    .run();
}

/** Insert seed API keys into D1 */
export async function seedApiKeys(db: D1Database): Promise<void> {
  const keyHash = await hashPassword(TEST_API_KEY_RAW);
  await db
    .prepare(
      `INSERT OR REPLACE INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      TEST_API_KEY.id, TEST_API_KEY.userId, TEST_API_KEY.name,
      TEST_API_KEY.keyPrefix, keyHash, TEST_API_KEY.scopes,
      TEST_API_KEY.createdAt,
    )
    .run();
}

/** Seed all tables with test data */
export async function seedAll(db: D1Database): Promise<void> {
  await createTables(db);
  await seedUsers(db);
  await seedAgents(db);
  await seedChains(db);
  await seedApiKeys(db);
}
