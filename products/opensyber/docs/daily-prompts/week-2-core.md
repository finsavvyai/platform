# Week 2 — Core (Days 6–10)

**Track A:** Sprint 13 — Risk Intelligence (Days 6-8)
**Track B:** Sprint 15 — SaaS Posture / TenantIQ (Days 6-11)
**Track C:** Skill packaging continues — mcpoverflow, querylens, quantumbeam

---

## Day 6 — Risk Intelligence Starts + SaaS Posture Starts + C Packaging

### Vision
Milestone A (CSPM + Risk) is in sight. Today we connect Prowler findings
to risk scores — giving every org a 0-100 security posture number for the
first time. Simultaneously, TenantIQ M365 scanning comes online, and the
skill marketplace gains its meta-skill (mcpoverflow can generate any skill).

---

### Track A — Sprint 13: Risk Intelligence Engine

```
SYSTEM CONTEXT: Sprint 11 is complete. CSPM findings are flowing.
Now build the Risk Intelligence engine that converts findings into scores.
Read: docs/sprints/sprint-13-risk-intelligence.md

DESIGN PATTERN: Strategy (each signal source is a pluggable RiskSignal)
FILE BUDGET: ≤ 200 lines per source file.

OPEN SOURCE: Do NOT use external scoring libraries. The risk scoring formula
is proprietary. Use the RiskScorer base + WeightedRiskScorer from Day 4.

TASK A1 — VaultRiskSignal (Day 4 gave us CspmRiskSignal):
Create apps/api/src/services/risk/signals/vault-signal.ts
- Input: VaultSecret[] for org — check rotation staleness, expiry
- Score contribution: expired=30, stale>90d=15, stale>30d=5
- Pattern: Strategy

TASK A2 — RiskScoringService (150 lines max):
Create apps/api/src/services/risk/risk-scoring-service.ts
- Pattern: Factory + Strategy
- calculateOrgRisk(orgId): aggregates CspmSignal + VaultSignal + future signals
- Persists to risk_scores table, stores signal breakdown in risk_signals
- Emits riskUpdated event to CF Queue for downstream consumers

TASK A3 — Risk Score API (80 lines max):
Create apps/api/src/routes/risk/score.ts
- GET /api/v1/risk/score — current org risk score + signal breakdown
- GET /api/v1/risk/history — 30-day trend (cursor-based)
- requirePermission('risk.score.read')

TASK A4 — Risk Dashboard Page (180 lines max):
Create apps/web/src/app/(dashboard)/security/risk/page.tsx
- Server Component: show current score as large number + trend badge
- Signal breakdown: expandable list per source (CSPM, Vault, etc.)
- Score history: simple sparkline (use d3-hierarchy data, render with SVG)

TASK A5 — Tests: RiskScoringService with mocked signals, API routes

SECURITY AUDIT:
[ ] Risk score queries scoped to orgId (never cross-tenant)
[ ] Signal sources validated (reject unknown source names)
```

---

### Track B — Sprint 15: SaaS Posture + TenantIQ Skill

