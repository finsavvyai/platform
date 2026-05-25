> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 22: Platform Data Layer — GraphQL API + Compliance Portal + Security Score (2 weeks)

## Goal
Three platform bets that each open a new revenue surface: a public GraphQL API
(developers build on OpenSyber), a shareable Compliance Trust Portal (replaces
Drata/Vanta for customers), and a public Security Score API (network-effect
growth engine). Together they make OpenSyber the infrastructure layer for
enterprise security — not just a dashboard.

## Dependencies
- Sprint 20 complete (SOC2 evidence as data source for compliance portal)
- Sprint 13 complete (risk scores as data for score API)
- Sprint 14 complete (attack paths available via GraphQL)
- Sprint 15 complete (SaaS findings available via GraphQL)

## Competitive Target
- **GraphQL API:** No competitor exposes security data as a developer API
- **Compliance Portal:** Competes with Drata, Vanta, SecureFrame ($50M+ market)
- **Score API:** New category — public security posture scoring (network effect)

---

## ⚡ MVP PATH (5 days)

### MVP.1 — GraphQL API (Day 1–2)

A clean, versioned read API over all security data. Developers build their own
dashboards, CI/CD checks, BI queries, and internal tools on top.

```graphql
# Schema excerpt
type Query {
  org(id: ID!): Organization
}

type Organization {
  id: ID!
  riskScore: RiskScore!
  cspmFindings(
    severity: Severity
    status: FindingStatus
    provider: CloudProvider
    limit: Int
    cursor: String
  ): FindingConnection!
  attackPaths(target: String, maxPaths: Int): [AttackPath!]!
  compliance(framework: ComplianceFramework!): ComplianceResult!
  assets(type: AssetType, limit: Int, cursor: String): AssetConnection!
  saasFindings(provider: SaasProvider, severity: Severity): [SaasFinding!]!
}

type RiskScore {
  score: Int!           # 0-100
  grade: String!        # A-F
  trend: Trend!
  breakdown: RiskBreakdown!
  computedAt: DateTime!
}
```

- [ ] Install `graphql-yoga` (Cloudflare Workers compatible)
- [ ] Create `apps/api/src/graphql/schema.ts` — type definitions
- [ ] Create `apps/api/src/graphql/resolvers/` — one file per type (< 200 lines each)
- [ ] Create `apps/api/src/routes/graphql.ts`:
  - `POST /api/graphql` — GraphQL endpoint
  - `GET  /api/graphql` — GraphiQL explorer (dev only)
