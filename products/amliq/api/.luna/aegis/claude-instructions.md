# AMLIQ - Claude Browser Extension Instructions

## Application Overview

**AMLIQ** (AML Intelligence Platform) is a SaaS Anti-Money Laundering screening platform that replaces expensive tools like World-Check. It provides AI-powered, configurable sanctions screening for financial institutions.

**Tech Stack**: Go 1.22 backend, React 18 + TypeScript frontend, PostgreSQL + pgvector, LemonSqueezy billing, Docker/K8s infrastructure.

**Core Value Prop**: 6-layer cascade matching (Exact, Fuzzy, Phonetic, Token, Embedding, Graph), explainable results, <50ms latency, 10x cheaper than World-Check.

---

## Complete Page Inventory

### Public Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing Page | Marketing homepage with hero, features, pricing, testimonials, FAQ |
| `/login` | Login | Email/password sign-in + OAuth (Google, GitHub) |
| `/signup` | Signup | Organization registration with country selection |

### Main Dashboard Pages (Protected)

| Route | Page | Purpose | Key UI Elements |
|-------|------|---------|-----------------|
| `/dashboard` | Dashboard | Overview metrics & charts | Stat cards (total alerts, cleared today, escalated, avg resolution), screening volume chart, disposition breakdown, risk distribution, top entities |
| `/alerts` | Alert Queue | List all screening alerts | Filter by status (open/investigating/resolved/archived) and priority (critical/high/medium/low), alert count badge |
| `/alerts/:id` | Alert Detail | Individual alert management | Entity details card, notes editor, action buttons: Confirm, False Positive, Escalate, AI Draft |
| `/screen` | Screen Entity | Manual entity screening | Toggle Individual/Company, name fields, DOB, nationality, submit with loading state |
| `/monitoring` | Monitoring | System health dashboard | API response time, DB connection, cache hit rate, screening task progress |
| `/batch` | Batch Jobs | Bulk screening management | Job list with status (completed/running/pending), entity count, start button |
| `/lists` | Sanctions Lists | Manage sanctions data sources | List cards with entity count, threshold, last sync date, sync trigger button |

### Compliance Pages (Protected)

| Route | Page | Purpose | Key UI Elements |
|-------|------|---------|-----------------|
| `/compliance/cases` | Case Management | Compliance case tracking | Filter by status (open/in_review/escalated/resolved), entity name, matched name, priority badge |
| `/compliance/cases/:id` | Case Detail | Individual case actions | Status/priority/confidence display, Escalate and Mark False Positive buttons, comments section |
| `/compliance/risk` | Risk Assessment | Entity risk scoring | Entity ID + country input, composite risk score, risk level badge, risk factors breakdown |
| `/compliance/pep` | PEP Screening | Politically Exposed Person check | Entity ID input, PEP status/tier/risk weight/position/country results |
| `/compliance/media` | Adverse Media | Unreviewed media hits | Title, severity (0-10), category badges (financial crime/terrorism/fraud), external links |
| `/compliance/txn` | Transaction Monitoring | Transaction alert monitoring | Summary counts by type (high value/rapid movement/structuring/high risk country/unusual pattern), alert list |
| `/compliance/ubo/:id` | UBO Chain | Beneficial ownership visualization | Owner chain with nationality, direct/indirect ownership %, PEP flags |
| `/compliance/edd/:id` | EDD Workflow | Enhanced Due Diligence checklist | 8 checks (identity, source of funds/wealth, PEP, adverse media, sanctions, UBO, country risk), progress bar |

### System Pages (Protected)

| Route | Page | Purpose | Key UI Elements |
|-------|------|---------|-----------------|
| `/analytics` | Analytics | Screening trends & stats | Volume trends chart, alert disposition breakdown, risk distribution |
| `/audit` | Audit Trail | Activity log | Action, actor, target, timestamp, color-coded action badges |
| `/config` | Configuration | Screening settings | Three threshold sliders (0-100): default match, auto-dismiss, auto-escalate; enabled lists display; Save button |
| `/team` | Team | Team member management | Email + role dropdown (Admin/Analyst/Auditor/Viewer) invite form, member list |

### Billing Pages (Protected)

| Route | Page | Purpose | Key UI Elements |
|-------|------|---------|-----------------|
| `/billing` | Billing Dashboard | Subscription & usage overview | Active subscriptions, product usage meters, seat manager, promo code input, usage history, invoice list, Add Product button |

