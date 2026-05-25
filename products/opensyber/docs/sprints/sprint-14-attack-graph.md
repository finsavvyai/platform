> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 14: Asset Inventory + Attack Path Graph (2 weeks)

## Goal
Build a unified asset inventory covering cloud resources, agent containers, and
secrets — then compute attack paths between them. This is the "Wiz Security
Graph" equivalent: show how a misconfigured S3 bucket + exposed agent credential
= full cloud account compromise. No Neo4j required for MVP.

## Dependencies
- Sprint 11 complete (CSPM findings are graph nodes)
- Sprint 12 complete (secrets are graph nodes)
- Sprint 13 complete (risk scores are node weights)

## Competitive Target
- **Wiz:** Security Graph, attack path analysis, blast radius visualization
- **OpenSyber unique:** Agent containers are first-class graph nodes

---

## ⚡ MVP PATH (5 days) — Attack paths without Neo4j

### MVP.1 — Asset Inventory Schema (Day 1)
```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  entityType TEXT NOT NULL,   -- 'instance' | 'cloud_resource' | 'secret' | 'saas_app'
  entityId TEXT NOT NULL,     -- references the original table's ID
  name TEXT NOT NULL,
  resourceType TEXT,          -- 'EC2' | 'S3' | 'IAMUser' | 'agent' | 'vault_secret'
  provider TEXT,              -- 'aws' | 'gcp' | 'azure' | 'opensyber'
  region TEXT,
  riskScore INTEGER DEFAULT 0,
  isCritical INTEGER DEFAULT 0,  -- manually tagged as critical
  tags TEXT,                     -- JSON key-value pairs
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(orgId, entityType, entityId)
);

CREATE TABLE asset_relations (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  sourceAssetId TEXT NOT NULL REFERENCES assets(id),
  targetAssetId TEXT NOT NULL REFERENCES assets(id),
  relationType TEXT NOT NULL,  -- 'has_access_to' | 'uses_secret' |
                               --   'runs_in' | 'exposes' | 'depends_on'
  weight INTEGER DEFAULT 1,    -- traversal cost (lower = easier to exploit)
  metadata TEXT,               -- JSON: { port, protocol, iamAction }
  createdAt TEXT NOT NULL
);

CREATE TABLE attack_paths (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  sourceAssetId TEXT NOT NULL,  -- attacker entry point (e.g., public internet)
  targetAssetId TEXT NOT NULL,  -- high-value target (e.g., DB or root account)
  pathAssetIds TEXT NOT NULL,   -- JSON array of asset IDs in order
  pathLength INTEGER NOT NULL,
  totalRiskScore INTEGER NOT NULL,
  isActive INTEGER DEFAULT 1,
  computedAt TEXT NOT NULL
);
```
- [ ] Create D1 migration `0014_asset_graph.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — Asset Sync Service (Day 1–2)
- [ ] Create `apps/api/src/services/asset-inventory.ts` (< 200 lines):
  ```typescript
  // Populates assets table from existing data sources
  export async function syncInstanceAssets(orgId): Promise<void>
  export async function syncCloudAssets(cloudAccountId): Promise<void>
  export async function syncSecretAssets(orgId): Promise<void>
  // Creates asset_relations edges
  export async function buildRelations(orgId): Promise<void>
  ```
  - Instance → uses_secret → vault entries (via existing vault records)
  - Instance → runs_in → cloud account
  - CSPM finding "public S3" → exposes → internet
- [ ] Run sync on: instance create, cloud scan complete, secret create
- [ ] `GET /api/assets` — paginated asset list with filters
- [ ] `GET /api/assets/:id/relations` — incoming + outgoing edges

### MVP.3 — BFS Attack Path Computation (Day 2–3)
- [ ] Create `apps/api/src/services/attack-paths.ts` (< 200 lines):
  ```typescript
  // BFS over asset_relations in D1 (no Neo4j needed)
  // Finds all paths from public-facing assets to critical targets
  export async function computeAttackPaths(orgId): Promise<AttackPath[]>
  export async function getPathsToAsset(assetId): Promise<AttackPath[]>
  ```
  - BFS limited to depth 6 (sufficient for 95% of real attack paths)
  - Weight = sum of CVSS scores along path
  - Store top 20 paths per org in `attack_paths` table
- [ ] Recompute paths: after every CSPM scan, hourly cron
- [ ] `GET /api/attack-paths` — list active paths sorted by total risk

### MVP.4 — Attack Path Dashboard (Day 3–5)
- [ ] Create `apps/web/src/app/dashboard/security/attack-paths/page.tsx`:
  - List of attack paths: entry → chain → target, total risk score
  - Click path → expand showing each hop with finding details
  - "Critical paths" badge (paths to high-value targets)
- [ ] Create `components/dashboard/security/AttackPathCard.tsx`:
  - Visual chain: Asset → rel → Asset → rel → Asset
  - Color-coded by severity
  - "Fix all" button (Sprint 17 remediation preview)
- [ ] Add "Attack Paths" to security sidebar
- [ ] Write component tests

---

## 🔵 FULL PATH (12 days) — Full Wiz Security Graph

Everything in MVP plus:

### FULL.1 — Visual Graph Explorer
- [ ] Install React Flow (`@xyflow/react`)
- [ ] Create `components/dashboard/security/SecurityGraph.tsx`:
  - Interactive graph: nodes = assets, edges = relations
  - Node colors: severity-coded (red = critical, yellow = high)
  - Click node → side panel with asset details + findings
  - Filter by: asset type, severity, region
- [ ] Create `app/dashboard/security/graph/page.tsx`
- [ ] Export graph as SVG/PNG for reports

### FULL.2 — Automated Asset Discovery
- [ ] AWS: CloudTrail → real-time asset creation events
- [ ] GCP: Asset Inventory API → full org asset list
- [ ] Azure: Resource Manager → subscription asset enumeration
- [ ] Kubernetes: k8s API → pods, services, ingress, secrets
- [ ] Auto-tag critical assets (databases, secrets stores, IAM admin roles)

### FULL.3 — Blast Radius Analysis
- [ ] "What if this finding is exploited?"
  - Compute all paths FROM a compromised asset
  - Show which critical assets become reachable
- [ ] Blast radius score: count of critical assets reachable
- [ ] "Worst case" scenario: if attacker gains initial access here...

### FULL.4 — Path Comparison
- [ ] Attack path diff: before/after remediation
- [ ] Historical path count trend (are we reducing attack surface?)
- [ ] Path suppression for accepted risks

### FULL.5 — AI Path Narration (Sprint 16 preview)
- [ ] LLM-generated "story" for each attack path
  - "An attacker with network access could exploit CVE-2024-XXX in your exposed
    EC2 instance, access the IAM role mounted there, and escalate to admin
    via the overly permissive S3 bucket policy..."
- [ ] Plain English severity explanation per path

---

## Definition of Done
- [ ] Assets synced from instances + cloud accounts + secrets
- [ ] Attack paths computed via BFS
- [ ] Attack paths visible in dashboard
- [ ] Critical paths trigger notifications
- [ ] Recomputed after each CSPM scan
- [ ] All new services tested (>80% coverage)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Asset sync service | 1.5 | 3 |
| BFS attack path engine | 1 | 2 |
| Dashboard + components | 2 | 4 |
| Graph explorer (React Flow) | — | 1.5 |
| Blast radius + AI narration | — | 1 |
| **Total** | **5** | **12** |