- [ ] Auth: API key (`X-OpenSyber-Key`) or user JWT
- [ ] Field-level permission checks (viewer can't query secrets)
- [ ] Rate limiting: 100 req/min Free, 1000/min Pro, unlimited Enterprise
- [ ] Write resolver tests with mock data

### MVP.2 — Compliance Trust Portal (Day 2–3)

A publicly shareable URL that proves your security posture in real-time.
Replaces PDFs and self-attested questionnaires.

```sql
CREATE TABLE trust_portals (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,     -- trust.opensyber.cloud/acme-corp
  isPublic INTEGER DEFAULT 0,    -- 0 = private link only, 1 = indexed
  customDomain TEXT,             -- trust.acme-corp.com (Pro+)
  title TEXT NOT NULL,           -- "Acme Corp Security Trust Center"
  description TEXT,
  showRiskScore INTEGER DEFAULT 1,
  showFrameworks TEXT,           -- JSON: ['soc2', 'iso27001']
  showLastAuditDate INTEGER DEFAULT 1,
  showUptimeHistory INTEGER DEFAULT 1,
  accentColor TEXT DEFAULT '#3b82f6',
  logoUrl TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

- [ ] Create `apps/api/src/routes/trust-portal.ts`:
  - `GET    /api/trust-portal` — get org's portal config
  - `PUT    /api/trust-portal` — update portal config
  - `GET    /api/trust-portal/data` — get portal data (public, rate limited)
  - `POST   /api/trust-portal/share` — generate shareable link
- [ ] Create public portal page: `apps/web/src/app/trust/[slug]/page.tsx`:
  - Live compliance status per framework (green/amber/red)
  - Current risk grade (A–F)
  - Uptime history chart (90-day)
  - Last security scan date
  - Certifications / badges
  - "Request security review" contact form
- [ ] Trust portal config page in dashboard settings
- [ ] Embed snippet: `<iframe src="https://trust.opensyber.cloud/acme-corp" />`
- [ ] Write tests

### MVP.3 — Security Score Public API (Day 3–4)

```typescript
// Public endpoint — no auth required for basic score
// Returns cached score, updates every 24h for opted-in orgs
// GET /api/v1/public/score?domain=acme-corp.com

interface PublicScoreResponse {
  domain: string
  score: number           // 0-100
  grade: string           // A-F
  lastUpdated: string     // ISO date
  isVerified: boolean     // verified OpenSyber customer
  breakdown?: {           // only if org opts in to detailed sharing
    cloudSecurity: number
    identitySecurity: number
    saasSecurity: number
    compliancePosture: number
  }
  trustPortalUrl?: string // link to full trust portal if public
}
```

- [ ] Create `apps/api/src/routes/public-score.ts`:
  - `GET /api/v1/public/score` — look up score by domain
  - `GET /api/v1/public/score/batch` — batch lookup (max 10 domains)
  - Rate limit: 10 req/min unauthenticated, 100/min with API key
- [ ] Opt-in setting in dashboard: "Share my security score publicly"
- [ ] Score lookup by domain: match against org's verified domain
- [ ] Domain verification: DNS TXT record or file upload
- [ ] Cached in KV with 24h TTL
- [ ] Write tests

### MVP.4 — Developer Experience (Day 4–5)

- [ ] API documentation page: `apps/web/src/app/docs/api/page.tsx`
  - GraphQL schema explorer (embedded GraphiQL)
  - REST endpoint reference
  - Authentication guide
  - Code examples: TypeScript, Python, curl
- [ ] API key management page in dashboard settings:
  - Create / revoke API keys
  - Scope: read-only vs read-write
  - Usage stats per key (req count, last used)
- [ ] SDKs (thin wrappers, generated from schema):
  - `packages/opensyber-sdk/` — TypeScript SDK
  - Python SDK (future, community)
- [ ] Write SDK tests

---

## 🔵 FULL PATH (12 days) — Complete platform layer

Everything in MVP plus:

### FULL.1 — GraphQL Subscriptions (Real-time)

- [ ] GraphQL subscription via WebSocket / SSE:
  ```graphql
  subscription {
    findingCreated(orgId: "org_xxx") {
      id severity title resourceId
    }
    riskScoreChanged(orgId: "org_xxx") {
      newScore previousScore trend
    }
  }
  ```
- [ ] Durable Objects for subscription state (reuse existing SSE infra)
- [ ] SDK: `opensyber.subscribe('finding.created', handler)`

### FULL.2 — Compliance Trust Portal — Premium Features

- [ ] Custom domain (CNAME to `trust.opensyber.cloud`)
- [ ] White-label: remove OpenSyber branding (Enterprise plan)
- [ ] Questionnaire auto-fill: vendor security questionnaire integration
  - CAIQ (Cloud Security Alliance)
  - SIG (Standardized Information Gathering)
  - Custom questionnaire templates
- [ ] Evidence request portal: auditor requests specific controls → org responds

### FULL.3 — Security Score Ecosystem

- [ ] Score badge for GitHub README:
  ```markdown
  [![Security Score](https://api.opensyber.cloud/badge/acme-corp)](https://trust.opensyber.cloud/acme-corp)
  ```
- [ ] Procurement integration: verify supplier score before onboarding
- [ ] Insurance integration: share score with cyber insurance underwriters
- [ ] Score leaderboard (opt-in): "Top-rated startups by security posture"

### FULL.4 — BI + Analytics Integrations

- [ ] Looker Studio connector: query OpenSyber data in Google Looker
- [ ] Tableau connector: OpenSyber as a Tableau data source
- [ ] Datadog / Splunk: push security metrics as custom metrics
- [ ] dbt integration: expose findings data as dbt source

### FULL.5 — Monetization Layer

- [ ] GraphQL API: usage-based billing (requests beyond plan limit)
- [ ] Trust Portal: custom domain = Pro+ feature
- [ ] Score API: bulk lookups = paid API product
- [ ] SDK: free, but advanced features gated to Pro+

### FULL.6 — Security Health Check Report (Monthly PDF + Email)

Identified gap from CNSP competitive analysis: CyberArk and Wiz both offer periodic security
health reports. This is a key enterprise retention and upsell feature — customers forward the
report to their CISO, which expands awareness and justifies renewal.

**Schema addition:**

```sql
CREATE TABLE health_check_reports (
  id        TEXT PRIMARY KEY,
  orgId     TEXT NOT NULL,
  period    TEXT NOT NULL,           -- '2026-03', '2026-04' (YYYY-MM)
  status    TEXT DEFAULT 'pending',  -- pending | generating | ready | failed
  pdfUrl    TEXT,                    -- R2 signed URL to generated PDF
  summary   TEXT,                    -- JSON: { riskTrend, topFindings, remediatedCount, ... }
  sentAt    TEXT,                    -- when email was dispatched
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Implementation tasks:**

- [ ] Create `apps/api/src/services/health-check-report.ts` (< 200 lines):
  - Collect: org risk score trend (last 30 days), top 5 unresolved findings, findings resolved this month, new assets discovered, compliance posture delta
  - Generate: PDF via `@react-pdf/renderer` (reuse SOC2 evidence PDF pattern from Sprint 20)
  - Store: upload to R2, save signed URL in `health_check_reports`
- [ ] Cron trigger: `0 9 1 * *` (9am on 1st of every month) via Cloudflare Cron Triggers
- [ ] Email delivery: Resend API → "Your March Security Health Report is ready"
  - Attach PDF summary
  - Link to full interactive report in dashboard
  - Plain-text executive summary (3 bullet points)
- [ ] Dashboard page: `apps/web/src/app/dashboard/reports/page.tsx`
  - Report history (last 12 months)
  - Download PDF per report
  - Share link (token-gated for auditors)
- [ ] API routes:
  - `GET  /api/reports` — list reports for org
  - `GET  /api/reports/:id` — single report + PDF download URL
  - `POST /api/reports/generate` — manual trigger (Pro+ only)
- [ ] Write tests (>80% coverage)

**Pricing gate:** Monthly reports auto-delivered on Pro + Enterprise plans. Free plan: on-demand only (1 report/month manually triggered).

---

## Definition of Done

- [ ] GraphQL API returning real data for all query types
- [ ] Trust portal publicly shareable with live data
- [ ] Security score API returning verified domain scores
- [ ] API key management in dashboard
- [ ] TypeScript SDK published to npm
- [ ] All new endpoints tested (>80% coverage)

## Estimated Effort

| Task | MVP Days | Full Days |
|---|---|---|
| GraphQL schema + resolvers | 2 | 3.5 |
| Compliance trust portal | 1.5 | 3 |
| Security score public API | 1 | 2 |
| Developer docs + SDK + API keys | 0.5 | 1.5 |
| Subscriptions + BI integrations | — | 2 |
| **Total** | **5** | **12** |