**Billing Sub-components**: Add Product Modal (product + plan selection + checkout), Upgrade Modal (price comparison + confirm), Seat Manager (email + role input, seat count display)

### Admin Pages (Protected, Admin Only)

| Route | Page | Purpose | Key UI Elements |
|-------|------|---------|-----------------|
| `/admin/tenants` | Tenants | Admin tenant list | Search filter, tenant name/ID list |
| `/admin/tenants/:id` | Tenant Detail | Tenant management | Screening count history, config override for match threshold |
| `/admin/health` | System Health | System status | API Status, Database, Version cards with health indicators |

### Platform Pages (Protected, Super-Admin)

| Route | Page | Purpose | Key UI Elements |
|-------|------|---------|-----------------|
| `/platform/overview` | Platform Overview | Platform-wide statistics | Total tenants, total screenings |
| `/platform/users` | Platform Users | All users across tenants | Search by email/tenant, columns: email, tenant ID, role |
| `/platform/keys` | API Keys | All API keys | Prefix, tenant, product, rate limit, Revoke button |

### Onboarding (Protected, First-time)

| Route | Page | Purpose |
|-------|------|---------|
| `/onboarding` | Onboarding Wizard | 3-step setup: Country selection -> Recommended lists -> Threshold configuration |

---

## Navigation Structure

### Sidebar (Left Navigation)

**Main**
- Dashboard (`/dashboard`)
- Alerts (`/alerts`)
- Screen (`/screen`)
- Monitoring (`/monitoring`)
- Batch Jobs (`/batch`)

**Compliance**
- Cases (`/compliance/cases`)
- Risk Assessment (`/compliance/risk`)
- PEP Screening (`/compliance/pep`)
- Adverse Media (`/compliance/media`)
- Transactions (`/compliance/txn`)
- UBO Chain (`/compliance/ubo/:id`)
- EDD Workflow (`/compliance/edd/:id`)

**System**
- Analytics (`/analytics`)
- Audit Log (`/audit`)
- Configuration (`/config`)
- Billing (`/billing`)

**Platform** (Admin only)
- Overview (`/platform/overview`)
- Users (`/platform/users`)
- API Keys (`/platform/keys`)

### Top Toolbar
- Hamburger menu (mobile sidebar toggle)
- Search field (desktop only)
- Notification bell (with red dot indicator)
- Settings button

### Marketing Navigation (Public Pages)
- Logo -> Home
- Features, Pricing, Docs, Blog (hash links)
- Sign In -> `/login`
- Start Free Trial -> `/signup`
- Mobile hamburger menu

---

## Feature Catalogue

### 1. Entity Screening
- **Form**: Toggle Individual/Company type, enter name/DOB/nationality
- **API**: `POST /api/v1/screen`
- **Results**: Confidence score, matching evidence by layer, matched sanctions entries
- **Actions**: Review results, create alert if match found

### 2. Alert Management
- **List**: Filter by status (open/investigating/resolved/archived) and priority (critical/high/medium/low)
- **API**: `GET /api/v1/alerts`, `GET /api/v1/alerts/{id}`, `PUT /api/v1/alerts/{id}/resolve`
- **Detail Actions**: Confirm match, Mark as False Positive, Escalate, AI Draft response
- **Notes**: Add compliance officer notes to alerts

### 3. Batch Screening
- **Submit**: Upload entities for bulk screening
- **API**: `POST /api/v1/batch`, `GET /api/v1/batch/{id}`, `GET /api/v1/batch/{id}/results`
- **Monitor**: Track job status (pending/running/completed), start pending jobs

### 4. Compliance Case Management
- **Cases**: Track from open through in_review, escalated, to resolved
- **API**: `GET /api/v1/cases`, `GET /api/v1/cases/{id}`, `PUT /api/v1/cases/{id}/escalate`, `PUT /api/v1/cases/{id}/resolve`
- **Actions**: Escalate, Mark False Positive, Add Comments, Assign to team member

### 5. Risk Assessment
- **Input**: Entity ID + Country code
- **API**: `POST /api/v1/risk/score`
- **Output**: Composite risk score, risk level (critical/high/medium/low), individual risk factors

### 6. PEP Screening
- **Input**: Entity ID
- **API**: `POST /api/v1/pep/screen`
- **Output**: PEP status, tier, risk weight, position, country

