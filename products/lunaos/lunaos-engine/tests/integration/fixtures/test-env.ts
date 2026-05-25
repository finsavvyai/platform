/**
 * Test environment bindings for miniflare integration tests.
 *
 * Provides all required Env bindings that the Hono worker expects.
 * These are injected into miniflare when creating a test context.
 */

/** JWT secret used to sign and verify tokens in tests */
export const TEST_JWT_SECRET = 'test-jwt-secret-for-integration-tests';

/** LemonSqueezy test credentials */
export const TEST_LS_API_KEY = 'test-ls-api-key';
export const TEST_LS_STORE_ID = '214097';
export const TEST_LS_WEBHOOK_SECRET = 'test-ls-webhook-secret';
export const TEST_LS_VARIANT_PRO = 'test-variant-pro';
export const TEST_LS_VARIANT_TEAM = 'test-variant-team';

/** GitHub OAuth test credentials */
export const TEST_GITHUB_CLIENT_ID = 'test-github-client-id';
export const TEST_GITHUB_CLIENT_SECRET = 'test-github-client-secret';

/** OpenHands test endpoint */
export const TEST_OPENHANDS_API_URL = 'http://localhost:4000';
export const TEST_OPENHANDS_API_KEY = 'test-openhands-key';

/**
 * Complete environment bindings for the Worker.
 * D1 and KV are provided by miniflare and injected separately
 * in setup.ts via createTestContext().
 */
export function getTestBindings() {
  return {
    JWT_SECRET: TEST_JWT_SECRET,
    LEMONSQUEEZY_API_KEY: TEST_LS_API_KEY,
    LEMONSQUEEZY_STORE_ID: TEST_LS_STORE_ID,
    LEMONSQUEEZY_WEBHOOK_SECRET: TEST_LS_WEBHOOK_SECRET,
    LEMONSQUEEZY_VARIANT_PRO: TEST_LS_VARIANT_PRO,
    LEMONSQUEEZY_VARIANT_TEAM: TEST_LS_VARIANT_TEAM,
    GITHUB_CLIENT_ID: TEST_GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: TEST_GITHUB_CLIENT_SECRET,
    OPENHANDS_API_URL: TEST_OPENHANDS_API_URL,
    OPENHANDS_API_KEY: TEST_OPENHANDS_API_KEY,
    ENVIRONMENT: 'test',
  };
}
