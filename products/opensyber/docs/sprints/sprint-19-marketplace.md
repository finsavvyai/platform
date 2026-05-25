> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 19: Security Marketplace + Community Ecosystem (2 weeks)

## Goal
Transform the existing skill marketplace into a security-focused ecosystem where
the community can publish custom Prowler checks, remediation playbooks, SaaS
connectors, and compliance packs. This creates a defensible network-effect moat.

## Dependencies
- Sprint 11 complete (Prowler checks are the first marketplace item type)
- Sprint 17 complete (playbooks are the second marketplace item type)
- Sprint 15 complete (SaaS connectors are the third item type)
- Existing skill marketplace (`skills.ts` routes + `skills.ts` service)

## Competitive Target
- **Differentiator:** No competitor has a community marketplace for security checks
- Similar: Panther has community detection rules; OpenSyber expands this model

---

## ⚡ MVP PATH (4 days) — Extend skill marketplace for security items

### MVP.1 — Marketplace Schema Extension (Day 1)
```sql
-- Extend existing skills table with marketplace item types
-- Current: skills for AI agent containers
-- Extended: also covers security checks, playbooks, connectors

ALTER TABLE skills ADD COLUMN itemType TEXT DEFAULT 'agent_skill';
  -- 'agent_skill' | 'prowler_check' | 'remediation_playbook' | 'saas_connector' | 'compliance_pack'

ALTER TABLE skills ADD COLUMN metadata TEXT;
  -- JSON: provider, checkId, frameworks, targetResource, etc.

CREATE TABLE marketplace_submissions (
  id TEXT PRIMARY KEY,
  skillId TEXT NOT NULL REFERENCES skills(id),
  submittedBy TEXT NOT NULL,
  submittedAt TEXT NOT NULL,
  reviewStatus TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected'
  reviewedBy TEXT,
  reviewedAt TEXT,
  reviewNotes TEXT,
  securityScanStatus TEXT,               -- 'pending' | 'clean' | 'flagged'
  securityScanReport TEXT,               -- JSON findings from static analysis
  downloadCount INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  ratingCount INTEGER DEFAULT 0
);

CREATE TABLE marketplace_installs (
  id TEXT PRIMARY KEY,
  skillId TEXT NOT NULL REFERENCES skills(id),
  orgId TEXT NOT NULL,
  installedBy TEXT NOT NULL,
  installedAt TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  config TEXT                            -- JSON: user configuration for this install
);
```
- [ ] Create D1 migration `0019_marketplace.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — Marketplace API Extensions (Day 1–2)
- [ ] Extend `apps/api/src/routes/skills.ts`:
  - `GET    /api/marketplace` — browse all items (skills + security checks + playbooks)
  - `GET    /api/marketplace/:id` — item detail with install count + ratings
  - `POST   /api/marketplace/:id/install` — install item to org
  - `DELETE /api/marketplace/:id/install` — uninstall
  - `POST   /api/marketplace/:id/rate` — 1-5 star rating
- [ ] Security check install behavior:
  - Downloads Prowler check YAML from R2
  - Adds to org's custom check library
  - Runs check on next scheduled scan
- [ ] Playbook install behavior:
  - Adds custom playbook to org's remediation playbooks
  - Available immediately in remediation engine
- [ ] Write tests

### MVP.3 — Publisher Tools (Day 2–3)
- [ ] Create `apps/api/src/routes/marketplace-publish.ts`:
  - `POST   /api/marketplace/publish` — submit new item
  - `GET    /api/marketplace/my-items` — publisher's items
  - `PATCH  /api/marketplace/my-items/:id` — update item
- [ ] Item validation:
  - Prowler check: validate YAML schema
  - Playbook: validate step definitions
  - SaaS connector: validate connector interface
- [ ] Auto-security scan on submission (static analysis of submitted code)
- [ ] Admin moderation queue extension (reuse Sprint 9 admin panel)
- [ ] Write tests

### MVP.4 — Marketplace UI (Day 3–4)
- [ ] Create `apps/web/src/app/marketplace/page.tsx`:
  - Search + filter (by type, provider, compliance framework, rating)
  - Featured items section (curated by OpenSyber team) — seed with pre-verified portfolio skills:
    - `mcpoverflow-connector-gen` — **"Generate an MCP skill from any API spec"** (P1, 2d to package)
      - Users paste any OpenAPI / GraphQL / Postman URL → MCPOverflow generates a deployable skill
      - The "skill factory" meta-skill — unlocks the marketplace flywheel
      - See [`skill-catalog.md`](../skills/skill-catalog.md) for packaging details
    - `tenantiq-m365-security`, `pipewarden-cicd-security`, `finsavvyai-llm-gateway` — launch-day catalog
  - Trending items (most installed last 7 days)
- [ ] Create `apps/web/src/app/marketplace/[id]/page.tsx`:
  - Item detail: description, author, version, last updated
  - Screenshots/demo (video embed)
  - Install count + rating stars
  - "Install to Org" button
  - Related items
- [ ] Create `apps/web/src/app/marketplace/publish/page.tsx`:
  - Multi-step publish wizard (type → metadata → upload → review)
- [ ] Write component tests

---

## 🔵 FULL PATH (10 days) — Full ecosystem with monetization

Everything in MVP plus:

### FULL.1 — Paid Marketplace Items
- [ ] Publisher monetization: set price per item (0 = free)
- [ ] Revenue split: 70% publisher / 30% OpenSyber
- [ ] LemonSqueezy integration for marketplace payments
- [ ] Enterprise site license: all paid items for flat fee

### FULL.2 — OpenSyber Certified Items
- [ ] "Verified by OpenSyber" badge tier
- [ ] Enhanced security review for certified items
- [ ] Guaranteed maintenance SLA
- [ ] Featured placement in marketplace

### FULL.3 — Community Compliance Packs
- [ ] Compliance pack = collection of checks + playbooks + report template
- [ ] Publish: HIPAA Healthcare Pack, PCI-DSS Pack, FedRAMP Pack
- [ ] Community can contribute to packs via GitHub integration
- [ ] Auto-update installed packs when publisher releases new version

### FULL.4 — MSSP Partner Marketplace
- [ ] White-label marketplace for MSSPs
- [ ] Partner-exclusive items (not available to end customers)
- [ ] Revenue sharing dashboard for MSSP partners

### FULL.5 — Developer SDK
- [ ] `@opensyber/sdk` npm package:
  - TypeScript types for all marketplace item interfaces
  - Local development + testing harness
  - CLI: `opensyber publish` / `opensyber test-check`
- [ ] Developer documentation site
- [ ] Example items repository on GitHub

---

## ⚡ Webhooks + Agent Blueprints (3 days — add to either path)

### WEBHOOKS — Security Events as Outbound API

Every security event becomes a subscribable webhook so customers can wire
OpenSyber into Slack bots, SOAR platforms, Zapier/Make, Splunk, or their own
internal tools without waiting for a native integration.

- [ ] Schema:

  ```sql
  CREATE TABLE webhook_subscriptions (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,          -- HMAC-SHA256 signing key (stored hashed)
    events TEXT NOT NULL,          -- JSON: ['finding.created', 'risk_score.changed']
    isActive INTEGER DEFAULT 1,
    failureCount INTEGER DEFAULT 0,
    lastDeliveredAt TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    subscriptionId TEXT NOT NULL REFERENCES webhook_subscriptions(id),
    event TEXT NOT NULL,
    payload TEXT NOT NULL,         -- JSON body sent
    statusCode INTEGER,
    responseBody TEXT,
    attemptCount INTEGER DEFAULT 1,
    deliveredAt TEXT,
    nextRetryAt TEXT
  );
  ```

- [ ] Events emitted:
  - `finding.created` / `finding.resolved` / `finding.muted`
  - `risk_score.changed` (include previous + new score)
  - `attack_path.detected` / `attack_path.resolved`
  - `jit_access.requested` / `jit_access.approved`
  - `remediation.completed` / `remediation.failed`
  - `compliance.score_changed`
  - `scan.completed`
- [ ] Create `apps/api/src/routes/webhooks-platform.ts`:
  - `GET    /api/webhooks` — list subscriptions
  - `POST   /api/webhooks` — create subscription
  - `DELETE /api/webhooks/:id` — delete
  - `POST   /api/webhooks/:id/test` — send test event
  - `GET    /api/webhooks/:id/deliveries` — delivery history
- [ ] Delivery: async via existing Cloudflare Queue (retry on failure, exponential backoff)
- [ ] HMAC-SHA256 `X-OpenSyber-Signature` header on every delivery
- [ ] Webhook UI in dashboard settings
- [ ] Write tests

### BLUEPRINTS — Agent Deployment Templates

Pre-configured agent + skill bundles deployable in 60 seconds:

- [ ] Add `blueprint` item type to marketplace schema (`itemType: 'blueprint'`)
- [ ] Blueprint manifest: name + description + skill list + default config
- [ ] Create 5 first-party blueprints:
  - `aws-security-agent` — prowler-aws-cspm + vault-rotation + ai-compliance
  - `m365-security-agent` — tenantiq-m365-security + ai-compliance
  - `full-cloud-security` — all CSPM skills + attack-path-analyzer
  - `compliance-ready` — soc2-evidence-collector + ai-compliance + all CSPM
  - `dev-security-agent` — github-posture + vault-rotation + cicd-gate
- [ ] "Deploy from Blueprint" button:
  - Creates agent container
  - Installs all skills in blueprint
  - Pre-configures with org's connected cloud accounts / SaaS
  - Runs first scan immediately
- [ ] Blueprint page in marketplace with preview of included skills
- [ ] Write tests

---

## Definition of Done

- [ ] Marketplace shows skills + security checks + playbooks
- [ ] Install/uninstall works for all item types
- [ ] Custom Prowler checks activate on next scan after install
- [ ] Publisher submit flow + admin moderation working
- [ ] Item rating system working
- [ ] All new routes tested (>80% coverage)

## Estimated Effort

| Task | MVP Days | Full Days |
|---|---|---|
| Schema extension | 0.5 | 0.5 |
| Marketplace API extensions | 1 | 2 |
| Publisher tools | 1 | 2 |
| Marketplace UI | 1.5 | 3 |
| Monetization + packs + SDK | — | 2.5 |
| **Total** | **4** | **10** |
