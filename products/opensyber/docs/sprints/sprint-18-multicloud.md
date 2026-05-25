> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 18: Multi-Cloud Connector Framework (2.5 weeks)

## Goal
Elevate Sprint 11's single-account AWS connector into a full multi-cloud
framework supporting AWS Organizations, GCP projects, Azure subscriptions, and
Kubernetes clusters — all managed through a single connector hub. Also adds
cloud network topology discovery for richer attack graph nodes.

## Dependencies
- Sprint 11 complete (CSPM foundation — this is a deep extension)
- Sprint 14 complete (asset graph extended with topology)
- Sprint 17 complete (remediation can now act on multi-cloud assets)

## Competitive Target
- **Wiz:** Full multi-cloud coverage, agentless, AWS Organizations support
- Matches Wiz's breadth; OpenSyber unique: AI agent containers as first-class nodes

---

## ⚡ MVP PATH (5 days) — AWS Organizations + GCP project support

### MVP.1 — Multi-Account Schema Extension (Day 1)
```sql
-- Extend cloud_accounts with org-level connectors
ALTER TABLE cloud_accounts ADD COLUMN parentAccountId TEXT;  -- for sub-accounts
ALTER TABLE cloud_accounts ADD COLUMN accountType TEXT DEFAULT 'single';
  -- 'single' | 'management' | 'member' (AWS Org)

CREATE TABLE cloud_topology (
  id TEXT PRIMARY KEY,
  cloudAccountId TEXT NOT NULL REFERENCES cloud_accounts(id),
  orgId TEXT NOT NULL,
  resourceType TEXT NOT NULL,   -- 'vpc' | 'subnet' | 'security_group' | 'load_balancer'
  resourceId TEXT NOT NULL,
  resourceName TEXT,
  region TEXT NOT NULL,
  cidr TEXT,
  isPublic INTEGER DEFAULT 0,
  parentResourceId TEXT,        -- e.g., subnet's VPC
  metadata TEXT,                -- JSON: tags, attributes
  discoveredAt TEXT NOT NULL,
  UNIQUE(cloudAccountId, resourceType, resourceId)
);
```
- [ ] Create D1 migration `0018_multicloud.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/cspm.ts`

### MVP.2 — AWS Organizations Connector (Day 1–2)
- [ ] Extend `prowler.ts` service:
  - `listMemberAccounts(managementRoleArn)` — AWS Organizations API
  - `onboardAllMemberAccounts(orgId)` — bulk connect sub-accounts
  - `crossAccountScan(memberArns[])` — parallel Prowler scan per account
- [ ] Management account UI: "Connect AWS Organization" flow
  - CloudFormation StackSet template for cross-account IAM roles
  - Auto-discover and register all member accounts
- [ ] Parallel scan execution (limit: 5 concurrent, queue the rest)

### MVP.3 — GCP + Azure Extension (Day 2–3)
- [ ] Create `apps/api/src/services/cloud-connectors/gcp.ts` (< 200 lines):
  - Service Account with `roles/viewer` + `roles/securityreviewer`
  - Project-level and folder-level discovery
  - Run Prowler GCP checks
- [ ] Create `apps/api/src/services/cloud-connectors/azure.ts` (< 200 lines):
  - App registration with Reader role on subscription
  - Management Group traversal for enterprise
  - Run Prowler Azure checks
- [ ] Update ConnectCloudAccountModal with step-by-step guides per provider

### MVP.4 — Network Topology Discovery (Day 3–5)
- [ ] Create `apps/api/src/services/topology-discovery.ts` (< 200 lines):
  - AWS: enumerate VPCs, subnets, security groups, load balancers, internet gateways
  - Detect public-facing resources (IGW attachment + 0.0.0.0/0 routes)
  - Store in `cloud_topology` table
- [ ] Sync topology assets into asset graph (Sprint 14)
  - Add topology resources as asset nodes
  - Create `exposes` edges for public-facing resources
- [ ] Update attack path BFS with network topology context
- [ ] Write tests for topology discovery

---

## 🔵 FULL PATH (14 days) — Full cloud coverage

Everything in MVP plus:

### FULL.1 — Kubernetes Connector
- [ ] Create `apps/api/src/services/cloud-connectors/kubernetes.ts` (< 200 lines):
  - Service account token auth + RBAC audit permission
  - Checks: privileged containers, host network, public services,
    RBAC overpermission, network policy missing, secrets in env vars
- [ ] Kubernetes workload as asset graph nodes
- [ ] Pod network exposure detection

### FULL.2 — Agentless Container Scanning
- [ ] ECR / GCR / ACR image vulnerability scan (via Trivy)
- [ ] Lambda function vulnerability scan
- [ ] Serverless function permission analysis

### FULL.3 — Network Security Analysis
- [ ] Security group analysis: find overly permissive ingress rules
- [ ] Peering and transit gateway mapping
- [ ] Load balancer exposure: HTTP vs HTTPS, TLS version
- [ ] WAF coverage check: is there a WAF in front of public endpoints?
- [ ] Visualize network topology in attack graph

### FULL.4 — Cost + Security Correlation
- [ ] Identify unused resources (zombie VMs, orphaned disks) that expand attack surface
- [ ] Highlight resources with both cost waste AND security risk
- [ ] "Kill two birds" recommendations: save money AND reduce risk

### FULL.5 — Compliance per Cloud Account
- [ ] Per-account compliance score (CIS L1/L2)
- [ ] Compliance drift: alert when score drops after config change
- [ ] Multi-account compliance roll-up for management view

---

## Definition of Done
- [ ] AWS Organizations bulk connect working
- [ ] GCP project connect working
- [ ] Azure subscription connect working
- [ ] Network topology discovered and in asset graph
- [ ] Multi-account scan results aggregated in dashboard
- [ ] All connectors tested (>80% coverage)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema extension | 0.5 | 0.5 |
| AWS Organizations connector | 1.5 | 2 |
| GCP + Azure extensions | 1.5 | 3 |
| Topology discovery | 1.5 | 2 |
| K8s + agentless scanning | — | 3 |
| Network analysis + cost correlation | — | 3.5 |
| **Total** | **5** | **14** |
