# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Client-side React SPA (Single Page Application) with modular component-driven architecture and API-first data fetching pattern.

**Key Characteristics:**
- React 18 with TypeScript for type safety and component composition
- Client-side routing via React Router v6 with lazy-loaded pages
- Context API for global state management (auth, theme)
- Custom hooks for data fetching and business logic
- Feature-based component organization with shared UI component library
- Vite for fast development and optimized production builds

## Layers

**Presentation Layer (Pages & Components):**
- Purpose: User interface rendering and user interaction handling
- Location: `src/pages/` (65+ page components) and `src/components/` (27+ component categories)
- Contains: Feature pages, layout components, feature-specific components, reusable UI components
- Depends on: Hooks, Context, API layer
- Used by: Router (via lazy loading in `src/routes/`)

**Container/Smart Components:**
- Purpose: Manage data fetching, state, and logic for feature areas
- Examples: `src/pages/Dashboard.tsx`, `src/pages/ScreenEntity.tsx`, `src/pages/Monitoring.tsx`
- Pattern: Import hooks for data, compose UI from smaller components, handle loading/error states

**Presentational/Dumb Components:**
- Purpose: Render UI without business logic, accept data via props
- Examples: `src/components/ui/` (Button, Card, Badge, Avatar, etc.), `src/components/charts/`, `src/components/data/`
- Pattern: Pure functions, no hooks except styling/animation, fully testable

**Hooks Layer (Business Logic):**
- Purpose: Encapsulate data fetching, state management, and reusable logic
- Location: `src/hooks/` (22 custom hooks)
- Contains: Data fetching (`useApi`), domain-specific hooks (`useScreening`, `useAlerts`, `useConfig`, `useLists`), UI hooks (`useMediaQuery`, `useDirection`, `useSidebar`)
- Pattern: Generic utility hooks (e.g., `useApi<T>`) and domain-specific hooks that compose base hooks
- Example:
  ```typescript
  // Base utility hook
  export function useApi<T>(fetchFn: () => Promise<T>, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    // ... implementation
    return { data, loading, error, refetch };
  }

  // Domain-specific hook wrapping it
  export function useScreening() {
    const screeningApi = /* ... */
    return useApi(() => screeningApi.list(), [])
  }
  ```

**API Layer:**
- Purpose: Centralized HTTP client and API endpoint definitions
- Location: `src/api/` (18 domain-specific API modules)
- Contains: Domain-organized API methods (auth, screening, monitoring, alerts, cases, etc.), base client with request/response handling
- Pattern: Feature-based API modules exporting typed functions
- Base client: `src/api/client.ts` provides `fetchApi<T>()` and `api` helper object
  ```typescript
  const api = {
    get: <T,>(ep: string) => fetchApi<T>(ep),
    post: <T,>(ep: string, body: unknown) => fetchApi<T>(ep, { method: 'POST', body: JSON.stringify(body) }),
    put: <T,>(ep: string, body: unknown) => fetchApi<T>(ep, { method: 'PUT', body: JSON.stringify(body) }),
    del: <T,>(ep: string) => fetchApi<T>(ep, { method: 'DELETE' }),
  }
  ```
- Error Handling: Throws `ApiError` class with code, message, and status; auto-logout on 401 unauthorized
- Auth: Reads token from localStorage, includes Bearer token in Authorization header

**Context Layer (Global State):**
- Purpose: Provide global state without prop drilling
- Location: `src/context/`
- Contexts:
  - `src/context/AuthContext.tsx`: User authentication, login/logout, token management
  - `src/context/ThemeContext.tsx`: Theme preference (light/dark/midnight), persists to localStorage
- Pattern: Provider component wraps app, hook exports context values
- Used by: `src/App.tsx` wraps entire app with both contexts

**Router Layer:**
- Purpose: Map URL paths to page components and apply layout wrappers
- Location: `src/routes/` (route definitions) and lazy loading in `src/routes/lazyPages.ts`
- Pattern: Factory functions return React Router Route elements; pages are lazy-loaded for code splitting
- Wrapper Pattern: ProtectedRoute component enforces auth, AppShell applies dashboard layout
  ```typescript
  // From App.tsx
  const P = ({ children }: { children: React.ReactNode }) => (
    <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>
  )
  // Usage in appRoutes: <Route path="/dashboard" element={<P><Dashboard /></P>} />
  ```

**Types Layer:**
- Purpose: Centralized TypeScript interfaces and types
- Location: `src/types/` (domain-specific type modules)
- Contains: API response types, domain models, shared interfaces
- Pattern: Domain-organized modules re-exported through `src/types/index.ts`
- Examples: `src/types/alert.ts`, `src/types/screening.ts`, `src/types/entity.ts`, `src/types/common.ts`

**Layout Components:**
- Purpose: Structure authenticated dashboard experience
- Location: `src/components/layout/`
- Key components:
  - `AppShell.tsx`: Main dashboard container with responsive sidebar, toolbar, breadcrumbs
  - `Sidebar.tsx`: Responsive navigation using navItems
  - `Toolbar.tsx`: Top bar with menu toggle, theme switcher, user menu
  - `ProtectedRoute.tsx`: Auth guard wrapper
  - `PublicLayout.tsx`: Marketing site layout wrapper

## Data Flow

**Page Initialization Flow:**

