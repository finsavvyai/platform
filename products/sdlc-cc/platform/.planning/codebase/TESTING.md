# Testing Patterns

**Analysis Date:** 2026-04-22

## Test Framework

**Runner:**
- Vitest (root and package-level), configured via `vitest.config.mts`, `packages/shared-billing/vitest.config.mts`, `landing-page/vitest.config.ts`, and reusable presets in `packages/test-config/src/vitest-preset.ts`.
- Jest (multiple packages/apps), configured in `services/admin-ui/jest.config.js`, `packages/shared-auth/jest.config.js`, `packages/sdk-ts/jest.config.js`, `packages/shared-config/jest.config.js`, `packages/shared-analytics/jest.config.js`.
- Playwright for E2E/browser/integration flows, configured in `playwright.config.ts`, `tests/playwright.config.ts`, and `packages/shared-dashboard/playwright.config.ts`.
- Go uses stdlib `testing` with optional `testify` assertions (`services/gateway/cmd/server/main_test.go`, `services/gateway/internal/infrastructure/database/repository/repository_test.go`).
- Python uses `pytest` with `pytest-asyncio` and strict options from `services/dlp/pyproject.toml`.

**Assertion Library:**
- Jest/Vitest built-in `expect`.
- Go: stdlib checks (`t.Fatalf`) plus `github.com/stretchr/testify/assert` and `require`.
- Python: plain `assert` with pytest fixtures/markers.
- Node native test suites use `node:test` + `node:assert/strict` (`packages/insights-core/ts/tests/golden.test.ts`).

**Run Commands:**
```bash
npm test                          # Root Vitest run (test:root)
npm run test:e2e                 # Root Playwright suite
cd services/admin-ui && npm test # Jest in Next.js app
cd services/gateway && go test ./... # Go unit/integration tests
cd services/dlp && pytest        # Python pytest suite
```

## Test File Organization

**Location:**
- Co-located unit tests under `src/__tests__` are common (`packages/shared-auth/src/__tests__`, `services/admin-ui/src/__tests__`).
- Dedicated top-level `tests/` trees are used for cross-system/e2e validation (`tests/tests/e2e`, `tests/tests/api`, `tests/e2e`).
- Language-local test folders are used for service-level suites (`services/dlp/tests`, `services/rag/tests`, `services/gateway/.../*_test.go`).

**Naming:**
- TS/JS: `*.test.ts`, `*.spec.ts`, and `__tests__` directory patterns.
- Go: `_test.go`.
- Python: `test_*.py` and `*_test.py` (declared in `services/dlp/pyproject.toml`).

**Structure:**
```
packages/<pkg>/src/__tests__/*.test.ts
services/<svc>/src/__tests__/**/*.{test,spec}.{ts,tsx}
services/<svc>/tests/test_*.py
services/<svc>/**/*_test.go
tests/{e2e,api,database,performance}/**/*.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('SDLCAuth.getCurrentUser()', () => {
  it('returns the user when a session exists', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const user = await auth.getCurrentUser();
    expect(user?.id).toBe('user-1');
  });
});
```

**Patterns:**
- Shared setup in `beforeEach`/`afterEach` with mock reset (`packages/shared-auth/src/__tests__/auth-user.test.ts`, `packages/shared-auth/src/__tests__/setup.ts`).
- Timer-driven hook tests use fake timers + `act()` (`services/admin-ui/src/__tests__/hooks/use-debounce.test.ts`).
- Playwright specs gate env-dependent flows with `test.skip(...)` to keep CI resilient across environments (`tests/e2e/auth-flow.spec.ts`).
- Go tests use `t.Run` table-like subtest grouping (`services/gateway/internal/infrastructure/database/repository/repository_test.go`).
- Python tests group by feature sections and rely on fixtures (`services/dlp/tests/test_fast_pii_detector.py`).

## Mocking

**Framework:** Jest/Vitest mock APIs, pytest fixtures/monkeypatch, lightweight in-memory fakes for custom TS tests.

**Patterns:**
```typescript
jest.mock('jsonwebtoken', () => ({
  sign: (...args: any[]) => mockJwtSign(...args),
  verify: (...args: any[]) => mockJwtVerify(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter() { return { push: jest.fn(), replace: jest.fn() }; },
}));
```

**What to Mock:**
- Third-party network/auth/SDK boundaries (`jsonwebtoken`, Supabase, Next router/navigation, browser APIs) in `packages/shared-auth/src/__tests__/auth-user.test.ts` and `services/admin-ui/jest.setup.js`.
- Env-sensitive browser/auth flows in Playwright via skip guards, not brittle inline stubs (`tests/e2e/auth-flow.spec.ts`).
- Infrastructure seams via in-memory storage fakes where full harness is not required (`services/proxy-worker/src/rate-limiter.test.ts`).

**What NOT to Mock:**
- Core domain logic under test (validation, transformations, business rules).
- Golden test payloads in `packages/insights-core/ts/tests/golden.test.ts`; parse/contract behavior should run against real fixtures.

## Fixtures and Factories

**Test Data:**
```typescript
const baseProfile = {
  id: 'user-1',
  email: 'alice@example.com',
  tier: 'starter',
};
mockTableResult('user_profiles', { data: baseProfile, error: null });
```

**Location:**
- Jest manual mocks: `packages/shared-auth/src/__tests__/__mocks__/supabase.ts`.
- Global setup files: `services/admin-ui/jest.setup.js`, `landing-page/__tests__/setup.ts`, `packages/shared-auth/src/__tests__/setup.ts`.
- Python pytest collection controls in `services/dlp/tests/conftest.py`.
- JSON golden fixtures in `packages/insights-core/testdata`.

## Coverage

**Requirements:** Enforced per package, not globally uniform.
- 95% thresholds in reusable Vitest/Jest presets (`packages/test-config/src/vitest-preset.ts`, `packages/sdk-ts/jest.config.js`).
- 80% thresholds in some app packages (`services/admin-ui/jest.config.js`, `packages/shared-analytics/jest.config.js`).
- 85/90 hybrid thresholds in shared-auth (`packages/shared-auth/jest.config.js`).
- 100% thresholds in `packages/shared-config/jest.config.js`.

**View Coverage:**
```bash
vitest run --coverage
cd services/admin-ui && npm test -- --coverage
cd packages/shared-auth && npm test -- --coverage
```

## Test Types

**Unit Tests:**
- Primary approach across TS/JS, Go, and Python with direct module/service testing.
- Heavy use of deterministic fixtures and mocks for auth/hooks/util modules.

**Integration Tests:**
- Present in naming and folder patterns (`landing-page/__tests__/integration/*`, `tests/tests/database/*.spec.ts`, `services/rag/tests/test_rag_service_integration.py`).
- Go includes repository/domain integration-style tests but also placeholder-only tests in some files (`services/gateway/internal/infrastructure/database/repository/repository_test.go`).

**E2E Tests:**
- Playwright is the standard for browser/system E2E (`playwright.config.ts`, `tests/playwright.config.ts`, `tests/e2e/*.spec.ts`).

## Common Patterns

**Async Testing:**
```typescript
it('resolves for enterprise tier upgrade', async () => {
  await expect(auth.updateUserTier('user-1', 'enterprise')).resolves.toBeUndefined();
});
```

**Error Testing:**
```python
def test_disabled_returns_empty(disabled_detector):
    assert disabled_detector.detect("SSN: 123-45-6789") == []
```

---

*Testing analysis: 2026-04-22*
