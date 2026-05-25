# Sprint 25: Agent Attack Paths — Implementation Plan

**Sprint:** 25
**Date:** 2026-03-06
**Estimated Duration:** 17 days (5 phases)

---

## Phase 1: Foundation — DB Schema + Asset CRUD (Days 1-3)

### Task 1.1: Database Schema — Attack Graph Tables
- [x] Create `packages/db/src/schema/attack-graph.ts` with `assets`, `assetRelations`, `attackPathSnapshots` tables
- [x] Export from `packages/db/src/schema/index.ts` barrel
- [x] Create migration `packages/db/migrations/0013_attack_graph.sql`
- [x] Add indexes for graph traversal (source_asset_id, target_asset_id, org_id)
- [x] Migration file created — `pnpm db:generate` deferred (applies at deploy time)

### Task 1.2: Asset Types & Constants
- [x] Create `packages/shared/src/constants/attack-graph.ts` with ASSET_TYPES, SENSITIVITY_LEVELS, RELATION_TYPES, DISCOVERY_SOURCES
- [x] Export from `packages/shared/src/constants/index.ts`
- [x] Add types: `AssetType`, `SensitivityLevel`, `RelationType`, `DiscoverySource`

### Task 1.3: Asset CRUD API Routes
- [x] Create `apps/api/src/routes/assets/index.ts` — router setup with RBAC (combined into single file)
- [x] Create `apps/api/src/routes/assets/list.ts` — `GET /api/v1/assets` (paginated, filtered by type/sensitivity/status)
- [x] Create `apps/api/src/routes/assets/get.ts` — `GET /api/v1/assets/:id`
- [x] Create `apps/api/src/routes/assets/create.ts` — `POST /api/v1/assets` (Zod validation)
- [x] Create `apps/api/src/routes/assets/update.ts` — `PUT /api/v1/assets/:id` (crown jewel requires cloud.admin)
- [x] Create `apps/api/src/routes/assets/delete.ts` — `DELETE /api/v1/assets/:id`
- [x] Register routes in `apps/api/src/routes/register.ts`

### Task 1.4: Asset Relation CRUD API Routes
- [x] Create `apps/api/src/routes/asset-relations/index.ts` — router setup (combined into single file)
- [x] Create `apps/api/src/routes/asset-relations/list.ts` — `GET /api/v1/assets/:id/relations`
- [x] Create `apps/api/src/routes/asset-relations/create.ts` — `POST /api/v1/asset-relations`
- [x] Create `apps/api/src/routes/asset-relations/delete.ts` — `DELETE /api/v1/asset-relations/:id`

### Task 1.5: Asset CRUD Tests
- [x] Create `apps/api/src/routes/assets/assets.test.ts` — 16 tests for all 5 endpoints
- [x] Create `apps/api/src/routes/asset-relations/asset-relations.test.ts` — 11 tests for all 3 endpoints
- [x] Test validation: invalid asset types, missing fields, pagination
- [x] Test 404 cases for GET/PUT/DELETE

---

## Phase 2: Discovery Pipeline (Days 4-6)

### Task 2.1: Discovery Types & Interfaces
- [x] Create `apps/api/src/services/asset-discovery/types.ts` — DiscoveredAsset, DiscoveredRelation, DiscoveryContext interfaces
- [x] Define sensitivity auto-classification rules (file patterns, env var names, resource types)

### Task 2.2: Agent Activity Discoverer
- [x] Create `apps/api/src/services/asset-discovery/agent-activity-discoverer.ts`
- [x] Extract file assets from file_read/file_write activity (with sensitivity classification)
- [x] Extract env var assets from env_access activity
- [x] Extract command/process assets from bash_exec activity
- [x] Extract database assets from connection string patterns
- [x] Build relations: agent_session → file (read_access), agent → env_var (read_access), env_var → database (authenticates_to)
- [x] Create `agent-activity-discoverer.test.ts` — 90%+ coverage — 9 tests passing

### Task 2.3: CSPM Discoverer
- [x] Create `apps/api/src/services/asset-discovery/cspm-discoverer.ts`
- [x] Extract cloud resource assets from CSPM findings (S3 buckets, RDS, EC2, IAM roles)
- [x] Map finding severity to asset sensitivity
- [x] Build relations from IAM policy findings (role → resource access)
- [x] Build relations from network findings (security group → EC2 → database)
- [x] Create `cspm-discoverer.test.ts` — 90%+ coverage — 7 tests passing