```
SYSTEM CONTEXT: Sprint 12 complete. Start Sprint 15 SaaS Posture.
Read: docs/sprints/sprint-15-saas-posture.md — specifically FULL.0 section.

DESIGN PATTERN: Adapter (TenantIQ M365 → SaaS Finding) + Repository
FILE BUDGET: ≤ 200 lines
SPRINT 15 WINDOW: Days 6-11 (5 days). Day 12+ is Sprint 18 (multi-cloud).
Stay within this window — do not start Sprint 18 tasks until Day 12.

IMPORTANT: TenantIQ M365 scanning is a real portfolio project.
Read skill-catalog.md → tenantiq-m365-security section.
Do NOT build M365 scanning from scratch.

TASK B1 — SaaS schema:
Add to packages/db/src/schema/security.ts:
  saas_connections: id, orgId, provider (m365/google/slack/etc),
    tenantId, credentials TEXT (encrypted), status, lastScanAt
  saas_findings: id, orgId, connectionId, provider, ruleId, severity,
    policyName, affectedUsers TEXT, remediationSteps, status, detectedAt

TASK B2 — TenantIQ Adapter (120 lines max):
Create apps/api/src/skills/saas/tenantiq-adapter.ts
- Pattern: Adapter
- Wraps tenantiq-m365-security SkillManifest into a service-level interface
- run(connectionId): → SaasFinding[] via SkillRunner
- emitter.saasFinding() for each violation

TASK B3 — SaaS Connections Route (100 lines max):
Create apps/api/src/routes/saas/connections.ts
- GET /api/v1/saas/connections — list connections (scoped to org)
- POST /api/v1/saas/connections — add M365/Google/Slack connection
  - Encrypt credentials via VaultService
- DELETE /api/v1/saas/connections/:id

TASK B4 — SaaS Findings Route (80 lines max):
Create apps/api/src/routes/saas/findings.ts
- GET /api/v1/saas/findings — list with severity filter + cursor pagination
- GET /api/v1/saas/findings/:id — detail

TASK B5 — Tests: mock TenantIQ responses, route auth, org scoping

SECURITY AUDIT:
[ ] M365 tenant credentials encrypted before storage
[ ] SaaS findings scoped to orgId
[ ] No M365 OAuth tokens logged
```

---

### Track C — mcpoverflow-connector-gen packaging

```
CONTEXT: mcpoverflow is a meta-skill — it generates new skills from API specs.
Read: docs/skills/skill-catalog.md → mcpoverflow-connector-gen section.

DESIGN PATTERN: Factory (generates SkillManifest from OpenAPI spec)
FILE BUDGET: ≤ 200 lines

TASK C1 — mcpoverflow-connector-gen skill (150 lines max):
Create packages/skills/mcpoverflow-connector-gen/index.ts
- execute(ctx, emitter):
  - Expose MCP tool: generate_skill_from_spec(openApiSpec: string)
  - Parse OpenAPI spec → generate TypeScript SkillManifest code
  - Use Anthropic SDK to generate the implementation (LLM-assisted)
  - Return generated skill as string → user can install via skill install API
- Pattern: Factory

TASK C2 — skill.json manifest for mcpoverflow

TASK C3 — Test: mock OpenAPI spec → assert generated SkillManifest structure

NOTE: This skill unlocks "skill factory" capability — paste any API docs,
get a deployable OpenSyber skill. Feature of Sprint 19 marketplace.
```

---

## Day 7 — Risk Complete (A) + SaaS Scan Worker (B) + querylens (C)

### Track A — Sprint 13: Quantumbeam Integration + Sprint Close

```
CONTEXT: Core risk scoring is built. Today integrate QuantumBeam fraud
signals and complete Sprint 13.
Read: docs/skills/skill-catalog.md → quantumbeam-fraud-detection section.

SEQUENCING NOTE: QuantumBeam is packaged by Track C on Day 8 (tomorrow).
Create a stub today that Track C will replace tomorrow — the interface must
be identical so Track A needs no changes when Track C's implementation lands.
Track C Day 8 replaces the stub file; Track A merges Track C's branch first.

TASK A1 — FraudRiskSignal stub (60 lines max):
Create apps/api/src/services/risk/signals/fraud-signal.ts
- Implements RiskSignal interface
- Returns { source: 'quantumbeam', weight: 0.15, value: 0 } stub
- Add comment: "// STUB: Track C Day 8 replaces this with real QuantumBeam adapter"
- Create GitHub issue and link it: "Replace FraudRiskSignal stub with QuantumBeam"
- The interface contract (source/weight/value) must NOT change when replaced

TASK A2 — Risk trend API:
Add 7-day + 30-day trend computation to risk-scoring-service.ts (if adding
would exceed 200 lines → extract to apps/api/src/services/risk/trend.ts)

TASK A3 — Sprint 13 DoD: read sprint-13-risk-intelligence.md, mark all done.

RISK INTELLIGENCE MILESTONE: Every org now has a live 0-100 security score.
Attack graph (Sprint 14) unlocked.
```

---

### Track B — Sprint 15: SaaS Scan Worker + Dashboard

