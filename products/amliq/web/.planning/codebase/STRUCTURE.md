# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```
amliq-frontend/
├── public/               # Static assets, favicon, manifest, icons, images
├── src/
│   ├── api/              # API client and domain-specific endpoint definitions (18 modules)
│   ├── assets/           # Images and other binary assets used in components
│   ├── components/       # Reusable and feature-specific React components (27 categories)
│   ├── context/          # Global state providers (Auth, Theme)
│   ├── data/             # Static data files (PEP profiles, risk countries)
│   ├── hooks/            # Custom React hooks (22 hooks)
│   ├── i18n/             # Internationalization config and translation keys
│   ├── pages/            # Page components for routes (65+ pages)
│   ├── routes/           # Route definitions and lazy loading
│   ├── styles/           # Global CSS and Tailwind configuration
│   ├── test/             # Test utilities and mocks
│   ├── types/            # TypeScript type definitions (domain-organized)
│   ├── App.tsx           # Root component with providers
│   ├── main.tsx          # Application entry point
│   ├── index.css         # Global styles
│   └── vite-env.d.ts     # Vite environment types
├── .eslintrc             # ESLint configuration
├── .prettierrc            # Prettier formatting config (if present)
├── vite.config.ts        # Vite build configuration
├── vitest.config.ts      # Vitest test runner configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── index.html            # HTML template