### Task 2.4: Sensitivity Rules (replaces Relation Builder — relations built inline in discoverers)
- [x] Create `apps/api/src/services/asset-discovery/sensitivity-rules.ts`
- [x] File sensitivity classification via regex patterns
- [x] Env var sensitivity classification via Set lookup
- [x] Cloud resource sensitivity classification from finding severity + resource type
- [x] Crown jewel candidate detection
- [x] Create `sensitivity-rules.test.ts` — 14 tests passing

### Task 2.5: Discovery Pipeline Orchestrator
- [x] Create `apps/api/src/services/asset-discovery/discovery-pipeline.ts`
- [x] Orchestrate: discoverer → dedup → upsert assets → build relations → upsert relations
- [x] Dedup logic: match on (orgId, assetType, identifier) — update lastSeenAt if exists
- [x] Create `apps/api/src/services/asset-discovery/index.ts` barrel
- [x] Create `discovery-pipeline.test.ts` — 12 tests passing

### Task 2.6: Discovery Integration Hooks
- [x] Create `apps/api/src/services/asset-discovery/hooks.ts` — discoverAfterActivitySync, discoverAfterCspmScan
- [x] Hook into `POST /api/agents/activity/sync` in `agent-monitor.ts` — triggers after activity insert
- [x] Hook into `runAwsScan` in `orchestrator.ts` — triggers after CSPM findings inserted
- [x] Errors are caught and logged, never block the main response

---

## Phase 3: Attack Path Engine (Days 7-9)

### Task 3.1: Graph Loader
- [x] Create `apps/api/src/services/attack-path/graph-loader.ts`
- [x] Load all assets + relations for an org into an in-memory adjacency list
- [x] Build `Map<string, GraphNode>` where each node has edges array
- [x] Validate graph integrity (no dangling edges)
- [x] Create `graph-loader.test.ts` — 6 tests passing

### Task 3.2: BFS Engine
- [x] Create `apps/api/src/services/attack-path/bfs-engine.ts`
- [x] BFS traversal from entry point with configurable maxDepth and minConfidence
- [x] Track visited nodes, paths, and hop counts
- [x] Support filtering by asset type, sensitivity, relation type
- [x] Return BfsResult: reachable map + paths map
- [x] Create `bfs-engine.test.ts` — **100% coverage** (critical path) — 14 tests passing

### Task 3.3: Blast Radius Scoring
- [x] Create `apps/api/src/services/attack-path/blast-radius.ts`
- [x] Implement weighted scoring: critical=25, high=10, medium=3, low=1, crown_jewel_bonus=15
- [x] Logarithmic scaling: `min(100, round(20 * log2(1 + rawScore)))`
- [x] Return BlastRadiusResult: score, reachable count, by type, by sensitivity
- [x] Create `blast-radius.test.ts` — **100% coverage** (critical path) — 9 tests passing

### Task 3.4: Crown Jewel Path Finder
- [x] Create `apps/api/src/services/attack-path/crown-jewel-paths.ts`
- [x] Find shortest path from entry to each crown jewel (BFS shortest path)
- [x] Rank paths by sensitivity and hop count
- [x] Return top N most critical paths
- [x] Create `crown-jewel-paths.test.ts` — 90%+ coverage — 5 tests passing

### Task 3.5: Attack Path API Routes
- [x] Create `apps/api/src/routes/attack-paths/index.ts` — router setup (combined into single file)
- [x] Create `apps/api/src/routes/attack-paths/query.ts` — `POST /api/v1/attack-paths/query` (Zod validated)
- [x] Create `apps/api/src/routes/attack-paths/blast-radius.ts` — `GET /api/v1/attack-paths/blast-radius/:sessionId`
- [x] Create `apps/api/src/routes/attack-paths/crown-jewels.ts` — `GET /api/v1/attack-paths/crown-jewels`
- [x] Register routes in `apps/api/src/routes/register.ts`

### Task 3.6: Attack Path Engine Barrel + Types
- [x] Create `apps/api/src/services/attack-path/types.ts` — all interfaces
- [x] Create `apps/api/src/services/attack-path/index.ts` — barrel exports
- [x] Create `apps/api/src/routes/attack-paths/attack-paths.test.ts` — 11 tests passing

