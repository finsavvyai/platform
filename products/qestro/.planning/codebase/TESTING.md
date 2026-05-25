# Testing Patterns

**Analysis Date:** 2026-04-22

## Test Framework

**Runner:**
- Jest (backend, mobile, docs, many integration suites) via `jest.config.js`, `backend/jest.config.js`, `mobile/jest.config.js`, `tests/documentation/jest.config.js`
- Vitest (frontend and workers) via `frontend/vitest.config.ts` and `vitest.config.ts`
- Playwright (E2E) via `playwright.config.ts`

**Assertion Library:**
- Jest `expect` matchers for Jest suites (`tests/backend/__tests__/services/AIService.test.ts`, `mobile/src/__tests__/components/molecules/ConfirmDialog.test.ts`)
- Vitest `expect` (+ Testing Library matchers where configured) (`frontend/src/components/auth/__tests__/ProtectedRoute.test.tsx`, `tests/frontend/setup.ts`)
- Playwright `expect` for E2E assertions (`tests/e2e/auth/01-login.spec.ts`)

**Run Commands:**
```bash
npm run test                    # Run full multi-app test matrix
npm run test:coverage           # Run coverage-focused matrix
npm run test:e2e                # Run Playwright E2E suites
```

## Test File Organization

**Location:**
- Centralized top-level suites under `tests/` by concern (`tests/backend`, `tests/frontend`, `tests/integration`, `tests/e2e`, `tests/security`, `tests/performance`, `tests/documentation`).
- Co-located tests in app packages (`frontend/src/components/auth/__tests__/ProtectedRoute.test.tsx`, `backend/src/services/audit/AuditLogger.test.ts`, `mobile/src/__tests__/...`).

**Naming:**
- Unit/integration: `*.test.ts`, `*.test.tsx`, sometimes `*.integration.test.ts`.
- E2E: `*.spec.ts` in `tests/e2e/` and `tests/playwright/`.
- Directory-level grouping by domain is common (`tests/e2e/auth/`, `tests/backend/__tests__/services/`, `mobile/src/__tests__/lib/api/`).

**Structure:**
```
tests/
├── backend/__tests__/...
├── frontend/__tests__/...
├── integration/...
├── e2e/**.spec.ts
├── security/unit/...
└── performance/...
```

## Test Structure

**Suite Organization:**
```typescript
describe('ProtectedRoute', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('redirects to login when not authenticated', async () => {
    setupState({ isAuthenticated: false });
    await renderRoute();
    expect(screen.getByTestId('login')).toBeTruthy();
  });
});
```

**Patterns:**
- Setup/teardown hooks at suite scope (`beforeEach`, `afterEach`, `beforeAll`) are standard across Jest/Vitest.
- Assertions favor behavior/state outcomes over snapshots in most files (`tests/backend/__tests__/services/AIService.test.ts`, `tests/e2e/auth/01-login.spec.ts`).
- E2E suites often include `beforeEach` page-object initialization and helper wiring (`tests/e2e/auth/01-login.spec.ts`).

## Mocking

**Framework:** `jest.mock` (Jest) and `vi.mock` (Vitest).

**Patterns:**
```typescript
// Jest module mocking pattern
const mockExecuteWithFailover = jest.fn();
jest.mock('../../../../backend/src/services/AIProviderClient.js', () => ({
  aiProviderClient: { executeWithFailover: mockExecuteWithFailover },
}));

// Vitest module mocking pattern
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => mockState,
}));
```

**What to Mock:**
- External APIs/providers and adapters (`AIProviderClient`, cache/subscription services in `tests/backend/__tests__/services/AIService.test.ts`).
- Browser/native/platform dependencies (`tests/frontend/setup.ts`, `mobile/jest.setup.js`).
- UI-heavy third-party libs where behavior under test is local (`framer-motion`, icons in `tests/frontend/setup.ts`).

**What NOT to Mock:**
- Core unit behavior of the module under test (service logic in backend unit tests, component conditional rendering in UI tests).
- E2E user flows generally avoid internal mocks except controlled API routes for deterministic behavior (`tests/e2e/auth/01-login.spec.ts`).

## Fixtures and Factories

**Test Data:**
```typescript
export const testUsers: Record<string, TestUser> = {
  demoUser: { email: 'test@questro.io', password: 'testpassword123', role: 'admin', firstName: 'Demo', lastName: 'User' },
};

export function generateRandomUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return { email: `test.${timestamp}.${random}@questro.test`, password: `Test${timestamp}!@#`, firstName: 'Test', lastName: `User${random}`, role: 'user', subscription: 'free' };
}
```

**Location:**
- E2E fixtures/helpers: `tests/e2e/fixtures/` and `tests/e2e/utils/`.
- Global setup hooks: `tests/backend/__tests__/setup.ts`, `tests/backend/__tests__/globalSetup.ts`, `src/test/setup.ts`, `frontend/src/test/setup.ts`, `mobile/jest.setup.js`.

## Coverage

**Requirements:** Mixed and framework-specific.
- Root Jest config enforces global 80% in `jest.config.js`.
- Root workers Vitest config enforces 80% global thresholds in `vitest.config.ts`.
- Mobile Jest config enforces 75/65/75/75 global thresholds in `mobile/jest.config.js`.
- Backend Jest config currently sets thresholds to 0 in `backend/jest.config.js` (with many ignored tests), while `nyc.config.js` and `coverage.config.js` define higher aspirational gates.

**View Coverage:**
```bash
npm run test:coverage
npm --prefix backend run test:coverage
npm --prefix frontend run test:coverage
```

## Test Types

**Unit Tests:**
- Service/component/store-level validation with heavy dependency mocking (`tests/backend/__tests__/services/*.test.ts`, `frontend/src/components/auth/__tests__/ProtectedRoute.test.tsx`, `mobile/src/__tests__/components/**/*.test.tsx`).

**Integration Tests:**
- Cross-module and environment flows under `tests/integration/` and backend integration folders (`tests/backend/__tests__/integration/*.test.ts`, `tests/integration/sso-api.integration.test.ts`).

**E2E Tests:**
- Playwright-based, page-object-driven flows in `tests/e2e/**/*.spec.ts` with environment-aware config in `playwright.config.ts`.

## Common Patterns

**Async Testing:**
```typescript
it('should return cached response when available', async () => {
  mockCacheGet.mockResolvedValue(cached);
  const result = await service.processAIRequest(makeRequest());
  expect(result).toEqual(cached);
});
```

**Error Testing:**
```typescript
it('should return success false when dispatch throws an error', async () => {
  mockExecuteWithFailover.mockRejectedValue(new Error('Provider unavailable'));
  const result = await service.processAIRequest(makeRequest());
  expect(result.success).toBe(false);
  expect(result.result).toEqual({ error: 'Provider unavailable' });
});
```

---

*Testing analysis: 2026-04-22*
