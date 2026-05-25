# Sprint 25: Agent Attack Paths — Technical Design

**Sprint:** 25
**Author:** Claude (auto-generated)
**Date:** 2026-03-06
**Status:** Draft

---

## 1. Architecture Overview

Sprint 25 adds a lightweight property graph engine on top of D1/SQLite. The architecture has four layers:

```
[Discovery Pipeline] → [Asset Graph Store] → [Path Engine] → [Visualization]
     (ingest)              (D1 tables)          (BFS API)       (D3.js UI)
```

### Data Flow

```
Agent Activity Sync ──┐
                      ├──→ Asset Discovery ──→ assets table
CSPM Scan Complete ───┤    Pipeline            asset_relations table
                      │
Cloud Account Connect ┘
                                                    │
                                                    ▼
                                          Attack Path Engine (BFS)
                                                    │
                                                    ▼
                                          Blast Radius API + UI
```

---

## 2. Database Schema (Drizzle ORM)

### 2.1 New file: `packages/db/src/schema/attack-graph.ts`

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Asset types
export const ASSET_TYPES = [
  'file', 'env_var', 'cloud_resource', 'secret',
  'saas_app', 'database', 'agent_session',
] as const;

export const SENSITIVITY_LEVELS = [
  'critical', 'high', 'medium', 'low', 'info',
] as const;

export const RELATION_TYPES = [
  'read_access', 'write_access', 'execute_access',
  'secret_access', 'network_access', 'inherits_from',
  'contains', 'authenticates_to',
] as const;

export const DISCOVERY_SOURCES = [
  'agent_activity', 'cspm_scan', 'manual',
  'cloud_config', 'iam_policy', 'inferred',
] as const;

