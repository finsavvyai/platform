# CLAUDE.md - LunaOS Dashboard

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide a web-based admin and team management dashboard for the LunaOS AI agent platform, enabling users to manage agents, chains, billing, API keys, teams, analytics, and knowledge bases.
- Target user: Platform administrators, team leads, and individual developers managing their LunaOS workspace.
- Primary jobs to be done:
  - View and manage AI agents and execution chains
  - Monitor analytics and execution history
  - Manage team members, roles, and permissions
  - Configure billing, subscriptions, and API keys
  - Browse and manage knowledge base repositories
  - Adjust workspace settings and preferences

## Product-Specific Architecture Constraints

- Runtime(s): Next.js 14+ on Cloudflare Pages; React 18; Zustand for state; TanStack Query for server state
- Core services: `app/` directory (Next.js App Router); pages at `app/dashboard/{agents,chains,billing,api-keys,teams,analytics,history,kb,repos,services,settings,visualizer}/`; shared components in `components/`; API hooks in `hooks/`; stores in `store/`
- Data boundaries: All data fetched from `lunaos-engine` API; no direct database access; auth tokens stored in httpOnly cookies
- Integration boundaries: Engine API (`api.lunaos.ai`), LemonSqueezy portal (billing redirect), GitHub OAuth (login)
- UI library: Radix UI primitives (Dialog, Dropdown, Tabs, Tooltip, Accordion) + Tailwind CSS + class-variance-authority
- Charting: Recharts for analytics dashboards
- Max 200 lines per component file; extract hooks and utilities into separate files
- TypeScript strict mode; Zod for form validation via react-hook-form resolvers

## Product-Specific Test Matrix

- Unit tests: Jest + @testing-library/react; files in `app/__tests__/` and component `__tests__/` directories
- Integration tests: Jest with MSW for API mocking; test full page renders with data fetching
- E2E/smoke tests: Playwright; config at `playwright.config.ts` and `playwright.smoke.config.ts`; test login, agent CRUD, billing, team flows
- Critical path tests (must remain 100% covered):
  - Authentication flows (login, signup, session refresh, logout)
  - Billing page (subscription display, upgrade/downgrade, portal redirect)
  - API key management (create, copy, revoke)
  - Team invite and role assignment
- Coverage thresholds: >=90% line, >=85% branch (matches root policy)
- Accessibility: axe-core scans on all 11+ dashboard routes; WCAG 2.1 AA compliance required

## Product-Specific Security Controls

- AuthN/AuthZ model: JWT tokens from engine API stored in httpOnly cookies; role-based UI rendering (admin vs user); protected routes redirect to login
- Secret management: No secrets in client bundle; all API calls proxied through Next.js API routes or direct to engine with bearer token
- Input/output validation: Zod schemas on all forms via @hookform/resolvers; XSS prevention via React's built-in escaping; CSP headers in `next.config.mjs`
- Audit logging requirements: Client-side actions logged to engine audit endpoint; no sensitive data in browser console or localStorage
- Data retention/privacy constraints: No PII cached in browser storage; session tokens expire per engine JWT policy; clear all state on logout

## Product-Specific Release Checklist

- [ ] CI is green (unit + integration tests pass)
- [ ] Coverage thresholds met: >=90% line, >=85% branch
- [ ] Security scans have no open Critical/High issues
- [ ] Accessibility audit passes (zero WCAG 2.1 AA violations)
- [ ] Lighthouse performance score >= 90
- [ ] `next build` succeeds with no TypeScript errors
- [ ] Rollback path verified (previous Pages deployment tagged)
- [ ] Release notes and changelog updated
- [ ] Staging deploy tested before production promote
- [ ] All interactive elements have visible focus indicators

## Commands

```bash
npm run dev               # Next.js dev server at localhost:3000
npm run build             # Production build
npm run test              # Jest unit tests
npm run test:watch        # Jest watch mode
npm run test:e2e          # Playwright E2E tests
npm run lint              # ESLint
npm run type-check        # TypeScript check
```

## Local Notes

- This file adds WCAG 2.1 AA accessibility requirement (stricter than root).
- This file adds Lighthouse >= 90 performance gate (stricter than root).
- This file does not weaken any root policy requirement.
- Dashboard deployed to Cloudflare Pages at agents.lunaos.ai.
