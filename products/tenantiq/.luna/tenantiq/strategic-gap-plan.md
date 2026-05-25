# TenantIQ Strategic Gap Plan

**Date:** April 3, 2026
**Scope:** Address critical gaps from competitive analysis
**Status:** Draft

---

## Gap 1: CIS Controls Expansion (19 → 100+) — P1

### Current State
- 19 controls in `apps/api/src/lib/cis/control-definitions.ts` (350 lines)
- Sections covered: Identity (7), Application (2), Data (3), Email (3), Audit (2), CI/CD (1), Custom (1)
- CIS M365 Benchmark v3.1 has ~180 controls total

### Architecture
The control system is well-designed for expansion — each control is a data object with `id`, `section`, `graphCheck`, `expectedValue`, `severity`, `autoRemediable`. The scanner (`scanner.ts`) iterates the array and evaluates each. No code changes needed to the evaluation engine — just add control definitions.

### Implementation Plan

**Phase A — Core CIS sections (→ 60 controls)**
Add controls for sections currently underrepresented:

| Section | Current | Target | Focus Areas |
|---------|---------|--------|-------------|
| Identity (1.x) | 7 | 15 | PIM, sign-in risk, token lifetime, named locations |
| Application (2.x) | 2 | 10 | App registration limits, service principal hygiene, OAuth consent |
| Data (3.x) | 3 | 12 | Information barriers, retention policies, Teams DLP, OneDrive sharing |
| Email (4.x) | 3 | 10 | Safe attachments, safe links, anti-spam, mail flow rules |
| Audit (5.x) | 2 | 8 | Mailbox auditing, sign-in logs retention, diagnostic settings |
| Device (new 6.x) | 0 | 5 | Intune enrollment, compliance policies, BitLocker |

**Files to modify:**
- Split `control-definitions.ts` (currently 350 lines) into per-section files:
  - `controls/identity.ts`
  - `controls/application.ts`
  - `controls/data.ts`
  - `controls/email.ts`
  - `controls/audit.ts`
  - `controls/device.ts`
  - `controls/index.ts` (re-exports combined array)

**Phase B — Graph check implementations (→ 80 controls)**
Many new controls need new Graph API queries. Group by Graph endpoint:
- `/policies/conditionalAccessPolicies` — 15 controls (CA policy checks)
- `/identityGovernance/` — 5 controls (PIM, access reviews)
- `/deviceManagement/` — 5 controls (Intune/compliance)
- `/security/` — 5 controls (secure score, alerts config)
- Add check functions to `scanner.ts` or extract into `checks/` directory

**Phase C — Full benchmark (→ 100+ controls)**
- Exchange Online (mail transport rules, journal rules)
- SharePoint/OneDrive (advanced sharing, conditional access for SPO)
- Teams (meeting policies, messaging policies, external access)
- Compliance Center (retention, eDiscovery, communication compliance)

### Effort: 3-4 weeks
### Dependencies: None — purely additive

---

## Gap 2: PSA/RMM Integrations — P1

### Current State
- Zero PSA/RMM integration code exists
- Settings page has webhook configuration (Slack/Teams/Discord) — good foundation
- DB schema has no `integrations` or `psa_connections` table

### Target Integrations
1. **ConnectWise Manage** (highest MSP adoption)
2. **Datto Autotask** (second largest)
3. **Kaseya BMS** (third)

### Architecture Proposal

**New package:** `packages/integrations/`
```
packages/integrations/
├── src/
│   ├── types.ts           # PSAIntegration, PSATicket, PSAClient interfaces
│   ├── connectwise/
│   │   ├── client.ts      # ConnectWise REST API client
│   │   ├── ticket-sync.ts # Create/update tickets from TenantIQ alerts
│   │   ├── company-sync.ts # Sync companies ↔ tenants
│   │   └── types.ts
│   ├── autotask/
│   │   ├── client.ts
│   │   ├── ticket-sync.ts
│   │   └── types.ts
│   └── index.ts
```

