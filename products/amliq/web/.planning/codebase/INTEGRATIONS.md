# External Integrations

**Analysis Date:** 2026-04-21

## API & External Services

**AML/KYC Screening:**
- Sanctions List Screening - Core compliance functionality
  - Endpoint: `/api/v1/screen` (POST)
  - Fast screening: `/api/v1/screen/fast` (POST)
  - SDK/Client: Native fetch via `src/api/client.ts`
  - Payload: entity_name, entity_type, dob, nationality, lists[], threshold
  - Returns: match, confidence, matched_name, list_id

**Risk Assessment:**
- Risk Scoring Engine
  - Endpoint: `/api/v1/risk/score` (POST)
  - SDK/Client: Native fetch
  - Input: entity_name, entity_type, country, factors
  - Output: score (0-100), level (low/medium/high/critical), risk factors array

**Enhanced Due Diligence (EDD):**
- EDD Report Generation
  - Endpoints: `/api/v1/edd` (POST for creation), `/api/v1/edd/{id}` (GET)
  - SDK/Client: Native fetch via `src/api/edd.ts`
  - Status tracking: pending → in_progress → completed
  - Output includes risk_level and findings

**AI Integration:**
- Alert Summarization
  - Endpoint: `/api/v1/ai/summarize` (POST)
  - SDK/Client: Native fetch via `src/api/ai.ts`
  - Input sanitization: removes HTML/injection patterns, max 200 chars per field
  - Payload: sanitized text, type='alert'
  - Output: summary string, model name

**Monitoring & Continuous Screening:**
- Entity Monitoring Profiles
  - Endpoints: `/api/v1/monitor` (GET, POST, PUT, DELETE)
  - Frequency options: realtime, daily, weekly
  - Alert tracking with severity levels (critical, high, medium, low)

**PEP/Sanctions Lists:**
- Screening Layers Management
  - Endpoint: `/api/v1/lists` (GET per-list metadata)
  - Per-list configuration: source_url, custom_url, parser_type, sync_schedule, threshold
  - Sync endpoint: `/api/v1/lists/{id}/sync` (POST)
  - Last sync timestamp tracking

## Authentication & Identity

**Auth Provider:**
- Custom backend authentication (no third-party SSO/OAuth)
  - Implementation: Bearer token (JWT-compatible)
  - Login endpoint: `/api/v1/auth/login` (POST)
  - Signup endpoint: `/api/v1/auth/signup` (POST with org_name, country)
  - Session validation: `/api/v1/auth/me` (GET)
  - Token storage: localStorage.amliq_token
  - Token refresh: Automatic redirect to /login on 401

**Authorization:**
- Role-based access control (RBAC)
  - Roles: admin, analyst, auditor, viewer
  - Team management endpoint: `/api/v1/team` (GET, POST, PUT)
  - Protected routes via `<ProtectedRoute>` component

## Data Storage

**Databases:**
- Not exposed directly to frontend; all persistence via backend API

**Session Storage:**
- localStorage keys:
  - `amliq_token` - Authentication bearer token
  - `amliq_lang` - User language preference (en, he, ar)
  - Theme preference (if stored client-side)

## Billing & Monetization

**Billing Integration:**
- Billing Service Integration
  - Endpoints:
    - `/api/v1/billing/products` (GET) - Product catalog
    - `/api/v1/billing/subscriptions` (GET) - Active subscriptions
    - `/api/v1/billing/checkout` (POST) - Generate checkout URL
    - `/api/v1/billing/seats` (GET, POST, DELETE) - Team seat management
    - `/api/v1/billing/usage` (GET) - Usage metrics per product
    - `/api/v1/billing/promo` (POST) - Promo code validation
    - `/api/v1/billing/invoices` (GET) - Invoice history
    - `/api/v1/billing/health` (GET) - Billing system health check
  - Quota tracking: `/api/v1/screening/quota` returns used, limit, remaining, plan_name
  - Billing period options: monthly, annual

## Monitoring & Observability

**Error Tracking:**
- Not detected - errors logged to console in dev, no external error service configured

**Analytics & Web Vitals:**
- Custom endpoint: `/api/v1/analytics/vitals` (POST)
  - Collects: LCP, INP, CLS, TTFB, FCP (via web-vitals library)
  - Batched reports with keepalive flag for unload safety
  - Development: metrics logged to console only

**Audit Logging:**
- Backend audit trail
  - Endpoint: `/api/v1/audit` (GET)
  - Logs: auth events, admin actions, sensitive data mutations
  - Immutable audit entries viewable in admin panel

## Cases & Compliance Workflow

**Case Management:**
- Compliance Cases API
  - Endpoints:
    - `/api/v1/cases` (GET, POST)
    - `/api/v1/cases/{id}` (GET, PUT)
    - `/api/v1/cases/{id}/assign` (PUT)
    - `/api/v1/cases/{id}/escalate` (PUT)
    - `/api/v1/cases/{id}/resolve` (PUT)
    - `/api/v1/cases/{id}/review` (PUT)
    - `/api/v1/cases/bulk-resolve` (POST) - Batch case resolution
  - Status workflow: open → assigned → escalated → resolved
  - Comments endpoint: `/api/v1/cases/{id}/comments`

**Alerts & Screening Results:**
- Alert Management
  - Endpoints:
    - `/api/v1/alerts` (GET) - List screening alerts
    - `/api/v1/alerts/{id}` (GET, PUT)
    - `/api/v1/alerts/{id}/resolve` (PUT)
  - Data: matched entity info, risk_level, matchedCount, entity details

**Enforcement Actions:**
- Not fully documented in frontend - likely backend-only

## Configuration & Settings

**Tenant Configuration:**
- Endpoint: `/api/v1/config` (GET, PUT)
- Configurable settings:
  - country, regulation_framework[]
  - enabled_lists with per-list thresholds
  - default_threshold, match_weights
  - auto_dismiss_below, auto_escalate_above thresholds
  - screening_mode, batch_schedule, max_batch_size

## Transactions (Optional)

**Transaction Monitoring:**
- Endpoint: `/api/v1/transactions` (if used)
- Likely for transaction-level screening in fintech context

## Webhooks & Callbacks

**Incoming:**
- Service worker registration: `/sw.js` (POST via navigator.serviceWorker.register)
  - Not fully integrated; registered but may fail gracefully

**Outgoing:**
- List sync webhooks: Potential backend configuration for automated list updates
- Monitoring alerts: Push notifications or email (backend-driven)

## Environment Configuration

**Required env vars:**

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `VITE_API_URL` | Backend API base URL | http://localhost:8080 | Yes (production) |
| `VITE_APP_NAME` | Application display name | AMLIQ Dashboard | No |
| `VITE_ENVIRONMENT` | Environment identifier | development | No |
| `BASE_URL` | (Playwright only) E2E test base URL | http://localhost:3000 | No |
| `CI` | CI environment flag | undefined | No |

**Secrets location:**
- `.env.production` - Production overrides (not committed; add to .gitignore)
- CI/CD secrets: Configure in deployment platform (GitHub Actions, Cloudflare, etc.)
- Never commit `.env` files with real API_URL values

## Data Residency & Compliance

**Screening Data Flow:**
1. Frontend collects entity data (name, type, nationality, DOB)
2. Sends to `/api/v1/screen` endpoint (backend)
3. Backend queries external sanctions list data sources
4. Results cached in backend database
5. Frontend displays match/confidence scores and matched entity details

**Configuration Sync:**
- Per-tenant list configuration stored server-side
- Frontend reads via `/api/v1/config` on app load
- Sync schedule managed per list by backend

---

*Integration audit: 2026-04-21*