### 7. Adverse Media Monitoring
- **List**: Unreviewed media hits with severity scores
- **API**: `GET /api/v1/media/unreviewed`, `POST /api/v1/media/batch`
- **Display**: Title, severity (0-10), category, external URL

### 8. Transaction Monitoring
- **Summary**: Alert counts by type (high value, rapid movement, structuring, high risk country, unusual pattern)
- **API**: `POST /api/v1/transactions`, `GET /api/v1/transactions/alerts`, `GET /api/v1/transactions/alerts/summary`

### 9. UBO (Beneficial Ownership)
- **Visualization**: Ownership chain with nationality, ownership %, PEP flags
- **API**: `POST /api/v1/ubo`, `GET /api/v1/ubo/{id}`

### 10. Enhanced Due Diligence (EDD)
- **Checklist**: 8 verification steps with progress tracking
- **API**: `POST /api/v1/edd`, `GET /api/v1/edd/{id}`
- **Steps**: Identity verification, source of funds, source of wealth, PEP screening, adverse media, sanctions, UBO, country risk

### 11. Configuration
- **Thresholds**: Default match (0-100), auto-dismiss below, auto-escalate above
- **API**: `GET /api/v1/config`, `PUT /api/v1/config`
- **Lists**: Enable/disable sanctions lists

### 12. Team Management
- **Invite**: Email + role (Admin/Analyst/Auditor/Viewer)
- **API**: `GET /api/v1/team`, `POST /api/v1/team/invite`, `PUT /api/v1/team/{id}/role`

### 13. Billing & Subscriptions
- **Products**: API, Dashboard, SDK, iFrame, Dataset (each with Lite/Pro/Enterprise tiers)
- **API**: `GET /api/v1/billing/products`, `POST /api/v1/billing/checkout`, `GET /api/v1/billing/subscriptions`, `GET /api/v1/billing/usage`
- **Seat Management**: Add/remove seats with email + role
- **Promo Codes**: Apply discount codes
- **Invoices**: View billing history

### 14. Sanctions Lists
- **Display**: List name, entity count, threshold, last sync date
- **API**: `GET /api/v1/lists`, `POST /api/v1/lists/{id}/sync`
- **Supported**: OFAC SDN, EU Consolidated, UN, UK HMRC, Swiss SECO, Israeli, Ukrainian, OpenSanctions

### 15. Audit Trail
- **Log**: All actions with actor, target, timestamp
- **API**: `GET /api/v1/audit`, `GET /api/v1/audit/{id}`
- **Color-coded**: Action type badges

### 16. Analytics
- **Charts**: Screening volume trends (30 days), alert disposition breakdown, risk distribution
- **API**: `GET /api/v1/analytics`

### 17. System Monitoring
- **Metrics**: API response time, database connection, cache hit rate
- **Health**: `GET /health`, `GET /ready`

---

## User Flows

### Flow 1: First-Time Onboarding
1. User signs up at `/signup` (org name, email, password, country)
2. Redirected to `/onboarding` wizard
3. Step 1: Select operating country
4. Step 2: Review recommended sanctions lists for that country
5. Step 3: Configure default matching threshold
6. Arrives at `/dashboard`

### Flow 2: Manual Entity Screening
1. Navigate to Screen (`/screen`) from sidebar
2. Select entity type: Individual or Company
3. Fill in entity details (name, DOB, nationality for individual; company name for company)
4. Click "Screen" button
5. View results with confidence scores and matching evidence
6. If match found, alert is created automatically

### Flow 3: Alert Investigation
1. Navigate to Alerts (`/alerts`) from sidebar
2. Filter alerts by status and/or priority
3. Click an alert to open detail view (`/alerts/:id`)
4. Review entity details and matching evidence
5. Take action: Confirm (true match), False Positive, Escalate, or AI Draft
6. Add notes for audit trail
7. Alert status updates accordingly

### Flow 4: Compliance Case Workflow
1. Navigate to Cases (`/compliance/cases`)
2. Filter by status (open/in_review/escalated/resolved)
3. Click case to open detail (`/compliance/cases/:id`)
4. Review entity info, confidence score, matched name
5. Add comments for team collaboration
6. Take action: Escalate or Mark as False Positive
7. Case status updates