**DB schema additions** (`packages/db/src/schema-d1.ts`):
```sql
-- PSA connections per org
CREATE TABLE psa_connections (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL, -- 'connectwise' | 'autotask' | 'kaseya'
  api_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  company_id TEXT,
  sync_enabled INTEGER DEFAULT 1,
  last_sync_at TEXT,
  created_at TEXT NOT NULL
);

-- Tenant ↔ PSA company mapping
CREATE TABLE psa_tenant_mappings (
  id TEXT PRIMARY KEY,
  psa_connection_id TEXT NOT NULL REFERENCES psa_connections(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  psa_company_id TEXT NOT NULL,
  psa_company_name TEXT,
  created_at TEXT NOT NULL
);

-- Ticket sync tracking
CREATE TABLE psa_tickets (
  id TEXT PRIMARY KEY,
  psa_connection_id TEXT NOT NULL REFERENCES psa_connections(id),
  alert_id TEXT REFERENCES alerts(id),
  psa_ticket_id TEXT NOT NULL,
  status TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
```

**API routes** (`apps/api/src/routes/integrations.ts`):
- `GET /api/integrations` — list connections
- `POST /api/integrations` — add PSA connection (validate credentials)
- `DELETE /api/integrations/:id` — remove connection
- `POST /api/integrations/:id/test` — test connectivity
- `POST /api/integrations/:id/sync-companies` — sync companies
- `GET /api/integrations/:id/mappings` — tenant ↔ company mappings
- `POST /api/integrations/:id/mappings` — map tenant to company

**Frontend** (`apps/web/src/routes/settings/integrations/+page.svelte`):
- PSA connection wizard
- Company ↔ tenant mapping grid
- Sync status dashboard

**Cron** (`apps/api/src/cron/psa-ticket-sync.ts`):
- Every 15 min: sync new critical/high alerts → PSA tickets
- Update ticket status when alert is resolved

### ConnectWise API Surface
- Auth: API key + company ID + client ID
- Create ticket: `POST /service/tickets`
- Update ticket: `PATCH /service/tickets/{id}`
- List companies: `GET /company/companies`
- Webhook support for bidirectional sync

### Effort: 4-5 weeks (ConnectWise first, then Autotask)
### Dependencies: DB migration, KV for encrypted credential storage

---

## Gap 3: Workflow Templates Expansion — P1

### Current State
- 4 trigger types: `scheduled`, `manual`, `event`, `conditional`
- Workflow model: name, description, trigger, actions (JSON), enabled flag
- No visual builder, no pre-built templates
- 10 Graph operations available (user enable/disable, group, license, etc.)

### Implementation Plan

**Phase A — Template library (4 → 25 templates)**
Create `apps/api/src/lib/workflows/templates/` with JSON template definitions:

| Category | Templates | Count |
|----------|-----------|-------|
| User Lifecycle | Offboard user, Onboard user, Convert to shared mailbox, Revoke sessions, Reset password | 5 |
| License Mgmt | Reclaim unused license, Downgrade inactive user, Bulk assign licenses, License expiry alert | 4 |
| Security | Disable compromised account, Block risky sign-in, Rotate admin credentials, Force MFA registration | 4 |
| Compliance | Weekly CIS scan, Monthly compliance report, Config drift alert, Retention policy check | 4 |
| Governance | Guest access review, Stale group cleanup, SharePoint permissions audit, Teams policy enforcement | 4 |
| Cost Optimization | Monthly license audit, Storage quota alert, Unused app detection, Savings report | 4 |

**Phase B — Template marketplace UI**
- `apps/web/src/routes/workflows/templates/+page.svelte` — browsable template gallery
- One-click install: pre-fills workflow form with template defaults
- Category filters, search

**Phase C — Visual builder (future — Q3)**
- Drag-and-drop step editor using existing action primitives
- Conditional branching (if/then/else)
- Multi-step workflows with approval gates
- This is a larger effort (~8 weeks) and should follow templates

### Effort: 2-3 weeks for phases A+B
### Dependencies: None — builds on existing workflow system

---

## Execution Timeline

```
April 2026 (W1-W2):  CIS Controls Phase A (→ 60 controls)
April 2026 (W3-W4):  PSA Integration — ConnectWise MVP
May 2026 (W1-W2):    CIS Controls Phase B+C (→ 100+ controls)
May 2026 (W3):       Workflow Templates (25 pre-built)
May 2026 (W4):       PSA Integration — Autotask
June 2026 (W1-W2):   Visual Workflow Builder
June 2026 (W3-W4):   Polish, testing, documentation
```

### Success Criteria
- [ ] 100+ CIS controls with live Graph API checks
- [ ] ConnectWise Manage bidirectional ticket sync
- [ ] Autotask bidirectional ticket sync
- [ ] 25+ workflow templates in marketplace
- [ ] All new features have >90% test coverage
- [ ] Marketing materials updated to reflect actual capabilities
