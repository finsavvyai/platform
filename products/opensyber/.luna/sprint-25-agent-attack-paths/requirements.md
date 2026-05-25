# Sprint 25: Agent Attack Paths — Requirements

**Sprint:** 25
**Focus:** Agent-specific blast radius visualization
**Duration:** ~3 weeks (May-June 2026)
**Depends on:** Sprint 24 (Agent Security Platform + Thin CSPM)

---

## 1. Problem Statement

Enterprise CISOs need to answer: "If an AI coding agent is compromised, what can the attacker reach?"

Today, OpenSyber monitors what agents DO (runtime behavior from Sprint 23-24). Sprint 25 adds what agents COULD DO — the theoretical blast radius given their inherited credentials and accessible resources.

No competitor offers AI-agent-specific attack path visualization. CyberArk covers agent identity. Wiz/Google covers generic cloud graphs. OpenSyber uniquely connects agent runtime sessions to reachable assets.

---

## 2. Target Users

| Role | Need |
|---|---|
| CISO | "Show me the blast radius if our Cursor agent is compromised" |
| Security Engineer | "Which crown jewels are reachable from this agent session?" |
| DevOps Lead | "Which developer's agent has the widest attack surface?" |
| Compliance Officer | "Prove that our agents can't reach production databases" |

---

## 3. Functional Requirements

### 3.1 Asset Discovery & Inventory

**FR-3.1.1:** System SHALL discover and catalog assets from:
- Agent activity logs (files read/written, env vars accessed, commands executed)
- CSPM scan results (S3 buckets, RDS instances, EC2 instances, IAM roles)
- Cloud account configurations (from Sprint 24 cloud_accounts)

**FR-3.1.2:** Asset types SHALL include:
- `file` — local filesystem paths (e.g., ~/.aws/credentials, .env, *.pem)
- `env_var` — environment variables (e.g., AWS_SECRET_ACCESS_KEY, DATABASE_URL)
- `cloud_resource` — AWS/GCP/Azure resources (S3 bucket, RDS, EC2, Lambda, etc.)
- `secret` — secrets in vaults or config files (API keys, tokens, passwords)
- `saas_app` — SaaS applications accessible via tokens (GitHub, Slack, etc.)
- `database` — database instances and tables
- `agent_session` — AI agent runtime sessions (the entry point)

**FR-3.1.3:** Each asset SHALL have:
- Unique ID, org-scoped
- Asset type, name, and identifier (ARN, path, URL)
- Sensitivity level: `critical` | `high` | `medium` | `low` | `info`
- Crown jewel flag (boolean — marks the most sensitive assets)
- Metadata JSON (type-specific details)
- Discovery source (agent_activity | cspm_scan | manual | cloud_config)
- First seen / last seen timestamps

### 3.2 Asset Relations (Graph Edges)

**FR-3.2.1:** System SHALL model directed relationships between assets:
- `read_access` — source can read target
- `write_access` — source can write to target
- `execute_access` — source can execute target
- `secret_access` — source can retrieve target secret
- `network_access` — source can reach target over network
- `inherits_from` — source inherits permissions from target (e.g., IAM role assumption)
- `contains` — target is contained within source (e.g., bucket contains objects)
- `authenticates_to` — source uses credentials to authenticate to target

**FR-3.2.2:** Relations SHALL be:
- Directed (source → target)
- Typed (one of the relation types above)
- Confidence-scored (0.0–1.0, how certain we are the relation exists)
- Discovery-sourced (agent_log | cspm_finding | iam_policy | inferred)
- Timestamped (first seen, last verified)

**FR-3.2.3:** Relations SHALL be auto-discovered from:
- Agent activity: file reads → `read_access`, bash commands → `execute_access`
- CSPM findings: open S3 → `read_access` from internet, IAM policies → role relations
- AWS IAM policy analysis: role → resource permission mapping
- Environment variables: DATABASE_URL → `authenticates_to` database

### 3.3 Attack Path Engine (BFS/DFS Traversal)

**FR-3.3.1:** System SHALL compute attack paths using BFS from any entry point (agent session) to all reachable assets.

**FR-3.3.2:** Attack path query SHALL accept:
- Entry point: agent session ID or asset ID
- Max depth (default: 10, max: 20)
- Minimum confidence threshold (default: 0.5)
- Filter by target asset type or sensitivity
- Filter by relation type

**FR-3.3.3:** Attack path result SHALL return:
- List of reachable assets with hop count
- Full path (sequence of assets + relations) for each reachable asset
- Blast radius summary: count by asset type, count by sensitivity
- Crown jewels reached (critical assets in the path)
- Total blast radius score (0-100, higher = more exposure)

**FR-3.3.4:** System SHALL identify "crown jewel paths" — shortest paths from agent session to each crown jewel asset.

### 3.4 Blast Radius Visualization

**FR-3.4.1:** Dashboard SHALL render an interactive graph visualization showing:
- Agent session as the center node
- Reachable assets as connected nodes (color-coded by sensitivity)
- Edges showing relation types (labeled, directional arrows)
- Crown jewels highlighted with distinct visual treatment
- Hop distance shown as concentric rings

**FR-3.4.2:** Visualization SHALL support:
- Zoom, pan, and node dragging
- Click on node to see asset details
- Click on edge to see relation details
- Filter by asset type, sensitivity, or relation type
- Collapse/expand node groups
- Export as PNG/SVG

**FR-3.4.3:** Visualization SHALL render in < 2 seconds for up to 1,000 assets and 5,000 edges.

**FR-3.4.4:** Summary panel alongside the graph SHALL show:
- Total assets reachable
- Crown jewels at risk
- Blast radius score
- Top 5 most critical paths
- Recommendations to reduce blast radius

