# Testing Production as a Real Customer

How to validate Qestro on the **live production site** the same way a real customer would use it.

---

## 1. Production URL

- **Product app:** https://qestro.app  
- **Marketing site:** https://qestro.io (if configured)

All flows below target **https://qestro.app** unless noted.

---

## 2. Manual testing (like a real customer)

### Option A: Use the demo account

If a demo account exists on production:

1. Open **https://qestro.app/login** in a browser.
2. Log in with the demo credentials (coordinate with your team for the current demo account; the E2E fixture uses `test@questro.io` / `testpassword123` only if that account is seeded in prod).
3. Walk through:
   - Dashboard
   - Create or open a project
   - Test Cases, Test Runs, Test Plans
   - Recording Studio / AI Recorder (if available)
   - Settings and sign out

### Option B: Register as a new customer

1. Open **https://qestro.app** (or `/register` if the app redirects there).
2. Complete **Sign up** with a real email you control.
3. Verify email if the product uses email verification.
4. Log in and go through the same flows as in Option A.

Use a dedicated test email (e.g. `yourname+prodtest@company.com`) so you can distinguish production test data.

---

## 3. Automated E2E tests against production

Playwright is configured to run against **https://qestro.app** when `PLAYWRIGHT_ENV=production`.

### Prerequisites

- Node 18+ and repo dependencies installed (`npm install`).
- Playwright browsers: `npx playwright install chromium`.

### Run all production E2E tests

```bash
# Headless (CI-friendly)
npm run test:e2e:prod

# With browser visible (easier to debug)
npm run test:e2e:prod:headed
```

These commands:

- Set `PLAYWRIGHT_ENV=production` so the base URL is **https://qestro.app**.
- Run only tests under `tests/e2e/production/` (login, register, dashboard, test cases, runs, plans, recording, API Studio, etc.).

### Override base URL

To hit a different environment (e.g. staging):

```bash
PLAYWRIGHT_ENV=production BASE_URL=https://staging.qestro.app npm run test:e2e:prod
```

### Run a single production flow

```bash
PLAYWRIGHT_ENV=production npx playwright test tests/e2e/production/auth/prod-login.spec.ts
PLAYWRIGHT_ENV=production npx playwright test tests/e2e/production/core/prod-dashboard.spec.ts
```

### Demo user used by production E2E

The production helpers and auth tests use the **demo user** from `tests/e2e/fixtures/test-users.ts`:

- **Email:** `test@questro.io`
- **Password:** `testpassword123`

For automated production tests to pass, this account must exist and be valid on the live site. If you use a different demo account, update `testUsers.demoUser` in that file or add a separate production-only user and use it in production specs.

---

## 4. Post-deploy verification

After a production deploy:

1. **Quick health check** (if you have a health endpoint):
   ```bash
   ./scripts/verify-deployment.sh
   ```
2. **Manual smoke:** Log in at https://qestro.app and click through Dashboard → one project → Test Cases / Runs.
3. **Automated smoke:** Run production E2E:
   ```bash
   npm run test:e2e:prod
   ```

---

## 5. Summary

| Goal                         | Action |
|-----------------------------|--------|
| Use production like a user   | Open https://qestro.app → Sign up or log in (demo or real account) → use the app. |
| Automated “real customer” flow | `npm run test:e2e:prod` or `npm run test:e2e:prod:headed`. |
| Different URL (e.g. staging) | `PLAYWRIGHT_ENV=production BASE_URL=<url> npm run test:e2e:prod`. |
| One flow (e.g. login only)   | `PLAYWRIGHT_ENV=production npx playwright test tests/e2e/production/auth/prod-login.spec.ts`. |

Ensure the demo user (`test@questro.io` / `testpassword123`) exists in production if you rely on the current E2E production suite.
