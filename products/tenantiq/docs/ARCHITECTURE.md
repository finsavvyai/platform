# TenantIQ Architecture

## System Overview

```
                         +------------------+
                         |   Clerk Auth     |
                         | (JWT / Webhooks) |
                         +--------+---------+
                                  |
          +-----------+-----------+-----------+-----------+
          |           |                       |           |
  +-------v-------+  |  +----------+  +------v------+   |
  | SvelteKit App |  |  | Cron     |  | Queue       |   |
  | (CF Pages)    |  |  | Workers  |  | Consumers   |   |
  +-------+-------+  |  +----+-----+  +------+------+   |
          |           |       |               |           |
          v           v       v               v           |
  +-------+-------------------------------------------+  |
  |              Hono API (CF Workers)                 |  |
  |  routes/ -> middleware -> lib/ -> DB/KV/Graph      |  |
  +--+--------+--------+--------+--------+--------+---+  |
     |        |        |        |        |        |       |
     v        v        v        v        v        v       |
  +----+  +----+  +------+  +----+  +----+  +--------+   |
  | D1 |  | KV |  | R2   |  |Graph| |Claude| |Resend  |  |
  |    |  |    |  |Bucket|  | API |  | AI  | |Slack   |  |
  +----+  +----+  +------+  +----+  +----+  +--------+   |
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | SvelteKit 2.15, Svelte 5, Tailwind | Dashboard UI on CF Pages |
| API | Hono 4, TypeScript, CF Workers | REST API, 70+ routes |
| Database | Cloudflare D1 (SQLite) | 15 tables, Drizzle ORM |
| Cache | Cloudflare KV | Tokens, scores, scan results |
| Storage | Cloudflare R2 | PDF reports, config exports |
| Queues | CF Queues | Scan processing, notifications |
| Auth | Clerk | JWT (RS256), org membership |
| Identity | Microsoft Graph API | Users, groups, policies, mail |
| AI | Anthropic Claude | Security analysis, recommendations |
| Email | Resend | Transactional email delivery |
| Billing | LemonSqueezy | Subscription management |

## Request Flow

```
Browser --> CF Pages (SvelteKit SSR)
  |
  +--> Bearer JWT in Authorization header
  |
  +--> CF Worker (Hono API)
         |
         +-- clerkAuth() middleware --> validates JWT
         +-- tenantMiddleware --> resolves org_id, tenant_id
         +-- rateLimitMiddleware --> KV-based rate limiting
         +-- Zod validation --> request body/params
         |
         +--> Route handler
                |
                +-- D1 queries (Drizzle ORM, scoped by org_id)
                +-- KV reads/writes (cached data, tokens)
                +-- Graph API calls (via cached access token)
                +-- AI calls (Anthropic Claude API)
                |
                +--> JSON response { data } or { error }
```

## Data Model (Key Tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| organizations | MSP organizations | id, name, plan, created_at |
| tenants | Azure AD tenants | id, org_id, azure_tenant_id, name |
| users_cache | Cached Graph users | id, tenant_id, email, last_sign_in |
| licenses_cache | License assignments | id, tenant_id, sku_id, assigned_to |
| alerts | Security alerts | id, tenant_id, severity, status |
| remediations | Remediation actions | id, tenant_id, control_id, status |
| workflows | Automation workflows | id, tenant_id, trigger, actions |
| cis_scans | CIS benchmark results | id, tenant_id, score, controls |
| config_snapshots | M365 config captures | id, tenant_id, snapshot_data |
| audit_logs | Audit trail | id, org_id, action, actor, timestamp |
| webhook_configs | Outbound webhook setup | id, tenant_id, url, events |
| team_members | Org team membership | id, org_id, user_id, role |
| subscriptions | Billing subscriptions | id, org_id, plan, status |
| platform_users | Platform admin users | id, email, role |
| notification_prefs | Push notification prefs | id, user_id, channels |

## Authentication Flow

```
1. User clicks "Connect Tenant"
2. Redirect to Azure AD OAuth (/api/auth/login)
   - state parameter stored in KV (5 min TTL)
3. Azure AD redirects back with auth code (/api/auth/callback)
   - Validate state parameter
   - Exchange code for access_token + refresh_token
   - Store tokens in KV (keyed by azure_tenant_id)
   - Create/update tenant record in D1
   - Issue JWT session token (24h expiry)
4. Subsequent API calls use Bearer JWT
   - clerkAuth() validates signature
   - Tenant context resolved from JWT claims
5. Graph API calls use stored access_token from KV
   - Auto-refresh via refresh_token when expired
```

## Key Modules

### Intelligence Engine (`packages/intel`)
Prioritizes alerts using risk scoring rules. Evaluates severity, recurrence,
blast radius, and asset criticality. Feeds into alert dashboard and notifications.

### CIS Benchmark Engine (`apps/api/src/lib/cis/`)
Evaluates 100+ CIS Microsoft 365 controls. Captures current config via Graph API,
compares against benchmarks, calculates compliance score, and generates remediation steps.

### AI Agent (`apps/api/src/routes/ai*.ts`)
Claude-powered security assistant. Supports natural language queries, security scanning,
license optimization, and streaming responses. Conversations stored in KV.

### Remediation Engine (`packages/remediation`)
Executes remediation actions against Graph API. Supports dry-run preview, scheduled
execution, approval workflows, and rollback capability.

### Workflow Engine (`apps/api/src/routes/workflows.ts`)
User-defined automation workflows with triggers and actions. Supports lifecycle
management (onboard/offboard), scheduled tasks, and event-driven execution.

### Lifecycle Manager (`apps/api/src/routes/lifecycle.ts`)
Manages user onboarding/offboarding via Graph API. Supports 10 actions: create user,
assign licenses, add to groups, set mailbox rules, configure MFA, and more.

## Deployment Architecture

```
Cloudflare Global Network
|
+-- Pages (apps/web)
|   - SvelteKit SSR + static assets
|   - Custom domain: app.tenantiq.io
|   - Preview deployments per PR
|
+-- Workers (apps/api)
|   - Hono API runtime
|   - Custom domain: api.tenantiq.io
|   - Bindings: D1, KV, R2, Queues
|
+-- D1 Database
|   - Production: tenantiq-production
|   - Preview: tenantiq-preview
|   - Migrations via Drizzle
|
+-- KV Namespaces
|   - TENANTIQ_KV: tokens, cache, sessions
|   - Rate limit counters
|
+-- R2 Buckets
|   - tenantiq-exports: PDF reports, CSV exports
|   - tenantiq-backups: config snapshots
|
+-- Queues
|   - scan-processor: async CIS/security scans
|   - notification-delivery: email/Slack/Teams
|   - remediation-executor: async remediation
|
+-- Cron Triggers
    - User sync (hourly)
    - Compliance scan (daily)
    - Webhook retry (every 5 min)
    - License usage snapshot (daily)
```

## Multi-Tenancy

All data access is scoped by `org_id` (organization) and `tenant_id` (Azure tenant).
Every D1 query includes a WHERE clause filtering by the authenticated org. KV keys
are prefixed with tenant identifiers. RBAC roles (super_admin, admin, operator, viewer)
control write access. Cross-tenant data access is blocked at the middleware layer.

## Error Handling

- API validation errors return 400 with Zod error details
- Auth failures return 401 with redirect to login
- Permission denials return 403 with required role
- Not found returns 404 with resource identifier
- Rate limit exceeded returns 429 with retry-after header
- Internal errors return 500, logged to Sentry with request context
