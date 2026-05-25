# Testing Patterns

**Analysis Date:** 2026-05-23

## Test Framework

**Frontend Runner:**
- Framework: Vitest 3.2.1
- Environment: jsdom (browser-like environment for unit tests)
- Config file: `vitest.config.ts`
- Assertion library: Vitest built-in + @testing-library/jest-dom matchers

**Assertion Library:**
- React Testing Library 16.3.0 (`@testing-library/react`)
- Jest DOM matchers via `@testing-library/jest-dom` 6.9.1
- User interaction helpers via `@testing-library/user-event` 14.6.1

**E2E Testing:**
- Framework: Playwright 1.57.0 (Chromium only)
- Config file: `playwright.config.ts`
- Base URL: `http://localhost:5198` (local dev server)

**Run Commands:**

```bash
# Frontend unit tests
npm run test                    # Run all tests once
npm run test:watch            # Watch mode (re-run on file change)
npm run test:coverage         # Run with coverage report (v8 provider)
npm run test:ci               # CI mode: coverage + verbose reporter

# E2E tests
npm run test:e2e              # Headless Playwright tests
npm run test:e2e:ui           # Interactive Playwright UI mode

# All tests together
npm run test:all              # Runs test:coverage then test:e2e
```

## Test File Organization

**Location:**
- Unit tests: Co-located with source files (same directory)
- Pattern: `src/**/*.{test,spec}.{ts,tsx}`

**Naming:**
- Test files: `.test.tsx` for React components, `.test.ts` for utilities/hooks
- Alternative: `.spec.ts` for Playwright E2E tests
- Examples:
  - `src/App.test.tsx` — Component test
  - `src/stores/connectionStore.test.ts` — Store/hook test
  - `e2e/app.spec.ts` — E2E test

**Structure — Unit Tests:**

```
src/
├── App.tsx
├── App.test.tsx
├── stores/
│   ├── connectionStore.ts
│   ├── connectionStore.test.ts
│   ├── connectionStore-status.test.ts
│   ├── queryStore.ts
│   └── queryStore.test.ts
├── hooks/
│   ├── useConnections.ts
│   └── useConnections.test.ts
├── types/
│   ├── api.ts
│   └── api.test.ts
└── contracts/
    ├── vibecoding.ts
    └── vibecoding.test.ts
```

**Structure — E2E Tests:**

```
e2e/
├── app.spec.ts                    # Basic app load tests
├── comprehensive-ux.spec.ts       # Full user journey tests
├── tests/
│   └── sync-workflow.spec.ts
└── api/
    └── smart-query.spec.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

describe('ConnectionStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useConnectionStore.setState({
      connections: [],
      activeConnectionId: null,
    });
  });

  describe('setConnections', () => {
    it('should replace the connections array', () => {
      const connections = [makeConnection({ id: 'conn-1' })];
      useConnectionStore.getState().setConnections(connections);
      expect(useConnectionStore.getState().connections).toHaveLength(1);
    });

    it('should clear connections when given an empty array', () => {
      useConnectionStore.getState().setConnections([makeConnection()]);
      useConnectionStore.getState().setConnections([]);
      expect(useConnectionStore.getState().connections).toEqual([]);
    });
  });
});
```

**Patterns:**

1. **Setup/Teardown:**
   - `beforeEach()` resets store state or mocks before each test
   - `vitest.mock()` hoisted with `vi.hoisted(() => {...})` for test fixtures
   - No afterEach cleanup needed for Zustand (state reset via `setState()`)

2. **Mocking:**
   ```typescript
   const { mockApi, mockStore } = vi.hoisted(() => ({
     mockApi: {
       connections: {
         getAll: vi.fn(),
         create: vi.fn(),
       },
     },
   }));

   vi.mock('../services/api', () => ({ api: mockApi }));
   ```

3. **Assertions:**
   - React Testing Library: `expect(screen.getByRole('link')).toBeInTheDocument()`
   - Store tests: `expect(state.connections).toEqual([])`, `expect(state.connections).toHaveLength(1)`
   - Async: `await waitFor(() => { expect(...).toBeDefined() })`

## Mocking

**Framework:** Vitest `vi` object (Vitest built-in mocking)

**Patterns:**

```typescript
// Mock service
vi.mock('../services/api', () => ({
  authAPI: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    logout: vi.fn(),
  },
}));

// Mock Zustand store
vi.mock('../stores/connectionStore', () => ({
  useConnectionStore: vi.fn((selector) => (
    selector ? selector(mockStore) : mockStore
  )),
}));

// Mock module at runtime
const mockApi = vi.mocked(api);
mockApi.connections.getAll.mockResolvedValue([]);
```

**What to Mock:**
- External services (API calls, authentication)
- Zustand stores (when testing components that depend on them)
- Browser APIs with no jsdom support (but jsdom provides good coverage)

**What NOT to Mock:**
- React components from @testing-library (render/screen utilities)
- Zustand store actions in store tests themselves (test actual implementation)
- Type definitions or constants

## Fixtures and Factories

**Test Data:**

```typescript
// Factory function pattern in tests
const makeConnection = (overrides: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  id: 'conn-1',
  name: 'Test DB',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
  ssl: false,
  ...overrides,
});

// Usage in tests
const conn = makeConnection({ id: 'conn-2', name: 'Second DB' });
```