### Flow 5: Risk Assessment
1. Navigate to Risk Assessment (`/compliance/risk`)
2. Enter Entity ID and Country code
3. Click "Calculate Risk"
4. View composite score, risk level, individual risk factors, score breakdown

### Flow 6: Billing Management
1. Navigate to Billing (`/billing`)
2. View active subscriptions and usage meters
3. Click "Add Product" to open product selection modal
4. Select product -> Select plan tier -> Checkout
5. Manage team seats (add email + role)
6. Apply promo codes
7. View invoice history

### Flow 7: Configuration Update
1. Navigate to Configuration (`/config`)
2. Adjust threshold sliders (default match, auto-dismiss, auto-escalate)
3. Review enabled sanctions lists
4. Click "Save Changes"

### Flow 8: Batch Screening
1. Navigate to Batch Jobs (`/batch`)
2. View existing jobs and their statuses
3. Start pending jobs with the start button
4. Monitor progress (pending -> running -> completed)
5. Review results when complete

### Flow 9: EDD Workflow
1. Navigate to EDD Workflow (`/compliance/edd/:id`)
2. View 8-step checklist with progress bar
3. Complete each verification step: identity, source of funds, source of wealth, PEP, adverse media, sanctions, UBO, country risk
4. Track overall completion percentage

---

## Component Library Reference

### Base UI Components
- **Button** — Primary/secondary variants with loading state
- **Card** — Container with Apple HIG vibrancy styling
- **Badge** — Color-coded status/tag display (size and color variants)
- **Avatar** — User profile picture with initials fallback
- **Toggle** — Boolean on/off switch
- **SearchField** — Input with search icon
- **LoadingSpinner** — Animated loading indicator
- **EmptyState** — Placeholder with optional action
- **Toast** — Notification system (success/error/warning)
- **Divider** — Horizontal separator
- **ErrorBoundary** — Crash handler wrapper

### Data Display
- **StatCard** — Metric with label and trend indicator
- **ConfidenceScore** — Percentage display with visual indicator
- **StatusBadge** — Color-coded status display
- **ComplianceMetrics** — Dashboard summary cards

### Charts
- **AreaChart** — Time-series visualization
- **BarChart** — Grouped/stacked bars
- **DonutChart** — Distribution pie chart

### Alert Components
- **AlertCard** — Alert summary card
- **AlertFilters** — Multi-select status/priority filters
- **AlertActions** — Action button grid (Confirm/False Positive/Escalate/AI Draft)
- **EntityDetailsCard** — Sanctioned entity information
- **NotesCard** — Compliance officer notes editor
- **AlertDetailSidebar** — Detailed side panel

### Screening Components
- **ScreeningForm** — Entity input form (Individual/Company toggle)
- **ScreeningResults** — Match results display
- **ScreeningLayersList** — Evidence by matching layer

### Configuration Components
- **ThresholdsCard** — Confidence threshold sliders
- **ScreeningLayersCard** — Layer weight configuration
- **MatchingModesCard** — Algorithm enable/disable toggles

### Layout Components
- **AppShell** — Root layout (sidebar + toolbar + content)
- **Sidebar** — Left navigation with sections
- **Toolbar** — Top bar with search, notifications, settings
- **PageHeader** — Page title with optional action button
- **ProtectedRoute** — Auth guard wrapper

---

## API Endpoints Quick Reference

### Authentication
- `POST /api/v1/auth/login` — Email/password login
- `POST /api/v1/auth/signup` — Create account + tenant
- `GET /api/v1/auth/me` — Current user info
- `GET /auth/oauth/{provider}` — OAuth redirect
- `GET /auth/oauth/{provider}/callback` — OAuth callback

### Screening
- `POST /api/v1/screen` — Screen single entity
- `GET /api/v1/screen/{id}` — Get screening result
- `POST /api/v1/batch` — Submit batch screening
- `GET /api/v1/batch/{id}` — Batch status
- `GET /api/v1/batch/{id}/results` — Batch results

### Alerts
- `GET /api/v1/alerts` — List alerts (filter: status, priority)
- `GET /api/v1/alerts/{id}` — Alert details
- `PUT /api/v1/alerts/{id}/resolve` — Resolve alert

