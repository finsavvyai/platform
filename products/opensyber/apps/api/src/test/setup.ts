import { vi } from 'vitest';

/**
 * Global test setup — mocks the auth middleware module
 * to bypass native JWKS/crypto JWT verification in tests.
 *
 * The actual auth middleware at src/middleware/auth.ts does:
 *   1. Decode JWT (split on '.' and base64url decode)
 *   2. Fetch JWKS from https://api.clerk.com/v1/jwks
 *   3. Verify signature with crypto.subtle.verify
 *
 * This mock provides a pass-through middleware that just sets userId,
 * allowing route tests to focus on business logic.
 *
 * Note: src/middleware/auth.test.ts tests the real middleware and unmocks this.
 */
vi.mock('../middleware/auth.js', async () => {
  const { createMiddleware } = await vi.importActual('hono/factory');
  return {
    authMiddleware: createMiddleware(async (c: any, next: any) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
      }
      c.set('userId', 'user_test123');
      await next();
    }),
  };
});