```

## Directory Purposes

**src/api/**
- Purpose: All HTTP requests to backend API via typed, domain-specific modules
- Contains: 18 TypeScript modules exporting `const apiName = { method: () => ... }`
- Key files:
  - `client.ts` (56 lines): Base `fetchApi()` function, `api` helper object, `ApiError` class
  - `auth.ts`: Login, signup, me endpoint
  - `monitoring.ts` (82 lines): Monitor profiles, alerts, dashboard
  - `screening.ts`: Entity screening endpoints
  - `cases.ts`: Case management
  - `alerts.ts`: Alert queue and filtering
  - Plus: billing, config, audit, team, lists, pep, risk, edd, enforcement, transactions, analytics, ai

**src/components/**
- Purpose: UI building blocks organized by feature domain
- Contains: 27+ feature-specific directories plus `ui/` for shared components
- Key subdirectories:
  - `layout/` (18 files): AppShell, Sidebar, Toolbar, Breadcrumbs, ProtectedRoute, PublicLayout
  - `ui/` (35+ files): Reusable components (Button, Card, Badge, Avatar, LoadingSpinner, ErrorBoundary, Toast, Modal, etc.)
  - Feature domains: `dashboard/`, `alerts/`, `screening/`, `monitoring/`, `cases/`, `admin/`, `auth/`, `team/`, `config/`, `lists/`, `compliance/`, `reporting/`, `webhooks/`, `apikeys/`, `charts/`, `data/`, `batch/`, `tasks/`, `automation/`, `brand/`, `ubo/`, `transactions/`, `platform/`
- Pattern: Each feature directory contains domain-specific components (e.g., `AlertQueue.tsx`, `AlertDetailCard.tsx` in alerts)

**src/context/**
- Purpose: Global state management via React Context
- Files:
  - `AuthContext.tsx`: User auth state, login/logout/signup methods
  - `ThemeContext.tsx`: Theme selection (light/dark/midnight) with localStorage persistence

**src/hooks/**
- Purpose: Reusable logic extracted from components
- Contains: 22 custom hooks organized by type
- Utility hooks: `useApi.ts`, `useDebounce.ts`, `useMediaQuery.ts`, `useSidebar.ts`
- Domain hooks: `useScreening.ts`, `useAlerts.ts`, `useConfig.ts`, `useLists.ts`, `useMonitoring.ts`, `useAnalytics.ts`, `useBilling.ts`, `useAudit.ts`
- UI hooks: `useDirection.ts` (RTL support), `useKeyboardShortcuts.ts`, `useAnalytics.ts`
- Pattern: Generic hooks (useApi) composed by domain-specific hooks

**src/pages/**
- Purpose: Page-level components mounted by router (one component per route typically)
- Contains: 65+ pages organized by feature area
- Root pages: Dashboard, AlertQueue, AlertDetailPage, ScreenEntity, Configuration, Analytics, AuditTrail, Monitoring, BatchJobs, SanctionsLists, Team, etc.
- Subdirectories by feature:
  - `admin/`: Tenants, TenantDetail, SystemHealth, ListSyncHealth, DataSources, Operations, ScheduledTasks
  - `reporting/`: ComplianceReport, SARForm
  - `marketing/`: LandingPage, BlogPage, CareersPage, ChangelogPage, StatusPage, DataCoverage
  - `legal/`: TermsOfService, PrivacyPolicy, SecurityPage, CompliancePage, AboutPage, DPAPage
  - `billing/`: BillingPage
  - Auth pages: Login, Signup, ForgotPassword, ResetPassword, MFASetup
- Pattern: Each page component uses custom hooks for data and composes UI from components

**src/routes/**
- Purpose: Route definitions and lazy loading configuration
- Files:
  - `appRoutes.tsx` (77 lines): Factory function returning all Route elements; separates public and protected routes
  - `lazyPages.ts` (50+ lines): Lazy-loaded page components using React.lazy()
  - `compliance.tsx`: Compliance-related routes
  - `platform.tsx`: Platform-related routes
  - `lazyCompliance.ts`, `lazyPlatform.ts`: Lazy exports for those route groups

**src/types/**
- Purpose: Centralized TypeScript type definitions by domain
- Files:
  - `index.ts`: Re-exports all types
  - `common.ts`: PaginatedResponse, ApiError, ApiResponse generic types
  - `alert.ts`: Alert, AlertDetail types
  - `screening.ts`: Screening results, entity types
  - `entity.ts`: Entity, person, company types
  - `config.ts`: Configuration domain types
  - `audit.ts`: Audit trail types
  - `analytics.ts`: Analytics dashboard types
  - `list.ts`: Sanctions list types
  - `billing.ts`: Billing types
- Pattern: One module per domain, imported/used throughout api/, hooks/, and pages/

**src/styles/**
- Purpose: Global CSS and Tailwind configuration
- Contains: Tailwind CSS setup, global utility styles, CSS custom properties for theming

**src/i18n/**
- Purpose: Internationalization setup and translation keys
- Contains: i18next configuration, language detection setup, translation key namespaces

**src/test/**
- Purpose: Shared testing utilities and mocks
- Contains: Test setup, mocking utilities, common test helpers

**src/data/**
- Purpose: Static data used across app
- Files:
  - `pepProfiles.ts`: Politically exposed persons profile definitions
  - `pepProfilesExtra.ts`: Extended PEP profile data
  - `riskCountries.ts`: Country risk classifications
- Pattern: Arrays/objects imported and used in components and pages

## Key File Locations

**Entry Points:**
- `index.html`: HTML template file (contains `<div id="root">`)
- `src/main.tsx`: React app mount point, service worker registration, vitals setup
- `src/App.tsx`: Root component, provider wrapping, router setup

**Configuration:**
- `vite.config.ts`: Build tool configuration (port 3000, dist output)
- `vitest.config.ts`: Test runner configuration
- `tsconfig.json`: TypeScript compiler options
- `package.json`: Dependencies and npm scripts
- `src/vite-env.d.ts`: Vite type definitions

**Core Logic:**
- `src/api/client.ts`: Base HTTP client and API helper object
- `src/context/AuthContext.tsx`: Authentication state and methods
- `src/context/ThemeContext.tsx`: Theme state and persistence
- `src/hooks/useApi.ts`: Generic data fetching hook
- `src/routes/appRoutes.tsx`: All route definitions

**Layout & Navigation:**
- `src/components/layout/AppShell.tsx`: Dashboard main container
- `src/components/layout/Sidebar.tsx`: Navigation sidebar
- `src/components/layout/Toolbar.tsx`: Top toolbar with user menu
- `src/components/layout/ProtectedRoute.tsx`: Auth guard component
- `src/components/layout/navItems.ts`: Navigation menu items

**Error Handling:**
- `src/components/ui/ErrorBoundary.tsx`: React error boundary
- `src/components/ui/MaintenancePage.tsx`: Server maintenance fallback

**Loading & Transitions:**
- `src/components/ui/PageLoader.tsx`: Full-page loading spinner
- `src/components/layout/PageTransition.tsx`: Animated page transitions
- `src/components/dashboard/DashboardSkeleton.tsx`: Dashboard skeleton loader

**Testing:**
- `src/hooks/useApi.test.ts`: Hook unit tests
- `src/pages/Dashboard.test.tsx`, `src/pages/ScreenEntity.test.tsx`: Page component tests
- `src/components/layout/Sidebar.test.tsx`, `src/components/ui/Button.test.tsx`: Component tests

## Naming Conventions

**Files:**
- Components: PascalCase (Button.tsx, AlertQueue.tsx, DashboardLayout.tsx)
- Hooks: camelCase starting with `use` (useApi.ts, useScreening.ts, useSidebar.ts)
- Pages: PascalCase matching route path (Dashboard.tsx, ScreenEntity.tsx, PEPScreening.tsx)
- API modules: camelCase (auth.ts, monitoring.ts, screening.ts)
- Type modules: camelCase (common.ts, alert.ts, entity.ts)
- Test files: Same name as source file with `.test.ts` or `.test.tsx` suffix
- Utilities: camelCase (navItems.ts, riskCountries.ts)

**Directories:**
- Feature directories: lowercase plural (components, hooks, pages, routes, types, styles)
- Component subdirectories: lowercase by feature domain (ui, layout, dashboard, alerts, admin)
- No `index.ts` files (components export directly)

**Components (within code):**
- Functional components: PascalCase (e.g., `export function Button() {}`)
- Props interfaces: ComponentNameProps (e.g., `interface ButtonProps { ... }`)
- React.FC deprecated in favor of explicit children prop typing

**Hooks:**
- Always start with `use` prefix (required by React)
- Domain hooks wrap utility hooks (e.g., `useScreening()` calls `useApi()`)
- Generics for reusable hooks (e.g., `useApi<T>`)

**Variables & Functions:**
- Variables: camelCase (isLoading, userData, submitHandler)
- Constants: UPPER_SNAKE_CASE (API_BASE, STORAGE_KEY, MOCK_STREAK)
- Event handlers: camelCase starting with `on` (onClick, onSubmit, onTouchEnd)

**Types:**
- Interfaces: PascalCase (User, MonitorProfile, ApiError)
- Type aliases: PascalCase (Theme, ApiResponse<T>)
- Type parameter suffixes: Use generic names (T, U, K, V)

## Where to Add New Code

**New Feature:**
- Page component: `src/pages/[FeatureName].tsx` (or subdirectory if grouped)
- API methods: `src/api/[featureName].ts` (new file if domain doesn't exist)
- Custom hook: `src/hooks/use[FeatureName].ts` (if logic is complex)
- Type definitions: Add types to existing file in `src/types/` or create `src/types/[featureName].ts`
- Component library: Feature-specific subdirectory in `src/components/[featureName]/`
- Route: Add to appropriate route file in `src/routes/` (appRoutes, compliance, or platform)
- Tests: Co-locate with source file using `.test.ts` or `.test.tsx` suffix

**New Component (Shared/UI):**
- Location: `src/components/ui/[ComponentName].tsx` for reusable components
- Export: Direct export from file (no index.ts barrel files)
- Props: Define interface `interface [ComponentName]Props { ... }`
- Test: `src/components/ui/[ComponentName].test.tsx` immediately adjacent

**New Utility/Helper:**
- Location: `src/hooks/[useXxx].ts` for logic, or add to relevant `src/api/` module
- Naming: Start with `use` if it's a hook, camelCase if it's a function module
- Tests: `src/hooks/[useXxx].test.ts`

**New API Endpoint:**
- Location: Add to relevant file in `src/api/` or create new module
- Pattern: Export named object with methods (e.g., `export const screeningApi = { list: () => ... }`)
- Types: Keep interfaces in same file or link to `src/types/`
- Client usage: Wrap in custom hook in `src/hooks/use[Domain].ts`

**New Page:**
- Location: `src/pages/[PageName].tsx` or `src/pages/[category]/[PageName].tsx`
- Import from: Custom hooks (`use[Domain]`), components, API directly, context
- Route: Add to `src/routes/appRoutes.tsx` route array
- Lazy loading: Add export to `src/routes/lazyPages.ts`
- Test: `src/pages/[PageName].test.tsx`

## Special Directories

**src/assets/**
- Purpose: Images and binary assets used in components
- Generated: No (manually committed)
- Committed: Yes
- Usage: Imported directly in components

**src/i18n/**
- Purpose: Internationalization setup and configuration
- Generated: No (manually maintained)
- Committed: Yes
- Contains: i18next config, language detector setup, translation namespaces

**src/test/**
- Purpose: Shared test utilities, setup, mocks
- Generated: No
- Committed: Yes
- Usage: Imported in test files

**dist/ (build output)**
- Purpose: Production build output from Vite
- Generated: Yes (via `npm run build`)
- Committed: No (gitignored)
- Contains: Minified JS, CSS, and optimized assets

**node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (via `npm install`)
- Committed: No (gitignored)
- Size: Managed by package-lock.json or similar

## File Size Compliance

**Policy:** Maximum 200 lines per file in `src/`, `app/`, `lib/` directories (per CLAUDE.md)

**Current State (sample):**
- `src/components/layout/AppShell.tsx`: 82 lines ✓
- `src/api/client.ts`: 56 lines ✓
- `src/pages/SourceHealth.tsx`: 184 lines ✓
- `src/pages/ScreenEntity.tsx`: 157 lines ✓
- `src/pages/Dashboard.tsx`: 88 lines ✓
- `src/hooks/useAlertSummary.ts`: ~50 lines ✓

**Refactoring Path:** If a page exceeds 200 lines, split into smaller components and move component trees to `src/components/[feature]/`

## Testing Structure

**Test Files:**
- Co-located with source: `ComponentName.tsx` paired with `ComponentName.test.tsx`
- Test utilities in `src/test/` for shared mocks and setup

**Test Patterns:**
- Unit tests: Component snapshot tests, hook logic tests
- Example: `src/components/ui/Button.test.tsx`, `src/hooks/useApi.test.ts`

**Runners:**
- Vitest for unit/integration tests (run via `npm test`)
- Playwright for E2E tests (run via `npm run test:e2e`)

---

*Structure analysis: 2026-04-21*