```
TASK B1 — SaaS scan worker (100 lines max):
Create apps/api/src/workers/saas-scan-worker.ts
- CF Queue consumer for saas.scan jobs
- Run TenantIQ adapter for each M365 connection
- Dedup findings same as CSPM dedup pattern (accountId + ruleId + resourceId)
- Trigger risk delta: emitter.riskDelta({ source: 'saas', delta })

TASK B2 — SaaS Dashboard Page (180 lines max):
Create apps/web/src/app/(dashboard)/security/saas/page.tsx
- Server Component: list connections + finding summary per provider
- Color-coded severity badges (design system: red/amber/green)
- Connect M365 CTA button → ConnectSaasModal

TASK B3 — SaaS cron (every 6h): extends pattern from cspm-cron.ts
TASK B4 — Tests
```

---

### Track C — querylens-nl-sql packaging

```
TASK C1 — querylens-nl-sql skill (100 lines max):
Create packages/skills/querylens-nl-sql/index.ts
Read: docs/skills/skill-catalog.md → querylens-nl-sql section
IMPORTANT: QueryFlux MCP has NL→SQL ready. QueryLens wraps it.
Do NOT build NL→SQL from scratch.

- execute(): register MCP tools for security analysts
- Tools: query_findings_nl("show me all critical findings this week"),
  query_risk_trend_nl("which accounts got riskier last 30 days?")
- Converts natural language → SQL via QueryFlux MCP → executes on D1
- Returns structured results + emits them as ai_insights

TASK C2 — Tests: mock QueryFlux MCP, assert SQL generation + D1 execution
```

---

## Day 8 — Attack Graph Schema (A) + SaaS Complete (B) + quantumbeam (C)

### Track A — Sprint 14: Attack Graph Begins

```
SYSTEM CONTEXT: Sprint 13 Risk Intelligence complete. Start Sprint 14 Attack Graph.
Read: docs/sprints/sprint-14-attack-graph.md

DESIGN PATTERN: DAG/Pipeline (BFS traversal of attack paths)
FILE BUDGET: ≤ 200 lines

OPEN SOURCE: Use graphology for graph data structure (not Neo4j — use D1 CTEs).
pnpm add graphology graphology-traversal graphology-shortest-path

IMPORTANT: Attack graph runs on D1 with recursive CTEs, not Neo4j.
This is a key architectural decision. See cnsp-roadmap.md for rationale.

TASK A1 — Attack graph schema:
Add to packages/db/src/schema/security.ts:
  attack_nodes: id, orgId, nodeType (account/resource/finding/identity),
    nodeId, label, metadata TEXT, riskScore, createdAt
  attack_edges: id, orgId, sourceNodeId, targetNodeId, edgeType,
    confidence (float), exploitability (float), metadata TEXT, createdAt
Generate migration.

TASK A2 — GraphRepository (150 lines max):
Create apps/api/src/repositories/graph-repository.ts
- Pattern: Repository
- insertNode(node), insertEdge(edge), getAdjacentNodes(nodeId)
- BFS query: D1 recursive CTE returning path arrays
- buildGraph(orgId): returns graphology DirectedGraph instance

TASK A3 — Attack Graph BFS (140 lines max):
Create apps/api/src/services/graph/attack-graph-bfs.ts
- Pattern: DAG/Pipeline
- findAttackPaths(graph, startNodeId, maxDepth=5): AttackPath[]
- AttackPath: { nodes[], edges[], criticalityScore, exploitChain }
- Use graphology-traversal bfsFromNode()

TASK A4 — Tests: mock graph nodes/edges, assert BFS paths

MILESTONE B PREP: Attack graph structure is ready. SaaS nodes feed in Day 11.
```

---

### Track B — Sprint 15 Complete

```
TASK B1 — Extended connectors (non-M365):
Add Google Workspace connector stub + Slack connector stub to saas-scan-worker.ts
(per sprint-15-saas-posture.md FULL.1 section — non-M365 scaffolding only)

TASK B2 — Sprint 15 DoD: read sprint-15-saas-posture.md, mark all tasks done.

MILESTONE B (partial): SaaS Posture operational. TenantIQ M365 scanning live.
SaaS nodes ready to feed attack graph when it opens (Day 9+).
```

