# TenantIQ Frontend Rebuild — Bolt.new Instructions

## What this is

You're rebuilding the frontend for **TenantIQ**, an MSP control plane for managing Microsoft 365 tenants. The API already exists and is deployed at `https://api.tenantiq.app`. You're building a standalone SvelteKit app that talks to it.

## Files provided

1. **`tenantiq-openapi.yaml`** — Complete OpenAPI 3.1 spec with ~290 endpoints
2. **`tenantiq-frontend-types.ts`** — 2,575-line standalone TypeScript type definitions (no imports needed)

## Tech stack

- **SvelteKit 2** with **Svelte 5** (runes: `$state`, `$derived`, `$effect`)
- **TypeScript** strict mode
- **Tailwind CSS 4** with CSS custom properties for theming
- **Lucide Svelte** for icons
- Deploy target: **Cloudflare Pages** (static adapter or auto adapter)

## Auth model

The API uses **HttpOnly cookies**. The frontend never touches JWTs directly.

### Login flow:
1. User clicks "Sign in with Microsoft"
2. Frontend redirects to `GET /api/auth/login` (API handles OAuth)
3. Microsoft OAuth → API callback → redirects to frontend with `?code=...`
4. Frontend `POST /api/auth/exchange` with `{ code }` → API sets `tenantiq_session` cookie
5. Frontend calls `GET /api/auth/me` → gets user object → stores in Svelte store
6. All subsequent API calls include the cookie automatically (same-site)

### Key auth endpoints:
- `GET /api/auth/me` — returns `{ user }` or 401
- `POST /api/auth/refresh` — re-mints JWT, updates cookie
- `POST /api/auth/logout` — clears cookie + revokes token
- `GET /api/auth/ws-ticket` — 60s ticket for WebSocket/SSE connections

### Frontend auth store should:
- Call `/auth/me` on mount
- Show loading spinner until resolved
- On 401 from any API call: clear user, show sign-in page
- Support `X-Refresh-Session` response header (auto-refresh JWT)
- 8s timeout on `/auth/me` — never infinite spinner

## API client pattern

```typescript
const API_BASE = import.meta.env.PUBLIC_API_URL
  ? `${import.meta.env.PUBLIC_API_URL}/api`
  : 'https://api.tenantiq.app/api';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',  // CRITICAL: sends HttpOnly cookie
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.headers.get('X-Refresh-Session')) {
    fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  }
  if (res.status === 401) {
    // Clear auth store, redirect to sign-in
    throw new AuthError('Unauthorized');
  }
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

## Routing structure (80 pages)

### Public routes (no auth required):
- `/` — Landing/marketing page
- `/home` — Product overview
- `/pricing` — Plan comparison
- `/terms`, `/privacy`, `/support` — Legal
- `/changelog` — Product updates
- `/demo`, `/ciso-demo` — Demo pages
- `/compare`, `/compare/*` — Competitive comparison
- `/marketplace`, `/marketplace/*` — Skill marketplace
- `/scan/:domain` — Public prospect scan (no signup)
- `/leaderboard` — Public security leaderboard
- `/auth/callback` — OAuth callback handler

### Authenticated routes (sidebar nav):
See the sidebar map in the types file under "Constants & Config" section.

Quick Access: Dashboard (`/`), Skills Hub (`/skills`), Health Check (`/security`)
Management: Alerts, Licenses, Audit, Workflows
Security: CIS Benchmark, Threats, Behavior, Email, Purview, Sign-in Logs, SDLC, Copilot
Analytics: AI Agent, Backups, Config Snapshots, Config History
Governance: Workspaces, Storage, Lifecycle, Copilot Usage
Enterprise: MSP Benchmark, Team, Settings

### Settings sub-pages:
`/settings/profile`, `/settings/branding`, `/settings/sso`, `/settings/scim`,
`/settings/integrations`, `/settings/webhooks`, `/settings/api-keys`, `/settings/billing`

### Platform admin (`/platform/admin/*`):
Overview, Organizations, Users, Tenants, Subscriptions, Metrics, Audit Logs,
Revenue, Sync Jobs, Notifications, Feature Flags, Announcements, Credentials, Cron

## Design system

### Theme: Apple HIG-inspired
- CSS custom properties for all colors (supports light/dark mode)
- See design tokens in `tenantiq-frontend-types.ts` under section 29

### Key design principles:
- Content-first, minimal chrome
- Consistent spacing scale (4px base)
- Typography hierarchy: system font stack
- Meaningful motion only (300ms ease-out for transitions)
- High contrast (WCAG AA minimum)
- Loading skeletons before data (never empty state flash)
- Toast notifications for success/error feedback

### Common UI patterns:
- Sidebar navigation (collapsible on mobile, always visible on desktop)
- Data tables with search, filter, sort, pagination
- Score rings (circular progress for CIS score, health score, etc.)
- Severity badges (critical=red, high=orange, medium=yellow, low=blue)
- Metric cards with trend indicators
- Empty states with helpful CTAs
- Confirmation dialogs for destructive actions

## Multi-tenant context

Users manage multiple Microsoft 365 tenants. The frontend needs:
- **Tenant switcher** in sidebar — dropdown listing connected tenants
- **Current tenant** stored in a Svelte store — most API calls are tenant-scoped
- Many endpoints are at `/api/tenants/:tenantId/...` — the frontend passes the current tenant ID
- Some endpoints are org-scoped (alerts, audit) and automatically filter by the JWT's org

## Real-time features

- **SSE** at `GET /api/tenants/:id/events/stream` for live notifications
- **WebSocket** at `GET /api/ws/:tenantId` for real-time updates
- Both require a WS ticket from `GET /api/auth/ws-ticket` (60s TTL)
- Notification bell in sidebar header shows unread count
- Toast notifications for incoming alerts

## Environment variables

```env
PUBLIC_API_URL=https://api.tenantiq.app   # or http://localhost:8787 for local dev
```

That's the only env var the frontend needs. Everything else comes from the API.

## What NOT to build

- No backend/API logic — the API is separate and already deployed
- No database schemas — API handles all data
- No auth token management — cookies are HttpOnly, browser handles them
- No SSR data fetching — this is a client-side SPA that calls the API