### 3.5 API Endpoints

**FR-3.5.1:** Asset CRUD:
- `GET /api/v1/assets` — list assets (paginated, filtered)
- `GET /api/v1/assets/:id` — get asset details
- `POST /api/v1/assets` — create/register asset manually
- `PUT /api/v1/assets/:id` — update asset (e.g., mark as crown jewel)
- `DELETE /api/v1/assets/:id` — remove asset

**FR-3.5.2:** Asset Relations:
- `GET /api/v1/assets/:id/relations` — list relations for an asset
- `POST /api/v1/asset-relations` — create relation manually
- `DELETE /api/v1/asset-relations/:id` — remove relation

**FR-3.5.3:** Attack Paths:
- `POST /api/v1/attack-paths/query` — compute attack paths from entry point
- `GET /api/v1/attack-paths/blast-radius/:sessionId` — blast radius for agent session
- `GET /api/v1/attack-paths/crown-jewels` — list all crown jewel paths

### 3.6 Asset Discovery Pipeline

**FR-3.6.1:** System SHALL run asset discovery automatically:
- After each agent activity sync (extract files, env vars, commands)
- After each CSPM scan completion (extract cloud resources)
- On cloud account connection (initial inventory)

**FR-3.6.2:** Discovery SHALL be idempotent — re-discovering the same asset updates `lastSeen` without duplicating.

**FR-3.6.3:** Stale assets (not seen in 30 days) SHALL be marked `stale` but not deleted.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Graph query (BFS, 1000 nodes, depth 10): < 500ms
- Visualization render (1000 nodes, 5000 edges): < 2s
- Asset discovery pipeline (per sync): < 5s
- API response times: < 200ms for CRUD, < 1s for graph queries

### 4.2 Scale
- Up to 10,000 assets per organization
- Up to 50,000 relations per organization
- Up to 100 concurrent graph queries

### 4.3 Security
- All endpoints require authentication + RBAC (`cloud.read` for queries, `cloud.write` for mutations)
- Asset data is org-scoped — no cross-org data leakage
- Sensitive asset metadata (secret values, credentials) SHALL NOT be stored — only references
- Crown jewel designation requires `cloud.admin` permission

### 4.4 Data Model
- SQLite/D1 compatible (no graph DB dependency)
- BFS implemented via application-level traversal (not recursive CTEs for portability)
- Relations indexed on (sourceAssetId, targetAssetId) for fast graph traversal

---

## 5. Database Schema

### 5.1 `assets` table
```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,  -- file, env_var, cloud_resource, secret, saas_app, database, agent_session
  name TEXT NOT NULL,
  identifier TEXT NOT NULL,  -- ARN, file path, URL, etc.
  sensitivity TEXT NOT NULL DEFAULT 'medium',  -- critical, high, medium, low, info
  is_crown_jewel INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,  -- JSON
  discovery_source TEXT NOT NULL,  -- agent_activity, cspm_scan, manual, cloud_config
  status TEXT NOT NULL DEFAULT 'active',  -- active, stale, removed
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 5.2 `asset_relations` table
```sql
CREATE TABLE asset_relations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL REFERENCES assets(id),
  target_asset_id TEXT NOT NULL REFERENCES assets(id),
  relation_type TEXT NOT NULL,  -- read_access, write_access, execute_access, etc.
  confidence REAL NOT NULL DEFAULT 1.0,  -- 0.0 to 1.0
  discovery_source TEXT NOT NULL,
  metadata TEXT,  -- JSON
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 5.3 `attack_path_snapshots` table
```sql
CREATE TABLE attack_path_snapshots (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  entry_asset_id TEXT NOT NULL REFERENCES assets(id),
  blast_radius_score INTEGER NOT NULL,  -- 0-100
  total_reachable INTEGER NOT NULL,
  crown_jewels_reached INTEGER NOT NULL,
  paths_json TEXT NOT NULL,  -- JSON array of paths
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 6. UI Pages

### 6.1 Attack Paths Dashboard (`/dashboard/attack-paths`)
- Overview: org-wide blast radius summary
- Top 5 riskiest agent sessions
- Crown jewels inventory with reachability status
- Trend: blast radius score over time

### 6.2 Blast Radius View (`/dashboard/attack-paths/:sessionId`)
- Interactive graph visualization (D3.js force-directed or dagre layout)
- Summary panel with blast radius metrics
- Path detail panel (click a crown jewel to see the full path)
- Recommendations panel

### 6.3 Asset Inventory (`/dashboard/assets`)
- Table view of all discovered assets
- Filter by type, sensitivity, crown jewel status, discovery source
- Bulk actions: mark as crown jewel, update sensitivity
- Link to blast radius view from any asset

---

## 7. Success Gates

- [ ] `assets` and `asset_relations` tables created with migrations
- [ ] Asset discovery pipeline runs after agent sync and CSPM scans
- [ ] BFS attack path engine computes blast radius in < 500ms for 1000 nodes
- [ ] Interactive graph visualization renders in < 2s
- [ ] Demo works end-to-end on test data (agent session -> 14 resources -> 3 crown jewels)
- [ ] Crown jewel flagging and path highlighting works
- [ ] All API endpoints implemented with RBAC
- [ ] 90%+ test coverage on attack path engine
- [ ] PDF export of blast radius report (reuse Sprint 24 PDF generator)

---

## 8. Out of Scope

- Real-time streaming graph updates (batch discovery is sufficient)
- Neo4j or dedicated graph database (SQLite + app-level BFS)
- Cross-org attack paths (each org is isolated)
- Automated remediation of attack paths (Sprint 33)
- Full IAM policy parser (simplified permission extraction only)
