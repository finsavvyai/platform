# Qestro — Open-Source Boost Plan

**Generated**: 2026-04-09
**Project**: Qestro — Copilot for testing AI vibe coding
**Stack**: React 19 + Vite, Hono/Express, Cloudflare Workers, D1/PostgreSQL

---

## Current State

| Area | Current Tool | Rating |
|------|-------------|--------|
| Testing | Playwright + Jest + Vitest | Strong |
| AI/LLM | Anthropic + OpenAI + HuggingFace | Strong |
| Database | D1 (SQLite) + PostgreSQL | Good |
| Caching | CF KV + Redis | Good |
| Queue | Bull (Redis) | Adequate |
| Auth | Custom JWT + 7 OAuth providers | Strong |
| UI | Tailwind + Lucide + Recharts | Adequate |
| WebSocket | Socket.IO + ws | Good |
| Observability | Custom JSON logger | Weak |
| Feature Flags | None | Missing |
| Error Tracking | None | Missing |
| Analytics | None | Missing |
| PDF Reports | None | Missing |
| Component Library | None (raw Tailwind) | Weak |

---

## Tier 1: High Impact, Low Effort (ship this week)

### 1. PostHog — Product Analytics + Feature Flags + Session Replay
**Why**: Solves 3 gaps in one tool (analytics, feature flags, session replay). Free up to 1M events/month. The audience analysis identified that we need usage tracking for churn prediction — PostHog provides this out of the box.

**Integration**:
```
npm install posthog-js          # Frontend (3 kB gzip)
npm install posthog-node         # Backend
```

**Files to change**:
- `frontend/src/App.tsx` — init PostHog provider
- `backend/src/index.ts` — server-side event capture
- Feature flags replace hardcoded `ENABLE_*` env vars

**Effort**: 2 hours | **Impact**: Analytics + feature flags + session replay

---

### 2. Sentry — Error Tracking + Performance Monitoring
**Why**: Zero error tracking today. Every crash is invisible. Sentry's free tier covers 5K errors/month with source maps, stack traces, and performance traces.

**Integration**:
```
npm install @sentry/react        # Frontend
npm install @sentry/node         # Backend (or @sentry/cloudflare for Workers)
```

**Files to change**:
- `frontend/src/App.tsx` — wrap with `Sentry.init()` + ErrorBoundary
- `backend/src/index.ts` — Sentry middleware
- `backend/src/utils/logger.ts` — forward errors to Sentry

**Effort**: 1 hour | **Impact**: Error visibility, crash alerts, performance traces

---

### 3. Zod — Schema Validation (Frontend)
**Why**: Backend uses Zod for auth validation but frontend has no schema validation. Forms submit raw data. Adding Zod to react-hook-form provides type-safe validation with zero extra UI code.

**Integration**:
```
npm install zod @hookform/resolvers    # Already partially installed
```

**Files to change**:
- `frontend/src/pages/SignupPage.tsx` — add zodResolver
- `frontend/src/pages/LoginPage.tsx` — add zodResolver
- Any form that submits to API

**Effort**: 1 hour | **Impact**: Type-safe forms, better error messages, prevents invalid API calls

---

## Tier 2: High Impact, Medium Effort (ship this sprint)

### 4. Resend — Transactional Email
**Why**: Current email uses raw Nodemailer/SMTP. Resend is built for developers — React email templates, delivery tracking, 3K emails/month free. Critical for: email verification, password reset, test result notifications, churn prevention emails.

**Integration**:
```
npm install resend
```

**Files to change**:
- New: `backend/src/services/email/ResendService.ts`
- Replace Nodemailer calls in auth routes
- Create React email templates for: welcome, verify, password reset, test report

**Effort**: 4 hours | **Impact**: Reliable transactional email, delivery tracking

---

### 5. Upstash QStash — Serverless Queue (replace Bull for Workers)
**Why**: Bull requires Redis which doesn't run on Cloudflare Workers. QStash is a serverless HTTP-based queue built for edge. Free tier: 500 messages/day. Enables: test scheduling, webhook retries, async AI processing on Workers.

**Integration**:
```
npm install @upstash/qstash
```

**Files to change**:
- New: `backend/src/services/queue/QStashService.ts`
- Wire into test scheduling, AI job processing
- Replace Bull where running on Workers

**Effort**: 3 hours | **Impact**: Real async jobs on Cloudflare Workers

---

### 6. jsPDF + html2canvas — PDF Test Reports
**Why**: 30% of the audience analysis ICP (engineering managers) need exportable test reports for stakeholders. No PDF generation exists. jsPDF is 200 kB, generates client-side. Alternatively, use Puppeteer (already installed) for server-side PDF.

