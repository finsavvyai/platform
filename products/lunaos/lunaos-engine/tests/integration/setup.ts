/**
 * Integration test setup for LunaOS Engine.
 *
 * Provides createTestContext() which spins up a miniflare instance
 * with D1 + KV bindings, seeds test data, and exposes a
 * makeRequest() helper for sending HTTP requests through the
 * Hono app.
 *
 * Usage in test files:
 *   const ctx = await createTestContext();
 *   const res = await ctx.makeRequest('/health');
 *   expect(res.status).toBe(200);
 *   // cleanup when done
 *   await ctx.dispose();
 */

import { Miniflare } from 'miniflare';
import { getTestBindings } from './fixtures/test-env';
import {
  seedAll,
  createTestJWT,
  TEST_USER,
  TEST_ADMIN,
  TEST_API_KEY_RAW,
} from './fixtures/seed-data';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface TestContext {
  /** Miniflare instance */
  mf: Miniflare;
  /** D1 database binding */
  db: D1Database;
  /** KV namespace binding */
  kv: KVNamespace;
  /** Send a request through the Worker */
  makeRequest: (
    path: string,
    options?: RequestInit & { auth?: 'user' | 'admin' | 'apikey' | 'none' },
  ) => Promise<Response>;
  /** Pre-signed JWT for the test user */
  userToken: string;
  /** Pre-signed JWT for the admin user */
  adminToken: string;
  /** Raw API key for API key auth */
  apiKey: string;
  /** Tear down miniflare */
  dispose: () => Promise<void>;
}

// -------------------------------------------------------------------
// Context factory
// -------------------------------------------------------------------

/**
 * Create a fully initialized test context with miniflare,
 * D1 tables, KV namespace, seeded data, and request helper.
 */
export async function createTestContext(): Promise<TestContext> {
  const bindings = getTestBindings();

  const mf = new Miniflare({
    modules: true,
    script: '',
    d1Databases: { DB: 'test-db' },
    kvNamespaces: { KV: 'test-kv' },
    bindings,
    compatibilityDate: '2024-01-01',
  });

  // Get bindings from miniflare
  const db = await mf.getD1Database('DB');
  const kv = await mf.getKVNamespace('KV');

  // Seed D1 with test data
  await seedAll(db);

  // Pre-sign JWTs for convenience
  const userToken = await createTestJWT(
    TEST_USER.id,
    TEST_USER.email,
    TEST_USER.tier,
  );
  const adminToken = await createTestJWT(
    TEST_ADMIN.id,
    TEST_ADMIN.email,
    TEST_ADMIN.tier,
  );

  /**
   * Send a request through the Worker fetch handler.
   * Automatically adds auth headers based on the `auth` option.
   */
  async function makeRequest(
    path: string,
    options: RequestInit & { auth?: 'user' | 'admin' | 'apikey' | 'none' } = {},
  ): Promise<Response> {
    const { auth = 'user', ...init } = options;
    const url = `http://localhost${path.startsWith('/') ? path : `/${path}`}`;

    const headers = new Headers(init.headers);

    // Set default content type for bodies
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Inject auth header
    switch (auth) {
      case 'user':
        headers.set('Authorization', `Bearer ${userToken}`);
        break;
      case 'admin':
        headers.set('Authorization', `Bearer ${adminToken}`);
        break;
      case 'apikey':
        headers.set('X-API-Key', TEST_API_KEY_RAW);
        break;
      case 'none':
        // No auth
        break;
    }

    return mf.dispatchFetch(url, {
      ...init,
      headers,
    });
  }

  async function dispose(): Promise<void> {
    await mf.dispose();
  }

  return {
    mf,
    db,
    kv,
    makeRequest,
    userToken,
    adminToken,
    apiKey: TEST_API_KEY_RAW,
    dispose,
  };
}

// -------------------------------------------------------------------
// Reexports for convenience
// -------------------------------------------------------------------

export {
  TEST_USER,
  TEST_ADMIN,
  TEST_FREE_USER,
  TEST_TEAM,
  TEST_AGENT,
  TEST_CHAIN,
  TEST_API_KEY,
  TEST_API_KEY_RAW,
  createTestJWT,
  seedAll,
  createTables,
  seedUsers,
  seedAgents,
  seedChains,
  seedApiKeys,
} from './fixtures/seed-data';

export {
  getTestBindings,
  TEST_JWT_SECRET,
} from './fixtures/test-env';
