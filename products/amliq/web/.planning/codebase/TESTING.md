# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- Vitest 1.0.0
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like environment)

**Assertion Library:**
- @testing-library/jest-dom (6.1.0) - provides DOM matchers
- @testing-library/react (14.1.0) - React component testing utilities
- @testing-library/user-event (14.5.0) - user interaction simulation
- Vitest built-in `expect()` for assertions

**Run Commands:**
```bash
npm test              # Run all tests in watch mode
npm run test:ui       # Run tests with UI dashboard
npm run test:e2e      # Run Playwright e2e tests
npm run test:e2e:ui   # Run Playwright with interactive UI
npm run test:e2e:headed # Run Playwright in headed mode (visible browser)
```

## Test File Organization

**Location:**
- Unit/integration tests: Co-located with source files (`.test.tsx` or `.test.ts` suffix)
- Examples: `src/components/ui/Button.test.tsx`, `src/hooks/useApi.test.ts`
- E2E tests: Separate directory `e2e/` (e.g., `e2e/navigation.spec.ts`)
- Test utilities: `src/test/utils.tsx`, `src/test/setup.ts`

**Naming:**
- Test files: `{SourceFileName}.test.{tsx|ts}`
- E2E specs: `{feature}.spec.ts` (e.g., `navigation.spec.ts`)
- Test suites: Describe blocks match component/hook name

**Structure:**
```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx
│   └── alerts/
│       ├── AlertCard.tsx
│       └── AlertCard.test.tsx
├── hooks/
│   ├── useApi.ts
│   └── useApi.test.ts
├── test/
│   ├── setup.ts          # Global test setup (mocks, globals)
│   └── utils.tsx         # Custom render, mock factories
└── pages/
    ├── Dashboard.tsx
    └── Dashboard.test.tsx
e2e/
├── navigation.spec.ts
├── responsive.spec.ts
└── mocks.ts             # E2E mock helpers
```

## Test Structure

**Suite Organization:**
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })
})
```

**Patterns:**

*Setup/Teardown (module-level):*
```typescript
beforeEach(() => {
  vi.useFakeTimers()      // Enable fake timers for timing tests
})

afterEach(() => {
  vi.useRealTimers()      // Reset to real timers
  vi.clearAllMocks()      // Clear mocks between tests
})
```

*Setup/Teardown (describe-level):*
```typescript
describe('AISummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()    // Clear mocks before each test
  })
  // tests...
})
```

*Async assertion pattern:*
```typescript
it('fetches data successfully', async () => {
  const fetchFn = vi.fn().mockResolvedValue({ data: 'test' })
  const { result } = renderHook(() => useApi(fetchFn))

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.data).toEqual({ data: 'test' })
  expect(result.current.error).toBeNull()
})
```

## Mocking

**Framework:** Vitest's built-in `vi` mock function

**Patterns:**

*Mocking modules:*
```typescript
vi.mock('../../api/ai', () => ({
  fetchAlertSummary: vi.fn(),
}))

import { fetchAlertSummary } from '../../api/ai'
const mockFetchAlertSummary = vi.mocked(fetchAlertSummary)
```

*Mocking context:*
```typescript
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'john@example.com', role: 'admin', tenant_id: 't1' },
    loading: false,
    isAuthenticated: true,
  }),
}))
```

*Mocking return values:*
```typescript
mockFetchAlertSummary.mockResolvedValue({
  summary: 'High risk entity with sanctions match.',
  model: 'claude-sonnet-4-6',
})
```

*Mocking rejections:*
```typescript
mockFetchAlertSummary.mockRejectedValue(new Error('Service timeout'))
```

*Mocking async promises:*
```typescript
mockFetchAlertSummary.mockReturnValue(new Promise(() => {}))  // Never resolves
```

**What to Mock:**
- External API calls: `fetchAlertSummary()`, network requests
- Context providers: `AuthContext`, `useAuth`
- Child components: Not mocked; integration tests render full tree
- Module-level imports: Used for functions and services

**What NOT to Mock:**
- Built-in React hooks: Render actual `useState`, `useEffect`
- React Router components: Use `MemoryRouter` or `BrowserRouter` instead
- UI components: Render full component tree for integration testing
- Tailwind/CSS: Rendered as-is; tests check class names

## Fixtures and Factories

**Test Data:**
```typescript
// From src/test/utils.tsx
export function createMockAlert(overrides?: Partial<Alert>): Alert {
  return {
    id: 'alert-1',
    entity: createMockEntity(),
    screeningId: 'screening-1',
    matchedCount: 3,
    riskLevel: 'high',
    status: 'open',
    priority: 'critical',
    notes: 'Suspicious activity detected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidenceCount: 5,
    ...overrides,
  }
}

