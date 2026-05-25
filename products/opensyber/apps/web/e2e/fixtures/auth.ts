import { test as base } from '@playwright/test';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Auth fixture for authenticated E2E tests.
 *
 * Setup instructions:
 * 1. Create a test user in Clerk (e.g., e2e-test@opensyber.cloud)
 * 2. Run: npx playwright test --project=setup
 * 3. This saves auth state to e2e/.auth/user.json
 * 4. All tests using `authTest` reuse that state
 *
 * To generate the auth state manually:
 *   CLERK_E2E_EMAIL=... CLERK_E2E_PASSWORD=... npx playwright test e2e/auth-setup.spec.ts
 *
 * When auth state is missing, tests skip gracefully instead of crashing.
 */
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'user.json');
const hasAuth = existsSync(AUTH_FILE);

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Playwright fixture type requires {}
export const authTest = base.extend<{}>({
  storageState: [async ({}, use, testInfo) => {
    if (!hasAuth) {
      testInfo.skip(true, 'Auth state missing — run: CLERK_E2E_EMAIL=... CLERK_E2E_PASSWORD=... npx playwright test --project=setup');
    }
    await use(hasAuth ? AUTH_FILE : undefined);
  }, { scope: 'test' }],
});

export { expect } from '@playwright/test';