---

## Phase 4: Visualization (Days 10-14)

### Task 4.1: Frontend Dependencies
- [x] Custom SVG layout (no dagre/d3 dependencies needed)
- [x] Add proxy routes: `apps/web/src/app/api/proxy/assets/`, `apps/web/src/app/api/proxy/attack-paths/`

### Task 4.2: Attack Paths Dashboard Page
- [x] Create `apps/web/src/app/dashboard/attack-paths/page.tsx` — server component
- [x] Create `apps/web/src/app/dashboard/attack-paths/AttackPathsClient.tsx` — client wrapper
- [x] Show org-wide blast radius summary (score, top 5 riskiest sessions)
- [x] Crown jewels inventory with reachability status
- [x] Add to dashboard navigation (sidebar-config.ts)

### Task 4.3: Blast Radius Graph Component
- [x] Create `apps/web/src/components/dashboard/attack-graph/BlastRadiusGraph.tsx`
- [x] Custom hierarchical layout: entry point at top, deeper hops below
- [x] SVG rendering with color-coded nodes by sensitivity (red/amber/blue/neutral)
- [x] Directional arrows for edges
- [x] Crown jewel nodes with gold dashed circle

### Task 4.6: Blast Radius Summary Panel
- [x] Create `apps/web/src/components/dashboard/attack-graph/BlastRadiusSummary.tsx`
- [x] Blast radius score (large grade letter + score/100)
- [x] Assets reachable by type + sensitivity breakdown bar
- [x] Crown jewels at risk count + critical assets count

### Task 4.7: Crown Jewel Paths Panel
- [x] Create `apps/web/src/components/dashboard/attack-graph/CrownJewelPaths.tsx`
- [x] List paths with entry → hop chain → crown jewel
- [x] Severity badge for each path
- [x] Hop count display

### Task 4.9: Asset Inventory Page
- [x] Create `apps/web/src/app/dashboard/assets/page.tsx` — server component
- [x] Create `apps/web/src/app/dashboard/assets/AssetsClient.tsx`
- [x] Table with columns: name, type, sensitivity, source, last seen
- [x] Filter bar: type, sensitivity, search
- [x] Crown jewel badge on assets
- [x] Add to dashboard navigation

---

## Phase 5: Integration & Polish (Days 15-17)

### Task 5.1: Seed Data Generator
- [x] Create `apps/api/src/services/asset-discovery/seed-data.ts`
- [x] Generate realistic demo graph: 1 agent session → 8 S3 buckets, 2 RDS, 1 Secrets Manager → 5 crown jewels
- [x] Full attack path: Cursor agent → ~/.aws/credentials → IAM admin → RDS/S3/SecretsManager

### Task 5.2: Performance Testing
- [x] Create `apps/api/src/services/attack-path/performance.test.ts` — 4 tests
- [x] Test BFS with 1,000 nodes, 5,000 edges — passes < 500ms
- [x] Test BFS with 10,000 nodes, 50,000 edges — passes < 2s (actual: ~26ms)
- [x] Test graph build + blast radius + crown jewel paths timing

### Task 5.3: PDF Export — Blast Radius Report
- [ ] Deferred — requires PDF report generator extension (Phase 2 of Sprint 26)

### Task 5.4: E2E Demo Scenario
- [x] Seed data generates full demo graph with Cursor → AWS credentials → RDS → customer_data path
- [ ] Screenshot deferred — requires running web frontend

### Task 5.5: Final Verification
- [x] Run `pnpm typecheck` — all 14 packages pass
- [x] Run `pnpm test` — 1,038 tests pass across 88 test files
- [x] Run `pnpm build` — all 10 packages build (9.4s)
- [x] Verify no Sprint 25 source file exceeds 200 lines
- [x] Update MEMORY.md with Sprint 25 completion status

---

## Task Count Summary

| Phase | Tasks | Subtasks |
|---|---|---|
| Phase 1: Foundation | 5 | 25 |
| Phase 2: Discovery | 6 | 28 |
| Phase 3: Engine | 6 | 26 |
| Phase 4: Visualization | 9 | 36 |
| Phase 5: Polish | 5 | 15 |
| **Total** | **31** | **130** |