1. User navigates to protected route (e.g., `/dashboard`)
2. Router matches path and renders lazy-loaded page component
3. Page component mounts inside `<P>` wrapper → ProtectedRoute checks auth via useAuth() hook
4. ProtectedRoute verifies user exists, redirects to login if not
5. AppShell renders layout (Sidebar, Toolbar, Breadcrumbs)
6. Page component executes custom hooks (e.g., `useAnalytics()`)
7. Hooks call API methods via `api.get()`, `api.post()`, etc.
8. API client adds auth token from localStorage, sends HTTP request
9. Response decoded, data returned to hook state
10. Page renders with data, loading spinner during fetch, error state if needed

**Authentication Flow:**

1. User submits login form on `src/pages/Login.tsx`
2. Form calls `authApi.login()` → POST `/api/v1/auth/login`
3. API returns `{ token, user }`
4. AuthContext's `login()` callback stores token in localStorage, updates user state
5. App.tsx detects user state change, renders authenticated pages
6. Protected routes allow access; unprotected routes show Unauthorized

**State Management:**

- **Global (Context)**: Auth user, theme preference
- **Component Local**: Form inputs, UI toggles, loading/error states
- **Custom Hook**: Derived state from API responses (useApi returns { data, loading, error })
- **No Redux**: Simple context + hooks sufficient for current complexity

**Error Handling:**

1. `fetchApi()` in client.ts checks response status
2. On 401: clears token, redirects to login
3. On other errors: throws ApiError with code, message, status
4. Components catch errors, display via toast or fallback UI
5. Error boundaries in ErrorBoundary.tsx catch React render errors

## Key Abstractions

**useApi<T> Hook:**
- Purpose: Generic data fetching with automatic loading/error state management
- Pattern: Accepts async function and dependency array, returns { data, loading, error, refetch }
- Used by: All custom domain hooks (useScreening, useAlerts, useConfig, etc.)
- Ensures: Mounted check prevents state updates on unmounted components, consistent error handling

**ApiError Class:**
- Purpose: Typed error with code, message, and HTTP status
- Thrown by: fetchApi() when response not ok
- Contains: `code` (string), `message` (string), `status` (number)
- Enables: Differentiated error handling (401 vs 500 vs validation errors)

**ProtectedRoute Wrapper:**
- Purpose: Enforce authentication on routes
- Pattern: Checks useAuth().isAuthenticated, redirects to /login if false
- Used on: All dashboard, admin, and sensitive routes

**AppShell Layout:**
- Purpose: Consistent dashboard container with responsive layout
- Contains: Sidebar, Toolbar, Breadcrumbs, main content area
- Features: Touch-based sidebar toggle, responsive grid layout, skip-to-main accessibility link

**Theme Context:**
- Purpose: Unified theme switching across app
- Persists: Theme choice to localStorage
- CSS Variable Integration: Sets `data-theme` attribute and CSS classes for styling
- Themes: light, dark, midnight

**Lazy Loading via lazyPages.ts:**
- Purpose: Code-splitting for reduced initial bundle size
- Pattern: Each page imported with `.then(m => ({ default: m.ComponentName }))`
- Effect: Pages only loaded when route matches, improves LCP and TTI metrics

## Entry Points

**main.tsx:**
- Location: `src/main.tsx`
- Triggers: Application startup by index.html
- Responsibilities: 
  - Mount React app to DOM root
  - Initialize i18n for internationalization
  - Register service worker for offline support
  - Set up web vitals tracking (LCP, CLS, INP)
  - Report metrics to `/api/v1/analytics/vitals` endpoint in production

**App.tsx:**
- Location: `src/App.tsx`
- Triggers: React root render
- Responsibilities:
  - Wrap app with Context providers (ThemeProvider, AuthProvider, ToastProvider)
  - Render Router with all route definitions
  - Display global error boundary
  - Manage keyboard shortcuts modal

**appRoutes.tsx:**
- Location: `src/routes/appRoutes.tsx`
- Purpose: Define all authenticated and public routes
- Pattern: Factory function takes wrapper components (P for protected, PublicLayout for public)
- Returns: Array of Route elements to render in Router

## Cross-Cutting Concerns

**Logging:** Primarily `console.debug()` for development, web vitals metrics in production

**Validation:** Handled server-side; client validates form inputs before submission

**Authentication:** 
- Token stored in localStorage key `amliq_token`
- Every API request includes Authorization header: `Bearer {token}`
- Automatic logout on 401 response

**Internationalization:**
- i18next library with language detector
- Translation files in `src/i18n/` directory
- Used via `useTranslation()` hook in components
- RTL support via `useDirection()` hook

**Styling:**
- Tailwind CSS for utility-based styling
- CSS variables for theming: `--dash-bg`, `--dash-text`, `--accent-gold`, etc.
- Motion via Framer Motion for smooth animations

**Error Boundaries:**
- Component: `src/components/ui/ErrorBoundary.tsx`
- Wraps entire app in App.tsx
- Catches render errors and displays fallback UI

**Loading States:**
- Generic PageLoader for route transitions
- Component-level loading spinners during data fetch
- DashboardSkeleton for dashboard-specific loading state

**Responsive Design:**
- Mobile-first approach with Tailwind breakpoints (sm, md, lg)
- Touch gestures for sidebar toggle (swipe left/right)
- Media query hook: `useMediaQuery()` for conditional rendering

---

*Architecture analysis: 2026-04-21*