**Integration**:
```
npm install jspdf html2canvas     # Client-side
# OR use existing Puppeteer for server-side
```

**Files to change**:
- New: `frontend/src/lib/reportGenerator.ts`
- Add "Export PDF" button to Analytics dashboard and test run results
- Template: cover page + summary stats + test results table + screenshots

**Effort**: 4 hours | **Impact**: Exportable reports for enterprise customers

---

## Tier 3: Medium Impact, Higher Effort (next sprint)

### 7. Radix UI + Tailwind — Headless Component Library
**Why**: 50+ custom components with no shared primitives. Radix provides accessible, unstyled components (Dialog, Dropdown, Tooltip, Tabs, etc.) that work with existing Tailwind. Prevents reinventing accessibility patterns.

**Integration**:
```
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tooltip @radix-ui/react-tabs @radix-ui/react-select
```

**Files to change**:
- Gradually replace custom Modal, Tooltip, Select, Tabs components
- Keep existing Tailwind styling, just swap the behavior layer

**Effort**: 8 hours | **Impact**: Accessibility compliance, fewer bugs in interactive components

---

### 8. OpenTelemetry — Distributed Tracing
**Why**: As Qestro scales, debugging cross-service issues (frontend → Workers → D1 → AI provider) requires traces, not just logs. OTEL is the standard. Export to Grafana Cloud free tier.

**Integration**:
```
npm install @opentelemetry/api @opentelemetry/sdk-trace-base \
  @opentelemetry/exporter-trace-otlp-http
```

**Files to change**:
- New: `backend/src/lib/tracing.ts`
- Instrument: API routes, AI calls, DB queries, external HTTP
- Add trace context propagation to frontend API client

**Effort**: 6 hours | **Impact**: End-to-end request tracing, latency debugging

---

### 9. Trigger.dev — Background Jobs (alternative to QStash)
**Why**: If QStash's 500/day limit is too low, Trigger.dev offers a self-hosted job system with a great DX. TypeScript-native, supports long-running tasks (AI test generation can take 30s+), with retries and logging.

**Integration**:
```
npm install @trigger.dev/sdk
```

**Files to change**:
- New: `backend/src/jobs/` directory with typed job definitions
- Replace Bull queue processing for: test execution, AI generation, report generation

**Effort**: 6 hours | **Impact**: Reliable long-running background jobs

---

### 10. Storybook — Component Development
**Why**: 50+ UI components with no visual catalog. Storybook enables isolated component development, visual testing, and documentation. Pairs with the visual regression engine already built.

**Integration**:
```
npx storybook@latest init
```

**Files to change**:
- New: `.storybook/` config
- Stories for: Button, Card, Badge, Modal, ComparisonView, TestCard, DataTable
- Connect to visual regression for automated screenshot baselines

**Effort**: 8 hours | **Impact**: Component documentation, visual regression source

---

## Priority Matrix

```
         HIGH IMPACT
              |
   Sentry [1h] ●  PostHog [2h] ●
              |        Resend [4h] ●
   Zod [1h] ●|   QStash [3h] ●   jsPDF [4h] ●
              |
 LOW EFFORT ──┼────────────────────── HIGH EFFORT
              |
              |     Radix [8h] ●    OTEL [6h] ●
              |   Storybook [8h] ●  Trigger [6h] ●
              |
         LOW IMPACT
```

---

## Recommended Execution Order

| Sprint | Tools | Total Effort | Cumulative Value |
|--------|-------|-------------|-----------------|
| This week | PostHog + Sentry + Zod | 4 hours | Analytics, error tracking, validation |
| Next week | Resend + QStash + jsPDF | 11 hours | Email, queues, PDF reports |
| Sprint 3 | Radix UI + OTEL | 14 hours | Accessibility, tracing |
| Sprint 4 | Trigger.dev + Storybook | 14 hours | Background jobs, component docs |

**Total**: ~43 hours across 4 sprints to fill all open-source gaps.

---

## Cost Impact

| Tool | Free Tier | Paid Threshold |
|------|-----------|---------------|
| PostHog | 1M events/mo | $0 until scale |
| Sentry | 5K errors/mo | $26/mo at scale |
| Zod | OSS, free forever | N/A |
| Resend | 3K emails/mo | $20/mo |
| QStash | 500 msg/day | $1/100K messages |
| jsPDF | OSS, free forever | N/A |
| Radix UI | OSS, free forever | N/A |
| OTEL | OSS + Grafana free | $0 until scale |
| Trigger.dev | 50K runs/mo | $25/mo |
| Storybook | OSS, free forever | N/A |

**Total monthly cost at launch**: $0 (all within free tiers)
**Total monthly cost at 1000 users**: ~$50-75/mo