// --- assets table ---
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  assetType: text('asset_type').notNull(),
  name: text('name').notNull(),
  identifier: text('identifier').notNull(),
  sensitivity: text('sensitivity').notNull().default('medium'),
  isCrownJewel: integer('is_crown_jewel', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata'),  // JSON
  discoverySource: text('discovery_source').notNull(),
  status: text('status').notNull().default('active'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// --- asset_relations table ---
export const assetRelations = sqliteTable('asset_relations', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  sourceAssetId: text('source_asset_id').notNull().references(() => assets.id),
  targetAssetId: text('target_asset_id').notNull().references(() => assets.id),
  relationType: text('relation_type').notNull(),
  confidence: real('confidence').notNull().default(1.0),
  discoverySource: text('discovery_source').notNull(),
  metadata: text('metadata'),  // JSON
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// --- attack_path_snapshots table ---
export const attackPathSnapshots = sqliteTable('attack_path_snapshots', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  entryAssetId: text('entry_asset_id').notNull().references(() => assets.id),
  blastRadiusScore: integer('blast_radius_score').notNull(),
  totalReachable: integer('total_reachable').notNull(),
  crownJewelsReached: integer('crown_jewels_reached').notNull(),
  pathsJson: text('paths_json').notNull(),  // JSON
  computedAt: text('computed_at').notNull().default(sql`(datetime('now'))`),
});
```

### 2.2 Migration: `packages/db/migrations/0013_attack_graph.sql`

Standard Drizzle-generated migration with indexes:

```sql
-- Indexes for graph traversal performance
CREATE INDEX idx_assets_org_id ON assets(org_id);
CREATE INDEX idx_assets_org_type ON assets(org_id, asset_type);
CREATE INDEX idx_assets_org_sensitivity ON assets(org_id, sensitivity);
CREATE INDEX idx_assets_identifier ON assets(org_id, identifier);
CREATE INDEX idx_asset_relations_source ON asset_relations(source_asset_id);
CREATE INDEX idx_asset_relations_target ON asset_relations(target_asset_id);
CREATE INDEX idx_asset_relations_org ON asset_relations(org_id);
CREATE INDEX idx_asset_relations_org_source ON asset_relations(org_id, source_asset_id);
CREATE INDEX idx_attack_snapshots_org ON attack_path_snapshots(org_id);
CREATE INDEX idx_attack_snapshots_entry ON attack_path_snapshots(entry_asset_id);
```

Key design decision: index on `source_asset_id` for forward BFS traversal, and on `target_asset_id` for reverse path queries ("what can reach this crown jewel?").

---

## 3. Service Architecture

### 3.1 Asset Discovery Pipeline

**File:** `apps/api/src/services/asset-discovery/`

```
asset-discovery/
  index.ts              — barrel exports
  types.ts              — DiscoveredAsset, DiscoveryContext interfaces
  agent-activity-discoverer.ts  — extract assets from agent activity logs
  cspm-discoverer.ts            — extract assets from CSPM findings
  cloud-config-discoverer.ts    — extract assets from cloud account config
  relation-builder.ts           — build relations between discovered assets
  discovery-pipeline.ts         — orchestrate discovery + dedup + upsert
```

**Discovery logic:**

```typescript
// agent-activity-discoverer.ts
// Input: agent activity records (file reads, bash commands, env vars)
// Output: DiscoveredAsset[] + DiscoveredRelation[]

// Example transformations:
// file_read(/home/dev/.aws/credentials) →
//   Asset(type=file, identifier=~/.aws/credentials, sensitivity=critical)
//   Relation(agent_session → file, type=read_access)

// bash_exec(psql -h prod-db.rds.amazonaws.com) →
//   Asset(type=database, identifier=prod-db.rds.amazonaws.com)
//   Relation(agent_session → database, type=network_access)

// env_access(DATABASE_URL=postgres://user:pass@host/db) →
//   Asset(type=env_var, identifier=DATABASE_URL, sensitivity=high)
//   Asset(type=database, identifier=host/db)
//   Relation(agent_session → env_var, type=read_access)
//   Relation(env_var → database, type=authenticates_to)
```

**Sensitivity auto-classification:**

| Pattern | Sensitivity |
|---|---|
| `.pem`, `.key`, `credentials`, `secrets` | critical |
| `.env`, `DATABASE_URL`, `API_KEY` | high |
| `node_modules`, `package.json` | low |
| Source code files (`.ts`, `.py`, `.go`) | medium |
| Production cloud resources | high |
| Dev/staging cloud resources | medium |

### 3.2 Attack Path Engine

**File:** `apps/api/src/services/attack-path/`

```
attack-path/
  index.ts              — barrel exports
  types.ts              — PathQuery, PathResult, BlastRadius interfaces
  graph-loader.ts       — load subgraph from D1 into memory
  bfs-engine.ts         — BFS traversal implementation
  blast-radius.ts       — compute blast radius score
  crown-jewel-paths.ts  — find shortest paths to crown jewels
  path-query.ts         — high-level query API
```

**BFS Algorithm:**

```typescript
// bfs-engine.ts
interface GraphNode {
  id: string;
  asset: Asset;
  edges: GraphEdge[];
}

interface GraphEdge {
  relationId: string;
  targetId: string;
  relationType: string;
  confidence: number;
}

interface BfsResult {
  reachable: Map<string, { asset: Asset; depth: number; path: string[] }>;
  paths: Map<string, string[][]>;  // assetId → all paths to reach it
}

function bfsTraverse(
  graph: Map<string, GraphNode>,
  entryId: string,
  maxDepth: number,
  minConfidence: number,
): BfsResult {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number; path: string[] }> = [];
  const result: BfsResult = { reachable: new Map(), paths: new Map() };

  queue.push({ id: entryId, depth: 0, path: [entryId] });
  visited.add(entryId);

  while (queue.length > 0) {
    const { id, depth, path } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const node = graph.get(id);
    if (!node) continue;

    for (const edge of node.edges) {
      if (visited.has(edge.targetId)) continue;
      if (edge.confidence < minConfidence) continue;

      visited.add(edge.targetId);
      const newPath = [...path, edge.targetId];
      const targetNode = graph.get(edge.targetId);

      if (targetNode) {
        result.reachable.set(edge.targetId, {
          asset: targetNode.asset,
          depth: depth + 1,
          path: newPath,
        });

        if (!result.paths.has(edge.targetId)) {
          result.paths.set(edge.targetId, []);
        }
        result.paths.get(edge.targetId)!.push(newPath);

        queue.push({ id: edge.targetId, depth: depth + 1, path: newPath });
      }
    }
  }

  return result;
}
```

**Graph Loading Strategy:**

Load the entire org's graph into memory for traversal. For 10K assets + 50K relations, this is ~10MB — well within Worker memory limits (128MB). This avoids N+1 queries during BFS.

```typescript
// graph-loader.ts
async function loadOrgGraph(db: Db, orgId: string): Promise<Map<string, GraphNode>> {
  // Two queries: all assets + all relations for the org
  const [allAssets, allRelations] = await Promise.all([
    db.select().from(assets).where(eq(assets.orgId, orgId)),
    db.select().from(assetRelations).where(eq(assetRelations.orgId, orgId)),
  ]);

  // Build adjacency list
  const graph = new Map<string, GraphNode>();
  for (const asset of allAssets) {
    graph.set(asset.id, { id: asset.id, asset, edges: [] });
  }
  for (const rel of allRelations) {
    const node = graph.get(rel.sourceAssetId);
    if (node) {
      node.edges.push({
        relationId: rel.id,
        targetId: rel.targetAssetId,
        relationType: rel.relationType,
        confidence: rel.confidence,
      });
    }
  }
  return graph;
}
```

### 3.3 Blast Radius Scoring

**Scoring formula (0-100, higher = more exposure):**

```typescript
function computeBlastRadius(reachable: Map<string, ReachableAsset>): number {
  let score = 0;
  const weights = {
    critical: 25,  // Each critical asset adds 25 points
    high: 10,      // Each high asset adds 10 points
    medium: 3,     // Each medium asset adds 3 points
    low: 1,        // Each low asset adds 1 point
    info: 0,
  };

  for (const { asset } of reachable.values()) {
    score += weights[asset.sensitivity] || 0;
    if (asset.isCrownJewel) score += 15;  // Crown jewel bonus
  }

  // Cap at 100, logarithmic scaling for large graphs
  return Math.min(100, Math.round(20 * Math.log2(1 + score)));
}
```

---

## 4. API Routes

### 4.1 Route structure

```
apps/api/src/routes/
  assets/
    index.ts         — barrel + router setup
    list.ts          — GET /api/v1/assets
    get.ts           — GET /api/v1/assets/:id
    create.ts        — POST /api/v1/assets
    update.ts        — PUT /api/v1/assets/:id
    delete.ts        — DELETE /api/v1/assets/:id
    relations.ts     — GET /api/v1/assets/:id/relations
  asset-relations/
    index.ts         — barrel + router
    create.ts        — POST /api/v1/asset-relations
    delete.ts        — DELETE /api/v1/asset-relations/:id
  attack-paths/
    index.ts         — barrel + router
    query.ts         — POST /api/v1/attack-paths/query
    blast-radius.ts  — GET /api/v1/attack-paths/blast-radius/:sessionId
    crown-jewels.ts  — GET /api/v1/attack-paths/crown-jewels
```

### 4.2 RBAC Permissions

| Endpoint | Permission |
|---|---|
| GET assets, relations, attack-paths | `cloud.read` |
| POST/PUT/DELETE assets | `cloud.write` |
| Mark crown jewel | `cloud.admin` |
| POST asset-relations | `cloud.write` |
| POST attack-paths/query | `cloud.read` |

### 4.3 Request/Response Schemas (Zod)

```typescript
// Attack path query
const attackPathQuerySchema = z.object({
  entryAssetId: z.string(),
  maxDepth: z.number().min(1).max(20).default(10),
  minConfidence: z.number().min(0).max(1).default(0.5),
  filterAssetTypes: z.array(z.enum(ASSET_TYPES)).optional(),
  filterSensitivity: z.array(z.enum(SENSITIVITY_LEVELS)).optional(),
  filterRelationTypes: z.array(z.enum(RELATION_TYPES)).optional(),
});

// Blast radius response
interface BlastRadiusResponse {
  data: {
    entryAsset: AssetSummary;
    blastRadiusScore: number;
    totalReachable: number;
    crownJewelsReached: number;
    byType: Record<string, number>;
    bySensitivity: Record<string, number>;
    topPaths: AttackPath[];  // Top 10 most critical paths
    reachableAssets: ReachableAssetSummary[];
  };
}
```

---

## 5. Frontend Architecture

### 5.1 Graph Visualization

**Library choice:** `@dagrejs/dagre` for layout + custom SVG/Canvas rendering.

Rationale: D3.js force-directed graphs are visually impressive but unpredictable for security visualizations — nodes jump around, making it hard to trace paths. Dagre provides hierarchical layout (entry point at top, crown jewels at bottom) which is more intuitive for attack paths.

```
apps/web/src/app/dashboard/attack-paths/
  page.tsx                    — main page (server component)
  AttackPathsClient.tsx       — client wrapper
  components/
    BlastRadiusGraph.tsx      — D3/dagre graph visualization (< 200 lines)
    GraphControls.tsx         — zoom, filter, export controls
    GraphNode.tsx             — single node component
    GraphEdge.tsx             — single edge component
    BlastRadiusSummary.tsx    — summary panel
    CrownJewelPaths.tsx       — crown jewel path list
    AssetDetailPanel.tsx      — slide-out panel for asset details
  hooks/
    useGraphData.ts           — fetch + transform graph data
    useGraphLayout.ts         — dagre layout computation
```

### 5.2 Asset Inventory Page

```
apps/web/src/app/dashboard/assets/
  page.tsx                    — server component
  AssetsClient.tsx            — client wrapper
  components/
    AssetTable.tsx            — sortable, filterable table
    AssetFilters.tsx          — filter bar
    CrownJewelBadge.tsx       — visual indicator
    SensitivityBadge.tsx      — color-coded sensitivity label
```

### 5.3 Color Scheme (Apple HIG compliant)

| Sensitivity | Node Color | Border |
|---|---|---|
| critical | `red-500` | `red-400` |
| high | `amber-500` | `amber-400` |
| medium | `blue-500` | `blue-400` |
| low | `neutral-400` | `neutral-300` |
| info | `neutral-600` | `neutral-500` |
| Crown jewel | Gold glow + star icon | `yellow-400` |

Edge colors by relation type:
| Relation | Color | Style |
|---|---|---|
| read_access | `blue-400` | solid |
| write_access | `amber-400` | solid |
| secret_access | `red-400` | dashed |
| execute_access | `purple-400` | solid |
| network_access | `green-400` | dotted |
| inherits_from | `neutral-400` | dashed |

---

## 6. Integration Points

### 6.1 Agent Activity Sync Hook

After `POST /api/v1/agent-monitor/sync` processes activity data, trigger asset discovery:

```typescript
// In agent-monitor.ts sync handler, after saving activity:
await runAssetDiscovery(db, orgId, 'agent_activity', activityRecords);
```

### 6.2 CSPM Scan Completion Hook

After CSPM scan completes (cspm-scan-scheduler.ts), trigger asset discovery:

```typescript
// In scan completion handler:
await runAssetDiscovery(db, orgId, 'cspm_scan', findings);
```

### 6.3 Cloud Account Connection Hook

When a new cloud account is connected (cloud-accounts.ts), trigger initial inventory:

```typescript
// In POST /api/v1/cloud-accounts handler:
await runAssetDiscovery(db, orgId, 'cloud_config', accountConfig);
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

| Module | Test File | Coverage Target |
|---|---|---|
| bfs-engine | bfs-engine.test.ts | 100% (critical path) |
| blast-radius scoring | blast-radius.test.ts | 100% |
| graph-loader | graph-loader.test.ts | 90% |
| asset-discovery pipeline | discovery-pipeline.test.ts | 90% |
| agent-activity-discoverer | agent-activity-discoverer.test.ts | 90% |
| cspm-discoverer | cspm-discoverer.test.ts | 90% |
| relation-builder | relation-builder.test.ts | 90% |

### 7.2 Integration Tests

| Test | Description |
|---|---|
| assets CRUD | Create, read, update, delete assets via API |
| attack-paths query | Full pipeline: create assets + relations → query paths → verify results |
| blast radius | Create graph with known structure → verify score calculation |
| crown jewel paths | Create graph with crown jewels → verify shortest paths found |
| RBAC | Verify permission enforcement on all endpoints |
| discovery pipeline | Feed agent activity → verify assets + relations created |

### 7.3 Visual Tests

| Test | Description |
|---|---|
| Graph render | Verify graph renders with 100, 500, 1000 nodes |
| Performance | Measure render time stays < 2s at 1000 nodes |
| Interaction | Verify zoom, pan, click, filter work |

---

## 8. Task Breakdown (Implementation Order)

### Phase 1: Foundation (Days 1-3)
1. DB schema + migration (attack-graph.ts, 0013_attack_graph.sql)
2. Asset CRUD API routes (6 endpoints)
3. Asset relation CRUD API routes (3 endpoints)
4. Unit tests for all CRUD routes

### Phase 2: Discovery Pipeline (Days 4-6)
5. Agent activity discoverer (extract assets from activity logs)
6. CSPM discoverer (extract assets from CSPM findings)
7. Relation builder (infer relations between assets)
8. Discovery pipeline orchestrator + dedup logic
9. Integration hooks (agent sync, CSPM scan, cloud account)
10. Discovery pipeline tests

### Phase 3: Attack Path Engine (Days 7-9)
11. Graph loader (load org graph into memory)
12. BFS engine (traverse graph from entry point)
13. Blast radius scoring
14. Crown jewel path finder
15. Attack path API routes (3 endpoints)
16. Attack path engine tests (100% coverage)

### Phase 4: Visualization (Days 10-14)
17. Attack paths dashboard page (overview)
18. Blast radius graph component (dagre layout)
19. Graph interaction controls (zoom, filter, click)
20. Asset detail panel (slide-out)
21. Crown jewel paths panel
22. Blast radius summary panel
23. Asset inventory page

### Phase 5: Integration & Polish (Days 15-17)
24. Connect discovery hooks to existing pipelines
25. Seed data generator (for demo/testing)
26. Performance testing (1000 node graph)
27. PDF export of blast radius report
28. E2E test: full pipeline demo scenario

---

## 9. Risk Assessment

| Risk | Mitigation |
|---|---|
| D1 query latency for large graphs | Load entire graph into memory (10K assets = ~10MB) |
| Worker memory limit (128MB) | Cap at 10K assets per org; paginate if needed |
| Stale relations accumulating | 30-day staleness marker; background cleanup cron |
| False positive relations | Confidence scoring; min threshold filter |
| Graph visualization performance | Dagre layout is O(V+E); canvas rendering for >500 nodes |

---

## 10. Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `@dagrejs/dagre` | ^1.1.0 | Graph layout algorithm |
| `d3-selection` | ^3.0.0 | SVG manipulation (lightweight, no full D3) |
| `d3-zoom` | ^3.0.0 | Pan + zoom for graph |

No new backend dependencies — BFS is pure TypeScript, graph loading uses existing Drizzle.