---

### Track C — quantumbeam-fraud-detection packaging

```
TASK C1 — quantumbeam-fraud-detection skill (120 lines max):
Create packages/skills/quantumbeam-fraud-detection/index.ts
Read: docs/skills/skill-catalog.md → quantumbeam-fraud-detection section
IMPORTANT: QuantumBeam is a portfolio project — wrap it, don't rebuild.
- execute():
  - Run QuantumBeam fraud detection against agent transaction logs
  - emitter.riskDelta({ source: 'quantumbeam', weight: 0.15, delta })
  - emitter.finding() for HIGH confidence fraud signals
- Replaces the FraudRiskSignal stub created on Day 7

TASK C2 — Update FraudRiskSignal in apps/api:
Replace stub with real QuantumBeam adapter call.
Track A receives this via the event system automatically.

TASK C3 — Tests: mock QuantumBeam API, assert risk delta emissions
```

---

## Day 9 — Attack Graph Builder (A) + SaaS→Graph Bridge (B) + automationhub (C)

### Track A — Sprint 14: Graph Builder Service

```
CONTEXT: Schema + BFS ready. Today build the service that ingests CSPM
findings + SaaS findings and materializes them as graph nodes/edges.

DESIGN PATTERN: Observer/Event (listens to finding.created events)
FILE BUDGET: ≤ 200 lines

TASK A1 — GraphBuilderService (180 lines max):
Create apps/api/src/services/graph/graph-builder-service.ts
- Pattern: Observer/Event
- onFindingCreated(finding: Finding): create/update graph nodes + edges
  - AWS finding → create AccountNode + ResourceNode + FindingNode + edges
  - Edge weight = exploitability (from finding metadata or default 0.5)
- onSaasFindingCreated(finding: SaasFinding): create SaasIdentityNode

TASK A2 — Attack Graph API (100 lines max):
Create apps/api/src/routes/graph/attack-graph.ts
- GET /api/v1/graph/nodes — list nodes for org (paginated)
- GET /api/v1/graph/paths — find attack paths from a given node
  - Query: { startNodeId, maxDepth?: number }
  - Returns: AttackPath[] with criticalityScore

TASK A3 — Attack Graph Page (150 lines max — use force-directed SVG):
Create apps/web/src/app/(dashboard)/security/graph/page.tsx
- Server Component: fetch nodes + critical paths
- Client Component: simple force-directed graph using d3-hierarchy
  (keep it simple — production visualization is Sprint 22 Trust Portal)
- Show: top 5 critical attack paths as list with exploitability scores

TASK A4 — Tests: GraphBuilderService with mock findings, API routes
```

---

### Track B — B2→A Merge: SaaS nodes feed Sprint 14

```
CONTEXT: This is the B2→A merge point.
NOTE ON DAY NUMBERING: parallel-execution-plan.md calls this "Day 12"
in its ASCII timeline — that's because it counts each sprint's duration
sequentially. In the daily prompt numbering we use here, this falls on
Day 9. They are the same logical event: SaaS findings start feeding the
attack graph. The merge is correct on schedule.

Ensure SaaS findings from Sprint 15 flow into the attack graph from Sprint 14.

TASK B1 — Wire SaaS finding events to graph builder:
In saas-scan-worker.ts: after persisting saas_finding, emit to graph.finding queue
In apps/api/src/workers/graph-builder-worker.ts (new, 80 lines max):
- CF Queue consumer for graph.finding messages
- Calls GraphBuilderService.onSaasFindingCreated()

TASK B2 — Integration test: saas scan → finding → graph node appears
```

---

### Track C — automationhub-soar packaging

