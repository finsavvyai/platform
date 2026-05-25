# Technology Stack

**Analysis Date:** 2026-04-21

## Languages

**Primary:**
- TypeScript 5.3 - Full source code, all components and utilities
- JavaScript - Package scripts and configuration files

**Secondary:**
- CSS - Tailwind directives in `src/index.css`, custom styles for Apple HIG design system

## Runtime

**Environment:**
- Node.js 18+ (inferred from package.json type: "module" and ES2020 target)

**Package Manager:**
- npm 8+ (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- React 18.2 - UI framework for dashboard components
- React Router DOM 6.20 - Client-side routing with protected routes

**UI & Styling:**
- Tailwind CSS 3.4 - Utility-first CSS framework with Apple HIG design system extensions
- Framer Motion 10.18 - Animation library for meaningful motion (component transitions, modals)

**Forms & State:**
- React Context API - Authentication context (`src/context/AuthContext.tsx`), theme context, toast notifications
- React Hooks - Custom hooks for API calls, direction detection, keyboard shortcuts

**Internationalization:**
- i18next 26.0 - Translation framework
- i18next-browser-languagedetector 8.2 - Auto-detect browser language (localStorage, navigator)
- react-i18next 17.0 - React binding for i18next with support for 3 languages: English, Hebrew, Arabic

**Data & Visualization:**
- Recharts 2.10 - Charts and analytics visualizations on dashboard

**Utilities:**
- date-fns 2.30 - Date formatting and manipulation
- lucide-react 0.294 - SVG icon library (282 icons)
- clsx 2.0 - Conditional CSS class composition

## Testing

**Unit & Integration:**
- Vitest 1.0 - Test runner (ESM-native, Vite-powered)
  - Config: `vitest.config.ts`
  - Environment: jsdom for DOM testing
  - Setup: `src/test/setup.ts`

**Testing Library:**
- @testing-library/react 14.1 - React component testing utilities
- @testing-library/jest-dom 6.1 - DOM matchers (toBeInTheDocument, etc.)
- @testing-library/user-event 14.5 - User interaction simulation

**E2E Testing:**
- Playwright 1.58 - E2E test runner
  - Config: `playwright.config.ts`
  - Browsers: Chromium, Mobile (iPhone 13)
  - Output: HTML report on failure, screenshots on failure only

**Performance Monitoring:**
- web-vitals 5.2 - Core Web Vitals collection (LCP, INP, CLS, TTFB, FCP)
  - Metrics reported to backend `/api/v1/analytics/vitals` endpoint in production

## Build Tools

**Bundler:**
- Vite 5.0 - ESM bundler with HMR
  - Config: `vite.config.ts`
  - Output: `dist/` directory, sourcemaps disabled in production
  - Dev server: localhost:3000

**React Integration:**
- @vitejs/plugin-react 4.2 - React JSX transformation

**Post-Processing:**
- PostCSS 8.4 - CSS processing pipeline
  - Plugins: Tailwind CSS, Autoprefixer
  - Config: `postcss.config.js`

**Autoprefixer:**
- autoprefixer 10.4 - Vendor prefix injection for CSS

## Code Quality

**Linting:**
- ESLint 8.50 - JavaScript/TypeScript linter
  - Parser: @typescript-eslint/parser 8.58
  - Config: `.eslintrc.json` with recommended ruleset
  - Extension: ts, tsx files in `src/`

**Type Safety:**
- TypeScript strict mode enabled
  - `noImplicitAny: true`
  - `strict: true`
  - `forceConsistentCasingInFileNames: true`
  - Path alias: `@/` → `src/`

## Configuration

**Environment:**
- Vite environment variables with `VITE_` prefix
- Runtime config in `src/api/client.ts`:
  - `VITE_API_URL` - Backend API base URL (required in production, defaults to http://localhost:8080 in dev)
  - `VITE_APP_NAME` - Application display name
  - `VITE_ENVIRONMENT` - Environment identifier (development/production)
- File: `.env.example` (see below), `.env.production` for production overrides

**Internationalization:**
- Language detection order: localStorage (`amliq_lang`) → browser navigator
- Supported languages: English (en), Hebrew (he), Arabic (ar)
- Fallback language: English
- RTL support for Hebrew and Arabic via `useDirection()` hook

**Theme:**
- Dark mode via Tailwind class strategy (`darkMode: 'class'`)
- ThemeContext manages light/dark mode state
- Apple HIG-inspired color palette in `tailwind.config.js`:
  - Gold accent: #C9A96E
  - Charcoal: #1A1814
  - Warm gray: #5C5852
  - System semantic colors (green, red, orange, teal, blue)

**Authentication:**
- Token storage in `localStorage.amliq_token`
- Bearer token in Authorization header
- Session validation via `/auth/me` endpoint
- Automatic token clearing on 401 response

## Platform Requirements

**Development:**
- Node.js 18+
- npm 8+
- Browser with ES2020 support and Service Worker API
- 3000 port available (Vite dev server)
- 8080 port available (backend API, default)

**Production:**
- Web server capable of serving static SPA (dist/)
- Backend API accessible at `VITE_API_URL`
- HTTPS recommended for production (token storage, sensitive data)
- Browser support: Chromium-based (Chrome, Edge, Safari 15+, Firefox 87+) via Vite polyfill strategy

---

*Stack analysis: 2026-04-21*
