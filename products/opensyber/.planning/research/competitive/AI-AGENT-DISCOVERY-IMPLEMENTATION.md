# AI Agent Discovery Suite — Implementation Checklist

> Goal: ship a discovery-first wedge that finds AI agents/MCP surfaces, scores risk, and converts teams to secured OpenSyber runtime.
>
> Flow: **Discover -> Score -> Protect**
>
> Primary plan linkage: `.planning/research/competitive/EXECUTION-BOARD-90D.md`

---

## 0) Scope Lock (Before Coding)

- [ ] Confirm MVP boundaries:
  - [ ] Discovery across connected repos/workspaces
  - [ ] MCP + agent signature detection
  - [ ] Risk scoring
  - [ ] Owner mapping
  - [ ] One-click "Protect with OpenSyber"
- [ ] Define explicit non-goals for v1:
  - [ ] No full static analyzer engine
  - [ ] No auto-remediation in v1
  - [ ] No enterprise SSO role sync dependency
- [ ] Approve success thresholds:
  - [ ] >= 80% precision on seeded corpus
  - [ ] >= 60% owner mapping coverage
  - [ ] >= 25% unsecured->protected conversion (14-day)

---

## 1) Data Model + Persistence

### 1.1 New tables (in `packages/db/src/schema/`)

- [ ] `agent_discovery_runs`
  - [ ] `id`, `orgId`, `startedAt`, `endedAt`, `status`, `sourceType`, `sourceRef`
  - [ ] `stats`: total found, total scored, errors
- [ ] `discovered_agents`
  - [ ] `id`, `orgId`, `runId`, `fingerprint`
  - [ ] `name`, `framework`, `runtime`, `surfaceType` (`repo`, `mcp`, `cron`, `script`)
  - [ ] `locationPath`, `lastSeenAt`, `status` (`unsecured`, `protected`, `ignored`)
- [ ] `discovered_agent_capabilities`
  - [ ] `agentId`, `canShell`, `canNetwork`, `canFileRead`, `canFileWrite`, `hasSecretsAccess`
- [ ] `discovered_agent_risk_scores`
  - [ ] `agentId`, `score`, `severity`, `factorsJson`, `scoredAt`
- [ ] `discovered_agent_owners`
  - [ ] `agentId`, `ownerUserId` nullable, `ownerTeamId` nullable, `ownerSource`, `confidence`
- [ ] `discovery_protection_links`
  - [ ] `agentId`, `instanceId`, `protectedAt`, `protectionMethod`

### 1.2 Migrations

- [ ] Create migration in `packages/db/migrations/` for new tables and indexes
- [ ] Add indexes:
  - [ ] `discovered_agents(orgId, status)`
  - [ ] `discovered_agents(orgId, fingerprint)` unique-ish
  - [ ] `discovered_agent_risk_scores(agentId, scoredAt desc)`
- [ ] Run local migration + smoke query checks

### 1.3 Shared types

- [ ] Add DTOs in `packages/shared/src/types/`:
  - [ ] `DiscoveryRun`
  - [ ] `DiscoveredAgent`
  - [ ] `AgentRiskScore`
  - [ ] `AgentOwnerMapping`
- [ ] Export constants/enums in `packages/shared/src/constants/`

---

## 2) Scanner + Detection Engine

### 2.1 Signature registry

- [ ] Add signature config module (API service layer):
  - [ ] Framework signatures (LangChain, CrewAI, OpenAI Agents SDK, etc.)
  - [ ] MCP signatures (server configs, tool declarations, connector packages)
  - [ ] Script signatures (cron invocations, CI automation hooks)
- [ ] Add weighted confidence per signature

### 2.2 Scanner service

- [ ] Create service in `apps/api/src/services/discovery/`:
  - [ ] `runDiscoveryScan(source)` orchestrator
  - [ ] `extractAgentCandidates(files)` matcher
  - [ ] `fingerprintCandidate(candidate)` de-dup logic
- [ ] Handle partial failures per source without failing whole run
- [ ] Persist run status + stats in `agent_discovery_runs`

### 2.3 Owner mapping service

- [ ] Heuristics:
  - [ ] Git blame / commit author hints (if available)
  - [ ] Path ownership conventions (`teams/`, `agents/`, etc.)
  - [ ] Existing org user/team mappings
- [ ] Confidence score and fallback "Unassigned"

---

## 3) Risk Scoring Engine

### 3.1 Factor model

- [ ] Define score factors:
  - [ ] Secret access exposure
  - [ ] Shell/network capability
  - [ ] Missing runtime attestation
  - [ ] Unverified MCP/tool dependencies
  - [ ] Stale or ownerless agents
- [ ] Assign deterministic weights and thresholds

### 3.2 Scoring implementation

- [ ] Implement `scoreDiscoveredAgent(agent)` in service layer
- [ ] Save factor breakdown JSON for explainability
- [ ] Map to severity buckets (`low`, `medium`, `high`, `critical`)

### 3.3 Explainability output

- [ ] API should return:
  - [ ] top risk factors
  - [ ] recommended next action
  - [ ] projected reduction if protected

---

## 4) API Endpoints (Hono)

Create routes in `apps/api/src/routes/` and register in `apps/api/src/routes/register.ts`.

- [ ] `POST /api/discovery/runs`
  - [ ] Start a discovery scan