**Location:**
- Inline in test file for simple fixtures (seen in `connectionStore.test.ts`)
- Separate `fixtures/` directory for shared test data (mentioned in `e2e/fixtures/`)

**React Query Test Wrapper:**

```typescript
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Usage with renderHook
const { result } = renderHook(() => useConnections(), { wrapper: createWrapper() });
```

## Setup Files

**Location:** `src/setupTests.ts`

**Purpose:** Global test configuration and polyfills

**Contents:**

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia (for media queries)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
} as unknown as typeof IntersectionObserver;
```

**Configured in vitest.config.ts:**
```typescript
setupFiles: ['./src/setupTests.ts']
```

## Coverage

**Requirements:** Enforced via vitest.config.ts thresholds

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov', 'html', 'json-summary'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'src/**/*.d.ts',
    'src/**/*.test.{ts,tsx}',
    'src/**/*.spec.{ts,tsx}',
    'src/main.tsx',
    'src/vite-env.d.ts',
    'src/api/**',
  ],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

**Current Target:** 80% minimum (per config)
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

**CLAUDE.md Target:** 90% line, 85% branch, 100% critical paths
- More stringent than current vitest config (indicates target for improvement)

**View Coverage:**

```bash
npm run test:coverage      # Generate and display coverage report
# Opens lcov HTML report in build/coverage/index.html
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, hooks, stores, components in isolation
- Approach: Mock external dependencies, test behavior with different inputs
- Examples:
  - `connectionStore.test.ts`: Store actions (setConnections, addConnection, removeConnection)
  - `useConnections.test.ts`: Hook behavior with mocked API and store
  - `api.test.ts`: Type validation (Zod schema tests)

**Integration Tests:**
- Scope: Multiple components/services working together
- Approach: Real Zustand store + mocked API calls
- Example: Component renders, selects connection, updates store
- Not explicitly separated from unit tests; sometimes done in component tests

**E2E Tests:**
- Framework: Playwright
- Scope: Full user workflows end-to-end
- Approach: Real browser, real frontend, mocked backend (localStorage tokens)
- Examples in `e2e/`:
  - Authentication flow
  - Navigation between pages
  - Dashboard interactions
  - Connection management
  - Query editor operations

**Critical E2E Flows (from CLAUDE.md):**

1. **New User Onboarding** (`e2e/comprehensive-ux.spec.ts` covers basic flows)
2. **Database Connection Setup** (test PostgreSQL form, connection validation)
3. **Multi-Tab Query Editor** (tab creation, execution, results, export)
4. **Natural Language to SQL** (NL input, SQL generation, confidence badge)
5. **Voice Assistant Command** (microphone permission, transcript, execution)
6. **Data Masking** (PII detection, mask type selection)
7. **Team Collaboration** (invite flow, RBAC, activity audit)
8. **Billing & Feature Gates** (paywall modal, trial state)
9. **Monitoring Dashboard** (metrics display, alert panel)
10. **Mobile Responsiveness** (iPhone 12, 375px viewport, touch interactions)

## Common Patterns

**Async Testing:**

```typescript
// React Testing Library with waitFor
it('should show Dashboard heading by default', async () => {
  render(<App />);
  await waitFor(() => {
    const headings = screen.getAllByRole('heading', { name: /Dashboard/i });
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });
});

// Hook with async operation
const { result } = renderHook(() => useConnections());
await waitFor(() => {
  expect(result.current.isLoading).toBe(false);
});
expect(result.current.data).toEqual([...]);
```

**Error Testing:**

```typescript
// Test error state
it('should handle error in useConnections', async () => {
  mockApi.connections.getAll.mockRejectedValue(new Error('API failed'));
  const { result } = renderHook(() => useConnections(), { wrapper: createWrapper() });
  
  await waitFor(() => {
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('API failed');
  });
});

// Service error handling
it('should throw error when query not found', async () => {
  const service = new QueryService();
  await expect(service.getById('missing')).rejects.toThrow('Query not found: missing');
});
```

**E2E Authentication Pattern:**

```typescript
async function authenticate(page: Page) {
  await page.goto('http://localhost:5198');
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'e2e-test-token');
    localStorage.setItem('refresh_token', 'e2e-test-refresh');
  });
  await page.goto('http://localhost:5198');
  await page.waitForLoadState('domcontentloaded');
}

test.describe('QueryFlux Application', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('should load the application', async ({ page }) => {
    await expect(page).toHaveTitle(/QueryFlux/);
  });
});
```

**E2E Interaction Pattern:**

```typescript
test('should navigate to connections page', async ({ page }) => {
  await page.click('text=Connections');
  await page.waitForURL(/connections/, { timeout: 5000 });
  expect(page.url()).toContain('/connections');
  await expect(page.locator('h1:has-text("Database Connections")')).toBeVisible();
});
```

## CI/Test Configuration

**Playwright Config (`playwright.config.ts`):**
- Browser: Chromium only (Desktop Chrome)
- Parallel execution: Disabled (`workers: 1`)
- Retries: 2 in CI, 0 locally
- Test timeout: 30 seconds per test
- Action timeout: 15 seconds per interaction
- Video/screenshot: Recorded on first retry only
- Trace: Captured on first retry for debugging

**Vitest Config (`vitest.config.ts`):**
- Environment: jsdom
- Globals enabled: `true` (describe, it, expect available without imports)
- CSS modules: Non-scoped strategy
- Coverage: v8 provider with 80% thresholds

---

*Testing analysis: 2026-05-23*