export function createMockEntity(overrides?: Partial<Entity>): Entity {
  return {
    id: 'entity-1',
    type: 'individual',
    name: {
      firstName: 'John',
      lastName: 'Doe',
      aliases: [],
    },
    identifiers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
```

**Usage in tests:**
```typescript
const alert = createMockAlert({
  entity: {
    id: 'ent1',
    type: 'company',
    name: { firstName: '', lastName: '', aliases: [] },
    // ... other overrides
  },
})
render(<AlertCard alert={alert} />)
```

**Location:**
- `src/test/utils.tsx` - Mock factories and custom render function
- Export alongside test utilities: `createMockAlert`, `createMockEntity`
- Import in test files: `import { createMockAlert } from '../../test/utils'`

## Custom Render Function

**Implementation (`src/test/utils.tsx`):**
```typescript
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <Router>{children}</Router>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
```

**Usage in component tests:**
```typescript
import { render, screen } from '../../test/utils'  // Custom render with Router

render(<Sidebar isOpen={true} onClose={vi.fn()} />)
// Component automatically wrapped in BrowserRouter
```

**Alternative for specific wrappers:**
```typescript
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

renderWithRouter(<Sidebar isOpen={true} onClose={vi.fn()} />)
```

## Global Test Setup

**File:** `src/test/setup.ts`

**Content:**
```typescript
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import '../i18n/config'

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver (for responsive/layout components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

**Config reference (`vitest.config.ts`):**
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
```

## Test Types

**Unit Tests:**
- Scope: Single component or hook in isolation
- Approach: Mock dependencies, test component behavior
- Example: `Button.test.tsx` tests Button rendering, click handling
- Pattern: Use `render()` for components, `renderHook()` for hooks

**Integration Tests:**
- Scope: Component with children, multiple hooks together
- Approach: Render full component tree, mock external APIs/context
- Example: `AlertCard.test.tsx` tests component with mock Alert data
- Pattern: Render component with real children, mock API calls

**E2E Tests (Playwright):**
- Framework: @playwright/test (1.58.2)
- Scope: Full user workflows across pages
- Config: `playwright.config.ts`
- Example: `navigation.spec.ts` tests sidebar navigation flow
- Pattern: Start browser, navigate, assert UI changes

## Common Patterns

**Async Testing:**
```typescript
// Using waitFor for async state updates
it('fetches data successfully', async () => {
  const fetchFn = vi.fn().mockResolvedValue({ data: 'test' })
  const { result } = renderHook(() => useApi(fetchFn))

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.data).toEqual({ data: 'test' })
})

// Using findBy for element queries (waits for appearance)
it('shows summary after generation', async () => {
  mockFetchAlertSummary.mockResolvedValue({ summary: 'Summary text.' })
  render(<AISummaryCard alert={createMockAlert()} />)

  await userEvent.click(screen.getByRole('button', { name: /generate/i }))
  expect(await screen.findByText('Summary text.')).toBeInTheDocument()
})
```

**Error Testing:**
```typescript
it('shows error message when generation fails', async () => {
  mockFetchAlertSummary.mockRejectedValue(new Error('Service timeout'))
  render(<AISummaryCard alert={createMockAlert()} />)

  await userEvent.click(screen.getByRole('button', { name: /generate summary/i }))

  expect(await screen.findByText('Service timeout')).toBeInTheDocument()
})
```

**Component Rerender Testing:**
```typescript
it('renders different risk level colors', () => {
  const { rerender } = render(<AlertCard alert={createMockAlert({ riskLevel: 'critical' })} />)
  expect(screen.getByText('Risk: critical')).toHaveClass('bg-red-50', 'text-red-700')

  rerender(<AlertCard alert={createMockAlert({ riskLevel: 'low' })} />)
  expect(screen.getByText('Risk: low')).toHaveClass('bg-emerald-50', 'text-emerald-700')
})
```

**Timer/Debounce Testing:**
```typescript
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('debounces value changes', () => {
  const { result, rerender } = renderHook(
    ({ value }) => useDebounce(value, 300),
    { initialProps: { value: 'first' } }
  )

  expect(result.current).toBe('first')

  rerender({ value: 'second' })
  expect(result.current).toBe('first')

  act(() => { vi.advanceTimersByTime(300) })
  expect(result.current).toBe('second')
})
```

**Hook Testing with Dependencies:**
```typescript
it('respects dependencies array', async () => {
  const fetchFn = vi.fn().mockResolvedValue({ id: 1 })
  const { rerender } = renderHook(
    ({ id }) => useApi(fetchFn, [id]),
    { initialProps: { id: 1 } }
  )

  await waitFor(() => {
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  rerender({ id: 1 })  // Same dep, no refetch
  expect(fetchFn).toHaveBeenCalledTimes(1)

  rerender({ id: 2 })  // New dep, refetch
  await waitFor(() => {
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
```

**User Interaction Testing:**
```typescript
it('calls onClick handler when clicked', async () => {
  const handler = vi.fn()
  const alert = createMockAlert()
  render(<AlertCard alert={alert} onClick={handler} />)
  
  await userEvent.click(screen.getByText(alert.entity.name.firstName + ' ' + alert.entity.name.lastName).closest('div')!)
  expect(handler).toHaveBeenCalledOnce()
})
```

## E2E Testing Patterns

**Setup and Auth (`e2e/auth-setup.ts`):**
```typescript
// Helper to set up authenticated state before E2E tests
export async function setupAuth(page: Page) {
  // Set auth tokens or navigate to login
}
```

**API Mocking in E2E (`e2e/navigation.spec.ts`):**
```typescript
test.beforeEach(async ({ page }) => {
  // Mock all API responses to avoid external dependencies
  await page.route('**/api/v1/**', route => {
    const url = route.request().url()
    if (url.includes('auth/me') || url.includes('analytics')) {
      return route.fallback()  // Use real response
    }
    if (url.includes('/quota')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { used: 0, limit: -1, remaining: 0 } }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    })
  })
})
```

**Device Testing (Playwright):**
```typescript
// From playwright.config.ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'mobile',
    use: {
      ...devices['iPhone 13'],
      browserName: 'chromium',
    },
  },
]

// Skip tests for mobile
test.skip(!!isMobile, 'Sidebar nav labels hidden on mobile')
```

## Coverage

**Requirements:** Not enforced at CI level (no coverage config detected in vitest.config.ts)

**Note:** CLAUDE.md specifies coverage targets (100% for critical paths, >=90% overall), but vitest config doesn't enforce coverage checks. Coverage reports generated locally only.

---

*Testing analysis: 2026-04-21*