- [ ] `GET /api/discovery/runs/:runId`
  - [ ] Run status + stats
- [ ] `GET /api/discovery/agents`
  - [ ] Paginated list with filters (`status`, `severity`, `owner`, `sourceType`)
- [ ] `GET /api/discovery/agents/:agentId`
  - [ ] Detailed profile + score factors
- [ ] `PATCH /api/discovery/agents/:agentId/owner`
  - [ ] Manual owner assignment
- [ ] `POST /api/discovery/agents/:agentId/protect`
  - [ ] Create/link protected runtime record
- [ ] `PATCH /api/discovery/agents/:agentId/status`
  - [ ] `ignored`, `unsecured`, `protected`

Security + quality gates:
- [ ] Apply auth + org context middleware
- [ ] Enforce org-scoped access checks
- [ ] Add rate limits for scan start endpoint
- [ ] Add request/response schema validation

---

## 5) Dashboard UI (Web)

### 5.1 Navigation + pages

- [ ] Add sidebar/nav entry:
  - [ ] `/dashboard/agent-discovery`
- [ ] Page scaffolds:
  - [ ] discovery overview
  - [ ] discovered agent detail

### 5.2 Discovery overview UI

- [ ] KPI cards:
  - [ ] total discovered
  - [ ] unsecured
  - [ ] protected
  - [ ] critical risk count
- [ ] Table/grid:
  - [ ] agent name, framework, owner, risk, status, last seen
- [ ] Filters:
  - [ ] status, severity, owner, source type
- [ ] Bulk actions:
  - [ ] mark ignored
  - [ ] assign owner

### 5.3 Agent detail UI

- [ ] Risk factor breakdown
- [ ] Capability profile (shell/network/secrets)
- [ ] Owner assignment controls
- [ ] CTA: **Protect with OpenSyber**
- [ ] Post-protection status state

### 5.4 Empty/loading/error states

- [ ] First scan onboarding state
- [ ] No results state
- [ ] Scan failure state with retry guidance

---

## 6) Protect Conversion Flow

- [ ] Implement "Protect with OpenSyber" backend action:
  - [ ] create or link instance
  - [ ] store link in `discovery_protection_links`
  - [ ] transition agent status to `protected`
- [ ] Add user-visible transition UX:
  - [ ] action in table row
  - [ ] confirmation modal
  - [ ] success state with deep link to security dashboard
- [ ] Track conversion analytics event

---

## 7) Analytics + KPI Instrumentation

Add event tracking hooks for funnel and board KPIs.

- [ ] `discovery_scan_started`
- [ ] `discovery_scan_completed`
- [ ] `discovered_agent_viewed`
- [ ] `discovered_agent_owner_assigned`
- [ ] `discovered_agent_protect_clicked`
- [ ] `discovered_agent_protected`

Derived metrics:
- [ ] discovery precision on seeded corpus
- [ ] owner mapping coverage %
- [ ] unsecured->protected conversion %
- [ ] median time to protect discovered agent

---

## 8) Testing Plan

### 8.1 API tests (`apps/api/src/routes/*.test.ts`)

- [ ] discovery run lifecycle test
- [ ] list filters and pagination test
- [ ] owner assignment authz test
- [ ] protect action org isolation test

### 8.2 Service tests (`apps/api/src/services/discovery/*.test.ts`)

- [ ] signature matching precision tests
- [ ] fingerprint de-dup tests
- [ ] risk score deterministic output tests
- [ ] owner mapping confidence tests

### 8.3 Web tests (`apps/web/src/...*.test.tsx`)

- [ ] discovery overview renders KPI cards + table
- [ ] filters update query and list correctly
- [ ] protect CTA flow transitions status
- [ ] empty and failure states

### 8.4 Seeded evaluation suite

- [ ] Build small seeded repo fixtures (positive + negative signatures)
- [ ] Automated precision/recall report for scanner regressions

---

## 9) Docs + Enablement

- [ ] Add docs page: "Run Discovery in 10 Minutes"
- [ ] Add product narrative: Discover -> Score -> Protect
- [ ] Add short GTM comparison snippet for sales/demo use
- [ ] Include troubleshooting section for false positives and owner mapping

---

## 10) Rollout Strategy

### Phase A (internal alpha)
- [ ] Enable for internal org only
- [ ] Validate precision, performance, and conversion flow

### Phase B (design partners)
- [ ] Enable for selected orgs
- [ ] Weekly feedback + scoring weight tuning

### Phase C (GA)
- [ ] Enable by default for qualifying plans
- [ ] Launch docs + announcement + in-product tour

---

## 11) Definition of Done (MVP)

- [ ] Discovery run can scan and persist inventory reliably
- [ ] Risk scoring and factor breakdown shown in UI
- [ ] Owner mapping works with manual override
- [ ] "Protect with OpenSyber" converts record to protected state
- [ ] KPI events are emitted and visible in analytics dashboard
- [ ] Core tests pass (API + service + web)
- [ ] Docs published for discovery onboarding

---

## Suggested GSD Sequencing

- [ ] Phase 1: data model + scanner + basic API
- [ ] Phase 2: dashboard + risk detail + owner mapping
- [ ] Phase 3: protect flow + analytics + docs + rollout

Command path:
- `/gsd-plan-phase 1`
- `/gsd-execute-phase`