```
TASK C1 — automationhub-soar skill (150 lines max):
Create packages/skills/automationhub-soar/index.ts
Read: docs/skills/skill-catalog.md → automationhub-soar section
Read: docs/sprints/sprint-21-platform-connect.md → FULL.6 section
IMPORTANT: AutomationHub DAG engine is real (NetworkX, 220 files).
Do NOT rebuild SOAR from scratch.
- execute():
  - Bridge AutomationHub's DAG runner to OpenSyber's event system
  - Register action types: execute_playbook, create_jira_ticket,
    send_alert, quarantine_resource, run_script
  - Use emitter.automationAction({ type, playbook, result })
    (7th SkillEmitter method — defined in SDK on Day 1 Track C)

CRITICAL COVERAGE GATE — this skill only:
AutomationHub source code currently has ~18% coverage (code-verified).
This skill CANNOT merge until it reaches 80%.
Run: cd packages/skills/automationhub-soar && pnpm test --coverage
Required output: Lines ≥ 80% | Branches ≥ 80%
If below 80% → write more tests, do NOT proceed.

TASK C2 — Tests (write all error paths — not just happy path):
- execute_playbook success: mock DAG returns success
- execute_playbook failure: mock DAG throws → skill throws (no catch)
- create_jira_ticket action type routed correctly
- quarantine_resource action type routed correctly
- empty playbook DAG edge case (0 steps)
TASK C3 — Coverage gate: must show ≥ 80% before merge. Block Day 10 if red.
```

---

## Day 10 — Attack Graph Enrichment (A) + Sprint 15 Merge (B) + qestro packaging (C)

### Track A — Sprint 14: Attack Graph Enrichment + AI Triage Prep

```
CONTEXT: Core attack graph is operational. Enrich with CVE data + CVSS scores.
These enriched nodes will feed Sprint 16 AI Intelligence directly.

DESIGN PATTERN: Decorator (enrichment wraps existing node data)

TASK A1 — CVE Enrichment (100 lines max):
Create apps/api/src/services/graph/cve-enricher.ts
- Pattern: Decorator
- enrichNode(node: AttackNode): fetch CVSS score from NVD API (public)
- Cache in KV for 24h (CVE data rarely changes)
- Add cvssScore + cvssVector to node.metadata

TASK A2 — Sprint 14 DoD: read sprint-14-attack-graph.md, mark all done.

ATTACK GRAPH MILESTONE (A3): Can we visualize a full attack path from
an exposed S3 bucket → EC2 instance → compromised identity?
If yes → Milestone B (Attack + SaaS) achieved.

echo "MILESTONE B: Attack graph + SaaS posture operational. Day 10/35."
```

---

### Track C — qestro-security-testing packaging

```
TASK C1 — qestro-security-testing skill (120 lines max):
Create packages/skills/qestro-security-testing/index.ts
Read: docs/skills/skill-catalog.md → qestro-security-testing section
Read: docs/sprints/sprint-21-platform-connect.md → FULL.6 qestro section
IMPORTANT: QeStro generates security tests. Wrap, don't rebuild.
- execute():
  - On new finding: generate_security_test(finding)
  - Output: Vitest test file that asserts the vulnerability is fixed
  - emitter.automation_action({ type: 'security_test_generated', testFile })
- This closes the detect → fix → verify loop automatically

TASK C2 — openhands-agent skill packaging:
Create packages/skills/openhands-agent/index.ts
Read: docs/daily-prompts/master-plan.md → OpenHands Integration section
- execute(): provision OpenHands container via Hetzner API
- Monitor agent activity: log all actions as audit events
- emitter.finding() for suspicious agent behavior (data exfil patterns)

TASK C3 — Track C completion gate:
All 11 skills packaged. Run: ls packages/skills/ — must show all 11 dirs.
Run pnpm test in each package. All must pass.

echo "Track C COMPLETE. All 11 skills ready for Track A/D integration."
```

---

### Week 2 End-of-Week Gate

```bash
pnpm typecheck && pnpm test --coverage && pnpm build

# Milestone verification:
# - Milestone A (CSPM + Risk): Achieved Day 8
# - Milestone B (Attack + SaaS): Achieved Day 10
# - Track C: All 11 skills packaged
# - On schedule: Day 10/35 parallel → 71% of critical path done through S14

echo "Week 2 complete. Day 10/35. All Track C skills packaged."
echo "Milestones A ✓ B ✓ | Next: Sprint 16 AI Intelligence (Day 14)"
```