### Compliance
- `GET /api/v1/cases` — List cases
- `GET /api/v1/cases/{id}` — Case details
- `PUT /api/v1/cases/{id}/escalate` — Escalate case
- `PUT /api/v1/cases/{id}/resolve` — Resolve case
- `POST /api/v1/risk/score` — Calculate risk score
- `POST /api/v1/pep/screen` — PEP screening
- `GET /api/v1/media/unreviewed` — Unreviewed media
- `POST /api/v1/transactions` — Submit transaction
- `GET /api/v1/transactions/alerts` — Transaction alerts
- `POST /api/v1/ubo` — Add UBO info
- `GET /api/v1/ubo/{id}` — List UBO chain
- `POST /api/v1/edd` — Create EDD file
- `GET /api/v1/edd/{id}` — Get EDD file

### Configuration & Lists
- `GET /api/v1/config` — Get config
- `PUT /api/v1/config` — Update config (Admin)
- `GET /api/v1/lists` — List sanctions lists
- `POST /api/v1/lists/{id}/sync` — Trigger list sync

### Billing
- `GET /api/v1/billing/products` — Available products/plans
- `POST /api/v1/billing/checkout` — Create checkout
- `GET /api/v1/billing/subscriptions` — Tenant subscriptions
- `GET /api/v1/billing/usage` — Usage metrics
- `GET /api/v1/billing/invoices` — Invoice list
- `POST /api/v1/billing/seats` — Add seat
- `GET /api/v1/billing/seats` — List seats

### Team
- `GET /api/v1/team` — List members
- `POST /api/v1/team/invite` — Invite user (Admin)
- `PUT /api/v1/team/{id}/role` — Update role (Admin)

### Admin & Platform
- `GET /api/v1/admin/tenants` — List tenants (Admin)
- `GET /api/v1/platform/overview` — Platform stats (Super-Admin)
- `GET /api/v1/platform/users` — All users (Super-Admin)
- `GET /api/v1/platform/keys` — All API keys (Super-Admin)

### Health
- `GET /health` — Liveness check
- `GET /ready` — Readiness check

---

## Authentication & Authorization

- **JWT**: Bearer token in Authorization header for web UI sessions
- **API Key**: `X-API-Key` header for programmatic access
- **OAuth**: Google and GitHub providers
- **Roles**: Admin (full access), Editor (read + write), Viewer (read-only)
- **RBAC Middleware**: AdminOnly, WriteAccess, AuditAccess gates
- **Multi-tenant**: All data isolated by tenant ID from JWT claims
- **Rate Limiting**: Token bucket per tenant (100 req/sec default)
- **Usage Enforcement**: Returns 402 if plan screening limit exceeded

---

## Design System

- **Framework**: Tailwind CSS with Apple HIG-inspired tokens
- **Colors**: `apple-bg`, `apple-blue`, `apple-label-*` semantic classes
- **Typography**: `sf-title`, `sf-headline`, `sf-body`, `sf-caption` scale
- **Spacing**: Consistent sm/md/lg/xl/xxl scale
- **Borders**: `apple-md`, `apple-lg` rounded corner variants
- **Effects**: `backdrop-blur-vibrancy`, `card-vibrancy` glass morphism
- **Responsive**: Mobile-first with Tailwind sm/md/lg breakpoints
- **Accessibility**: Contrast ratios, keyboard focus, screen reader labels

---

## 5 Product Lines & Pricing

| Product | Lite | Pro | Enterprise |
|---------|------|-----|------------|
| **API** | $500/mo (10k screens) | $2,000/mo (1M screens) | Custom |
| **Dashboard** | $1,000/mo (3 seats) | $3,000/mo (10 seats) | Custom |
| **SDK** | $1,500/mo (1 env) | $5,000/mo (3 envs) | Custom |
| **iFrame** | $500/mo (1 domain) | $2,000/mo (5 domains) | Custom |
| **Dataset** | $200/mo (1 list) | $500/mo (all lists) | Custom |

---

## Screening Engine (6 Layers)

1. **Exact Match** — Hash-based with normalization (0.1ms)
2. **Fuzzy Match** — Jaro-Winkler distance (1ms)
3. **Phonetic Match** — Soundex + Metaphone (2ms)
4. **Token Match** — Jaccard similarity on name tokens (3ms)
5. **Embedding Match** — Vector cosine similarity via pgvector (10ms)
6. **Graph Match** — Relationship traversal (20ms)

Cascade architecture: short-circuits when confidence exceeds threshold. Each layer adds evidence to the confidence score via weighted scoring.
