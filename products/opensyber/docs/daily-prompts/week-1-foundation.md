# Week 1 — Foundation (Days 1–5)

**Track A:** Sprint 11 — Cloud CSPM (Prowler)
**Track B:** Sprint 12 — Credential Lifecycle (Vault + JIT)
**Track C:** Sprint 11b — Skill SDK → tokenforge + queryflux packaging

---

## Day 1 — Parallel Start: CSPM Core + Vault Schema + Skill SDK

### Vision
Today we lay the foundation for the entire CNSP platform. Three tracks
start simultaneously. Prowler scans become the first heartbeat of the
system — every subsequent risk score, attack graph, and AI insight
depends on the findings flowing from today's work.

**Milestone target:** Prowler CLI runs against a test AWS account and
pushes structured findings into D1 by end of day.

> **PREREQUISITE (run before anything else):**
> Set up git worktrees for all 3 tracks — see master-plan.md → "Git
> Worktrees" section (line ~429). Each track runs in an isolated branch.
> Track ownership rules: C → `packages/skills/` only; B → `routes/saas/` +
> `routes/vault/`; A → `services/` + `workers/` + ALL schema migrations.
> Schema migrations are Track A's exclusive responsibility. Tracks B and C
> submit requests via `packages/db/migration-requests/` files.

---

### Track A — Sprint 11 CSPM: Prowler Adapter + Finding Ingest

```
SYSTEM CONTEXT: You are building the Cloud CSPM module for OpenSyber,
a secure AI agent hosting platform. Read sprint doc first:
docs/sprints/sprint-11-cspm-prowler.md

DESIGN PATTERN: Adapter (wraps Prowler CLI) + Repository (FindingRepository)
FILE BUDGET: Every source file ≤ 200 lines. Test files exempt.

OPEN SOURCE: Use Prowler (already installed via Docker or pip install prowler).
Do NOT build a custom cloud scanner from scratch.

TASK A1 — Prowler Adapter (100 lines max):
Create apps/api/src/skills/cspm/prowler-adapter.ts
- Adapter pattern wrapping `prowler aws --output-format json-asff`
- Accept: { accountId, region, credentials } → return: Finding[]
- Use SkillEmitter interface: emitter.finding({ severity, resource, rule })
- Types: import from packages/shared/src/types/findings.ts (create if missing)
- Pattern comment at top: // Pattern: Adapter

TASK A2 — Finding Repository (150 lines max):
Create apps/api/src/repositories/finding-repository.ts
- Repository pattern over D1 findings table
- Methods: insert(finding), listByAccount(accountId, cursor?), getById(id)
- Cursor-based pagination: { data, nextCursor, hasMore }
- Use Drizzle query builder only. No raw SQL.
- Pattern comment: // Pattern: Repository

TASK A3 — CSPM Route Handler (80 lines max):
Create apps/api/src/routes/cspm/trigger-scan.ts
- POST /api/v1/cspm/scan — trigger Prowler scan for an account
- Auth: clerkAuth() → requirePermission('cspm.scan.write')
- Validate body: Zod schema { cloudAccountId, regions?: string[] }
- Enqueue via Cloudflare Queue (CF_QUEUE binding)
- Return: { jobId, status: 'queued' }
- Audit log: recordAuditEvent({ actorId, action: 'cspm.scan.trigger' })

TASK A4 — Schema migration (add findings table):
MIGRATION PROTOCOL: Track A owns ALL migrations. Tracks B and C must NOT
run db:generate. If B or C need tables, they create:
  packages/db/migration-requests/track-X-dayY.md (table + columns spec)
Track A then batches them into one migration. This prevents conflicts.

Add to packages/db/src/schema/security.ts:
  findings table: id, orgId, cloudAccountId, ruleId, severity, resourceId,
    resourceType, title, description, remediationSteps, status, metadata TEXT,
    detectedAt, resolvedAt, createdAt
BATCH: Also include vault_secrets + vault_rotation_logs from Track B's
  migration-requests/track-b-day1.md (Track B files that file today).
Generate once for all: cd packages/db && pnpm db:generate

TASK A5 — Tests (no line limit):
Create apps/api/src/skills/cspm/prowler-adapter.test.ts
Create apps/api/src/repositories/finding-repository.test.ts
Create apps/api/src/routes/cspm/trigger-scan.test.ts
- Mock Prowler subprocess output with sample ASFF findings JSON
- Assert Finding[] shape, pagination cursors, audit log calls
- Coverage target: 80% lines + branches on all new files

SECURITY AUDIT after this task:
[ ] Prowler credentials never logged (mask in adapter)
[ ] cloudAccountId scoped to org via resolveOrgContext()
[ ] Zod validates all route body fields
[ ] requirePermission('cspm.scan.write') present

RUN: pnpm typecheck && pnpm test && pnpm build
```

---

### Track B — Sprint 12 Vault: Schema + KV AES-256 Store

```
SYSTEM CONTEXT: You are building the Credential Lifecycle module for
OpenSyber. Read: docs/sprints/sprint-12-credential-lifecycle.md

DESIGN PATTERN: Repository + Strategy (encryption algorithm is swappable)
FILE BUDGET: ≤ 200 lines per source file.

OPEN SOURCE: Use Web Crypto API (built-in) for AES-256-GCM. Do NOT add
third-party crypto libraries. Cloudflare Workers has native SubtleCrypto.

TASK B1 — Vault Schema (migration request only — Track B does NOT run db:generate):
Create packages/db/migration-requests/track-b-day1.md with:
  vault_secrets: id, orgId, agentId, name, encryptedValue TEXT,
    iv TEXT, tag TEXT, algorithm (default 'AES-GCM-256'), rotatedAt,
    expiresAt, createdAt, updatedAt
  vault_rotation_logs: id, secretId, orgId, rotatedBy, reason, createdAt
Track A will include these in the Day 1 batch migration (Task A4).
Track B can use the schema file after Track A runs pnpm db:generate.

TASK B2 — VaultService (150 lines max):
Create apps/api/src/services/vault-service.ts
- Pattern: Repository + Strategy
- encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedSecret>
- decrypt(encryptedSecret: EncryptedSecret, key: CryptoKey): Promise<string>
- Use AES-GCM, 256-bit key, 96-bit IV (randomly generated per encrypt call)
- Store key in CF KV as base64 (never in D1 with the ciphertext)

TASK B3 — Vault Route (80 lines max):
Create apps/api/src/routes/vault/secrets.ts
- POST /api/v1/vault/secrets — store secret
- GET /api/v1/vault/secrets/:id — retrieve + decrypt (requires vault.secret.read)
- DELETE /api/v1/vault/secrets/:id — soft-delete (requires vault.secret.delete)
- requirePermission on each verb

TASK B4 — Tests covering encryption round-trip + RBAC

SECURITY AUDIT after this task:
[ ] IV is unique per encrypt call (never reused)
[ ] Key stored in KV, ciphertext in D1 — separated
[ ] Vault routes require vault.* permissions
[ ] Deleted secrets return 404 (no soft-delete leakage)
```

---

### Track C — Sprint 11b: Skill SDK Core

```
SYSTEM CONTEXT: You are building the Skill SDK — the packaging interface
that every portfolio skill will use to integrate with OpenSyber.
Read: docs/sprints/sprint-11b-skill-sdk.md

DESIGN PATTERN: Observer/Event (SkillEmitter) + Factory (SkillLoader)
FILE BUDGET: ≤ 200 lines per source file.

IMPORTANT: The Skill SDK is the foundation every other skill depends on.
Get the interfaces right today — they cannot change without breaking all skills.

TASK C1 — Core Types (150 lines max):
Create packages/shared/src/types/skills.ts
- SkillContext: { agentId, orgId, userId, cloudAccounts, kvNamespace, db }
- SkillEmitter: CANONICAL definition — MUST include ALL 7 methods:
    finding(), saasFinding(), riskDelta(), attackEdge(),
    complianceEvidence(), remediationSuggestion(), automationAction()
  (automationAction is required for Sprint 21 SOAR — define it now even if
   Sprint 11b doesn't use it yet. This prevents a breaking SDK change later.)
- SkillProfile: id, name, version, category, tier, targets, outputs, schedule
- SkillManifest: profile + execute(ctx, emitter) function
- All types exported with JSDoc. No 'any' — use 'unknown' + type guards.
- NOTE: SkillRunner wraps execute() in an error boundary — skills must THROW
  on error, never catch internally. Do NOT add try/catch inside execute().

TASK C2 — SkillLoader (100 lines max):
Create apps/api/src/skills/skill-loader.ts
- Pattern: Factory
- load(skillId: string): Promise<SkillManifest>
- Reads from D1 skills table (installed skills registry)
- Validates manifest shape with Zod at load time
- Throws SkillLoadError with context on failure

TASK C3 — SkillRunner (120 lines max):
Create apps/api/src/skills/skill-runner.ts
- Pattern: Command + Observer
- run(manifest, context): Promise<SkillRunResult>
- Wraps execute() call with timeout (30s default), error boundary
- Collects all emitted events into SkillRunResult.events[]
- Records skill_runs row in D1 after completion

TASK C4 — Tests for SkillLoader + SkillRunner

DoD gate: SDK interfaces are stable. Every other Track C day builds on this.
```

---

### Day 1 — End of Day Gate

```bash
# Run on ALL tracks before EOD:
pnpm typecheck && pnpm test && pnpm build

# Coverage enforcement (80% lines + branches on new files):
pnpm vitest run --coverage \
  --coverage.thresholds.lines=80 \
  --coverage.thresholds.branches=80
# EXCEPTION: packages/tokenforge/ requires 90% (higher threshold)
# See master-plan.md coverage table for per-package thresholds

# Error path coverage check: every new service must have tests for:
# [ ] Happy path (normal input)
# [ ] Invalid input (Zod validation error)
# [ ] DB failure (mock Drizzle throwing)
# [ ] Auth failure (401/403 response)

# File budget check:
find apps packages/shared/src packages/db/src -name "*.ts" \
  -not -name "*.test.ts" -not -name "*.d.ts" \
  | xargs wc -l | awk '$1 > 200 {print "OVER BUDGET:", $0}'

# Security scan:
pnpm audit --audit-level=high
```

---

## Day 2 — CSPM Worker + JIT Rotation + SDK tokenforge Skill

### Track A — Sprint 11: Queue Worker + Finding Dedup

```
CONTEXT: Yesterday's Prowler adapter is built. Today wire the CF Queue
consumer that processes scan jobs and deduplicates findings.

DESIGN PATTERN: Command (each queue message = RemediationCommand shape)
FILE BUDGET: ≤ 200 lines

TASK A1 — Queue Consumer (150 lines max):
Create apps/api/src/workers/cspm-scan-worker.ts
- CF Queue consumer: queue.consume(async (batch) => { ... })
- For each message: instantiate ProwlerAdapter, run scan, persist findings
- Dedup: skip finding if same (accountId + ruleId + resourceId) exists in last 24h
- On completion: emit Cloudflare Event → risk scoring queue

TASK A2 — Cloud Accounts Route (120 lines max):
Create apps/api/src/routes/cspm/cloud-accounts.ts
- GET /api/v1/cspm/accounts — list connected accounts (scoped to org)
- POST /api/v1/cspm/accounts — add AWS/GCP/Azure account
  - Validate: provider enum, credentials shape per provider, orgId scoping
  - Encrypt credentials via VaultService before storing
- DELETE /api/v1/cspm/accounts/:id — remove (with cascade)

TASK A3 — Tests for queue worker (mock CF Queue API) + cloud accounts routes

SECURITY AUDIT:
[ ] Cloud credentials encrypted via VaultService before D1 insert
[ ] Dedup logic uses DB unique constraint (not just application-level check)
[ ] Queue consumer handles poison pill messages (dead-letter after 3 retries)
```

---

### Track B — Sprint 12: JIT Rotation Worker

```
CONTEXT: Vault schema done. Today build JIT (Just-In-Time) credential rotation.

DESIGN PATTERN: Saga (rotation is a multi-step distributed operation)
FILE BUDGET: ≤ 200 lines

TASK B1 — RotationService (150 lines max):
Create apps/api/src/services/rotation-service.ts
- Pattern: Saga
- scheduleRotation(secretId, intervalDays): store in vault_rotation_schedule
- rotateNow(secretId): fetch current → generate new → encrypt new →
    update vault_secrets → log to vault_rotation_logs → notify via Resend

TASK B2 — Rotation Cron (50 lines max):
Create apps/api/src/workers/rotation-cron.ts
- CF Cron trigger: 0 */6 * * * (every 6 hours)
- Query secrets with expiresAt < now() + 48h warning window
- Dispatch rotation jobs to CF Queue

TASK B3 — Tests: rotation saga steps, cron trigger mock
```

---

### Track C — Sprint 11b: tokenforge Skill Packaging

```
CONTEXT: SDK is built. Today package tokenforge as the reference skill.
Read: docs/skills/skill-catalog.md → tokenforge-session-security section.

IMPORTANT: TokenForge is 100% real (same monorepo packages/tokenforge/).
Do NOT build from scratch. Package the existing code as a SkillManifest.

TASK C1 — tokenforge-session-security skill (100 lines max):
Create packages/skills/tokenforge-session-security/index.ts
- Implement SkillManifest interface (from yesterday's SDK)
- execute(ctx, emitter):
  - Query agent's session events from D1
  - Run TokenForge trust scoring on each session
  - emitter.finding() for sessions with trust < 50 (suspicious binding)
  - emitter.riskDelta({ source: 'tokenforge', delta: +15 }) if critical
- schedule: { trigger: 'scheduled', cron: '*/15 * * * *' }

TASK C2 — skill.json manifest:
Create packages/skills/tokenforge-session-security/skill.json
- id, name, version, category: 'session_security', tier: 'free'
- All required fields from SkillProfile type

TASK C3 — queryflux-mcp skill packaging (80 lines max):
Create packages/skills/queryflux-mcp/index.ts
- Wraps QueryFlux MCP NL→SQL tools as SkillManifest
- execute(): registers MCP tools into agent's tool registry
- Tools exposed: nl_to_sql, execute_query, explain_query

TASK C4 — Tests for both skills using mock SkillContext
```

---

## Day 3 — CSPM Frontend + Vault UI + SDK Finalization

### Track A — Sprint 11: CSPM Dashboard Page

```
CONTEXT: API layer for findings and cloud accounts is done.
Today build the frontend dashboard page for CSPM.

DESIGN PATTERN: Server Component (data fetch) + Client Component (interactive filters)
FILE BUDGET: ≤ 200 lines per component file. Split aggressively.

OPEN SOURCE: Use existing ui/ package components. No new component libraries.

TASK A1 — CSPM Dashboard Page (180 lines max):
Create apps/web/src/app/(dashboard)/security/cspm/page.tsx
- Server Component: fetch /api/v1/cspm/accounts + /api/v1/cspm/findings
- Display: connected accounts list, findings by severity (Critical/High/Med/Low)
- Empty state: "Connect your first cloud account" with CTA button
- Loading skeleton (use existing Skeleton component from ui/)

TASK A2 — FindingCard Component (100 lines max):
Create apps/web/src/app/(dashboard)/security/cspm/FindingCard.tsx
- Shows: severity badge (color from design system), resource, rule, age
- Apple HIG: card background neutral-900/30, border neutral-800, rounded-xl
- Click → opens FindingDetail modal

TASK A3 — ConnectAccountModal (150 lines max, client component):
Create apps/web/src/app/(dashboard)/security/cspm/ConnectAccountModal.tsx
- 'use client' at line 1
- Multi-step form: 1) Choose provider (AWS/GCP/Azure) 2) Enter credentials
  3) Validate + save
- Uses existing modal pattern: fixed inset-0 z-50 bg-black/60 overlay

TASK A4 — Component tests (React Testing Library)
```

---

### Track B — Sprint 12: Vault UI

```
TASK B1 — Vault Page (180 lines max):
Create apps/web/src/app/(dashboard)/security/vault/page.tsx
- Server Component: list secrets (name, rotatedAt, expiresAt — NOT values)
- Show rotation status: green (fresh), amber (expiring soon), red (expired)

TASK B2 — AddSecretModal + RotateButton (client components, ≤ 150 lines each)

TASK B3 — Component tests
```

---

### Track C — SDK Complete + finsavvyai packaging

```
TASK C1 — Skill install API route (100 lines max):
Create apps/api/src/routes/skills/install.ts
- POST /api/v1/skills/install — install skill from registry
- Validate skill manifest, insert into D1 skills table
- Return installed skill with status

TASK C2 — finsavvyai-llm-gateway skill packaging:
Create packages/skills/finsavvyai-llm-gateway/index.ts
Read: docs/skills/skill-catalog.md → finsavvyai-llm-gateway section
IMPORTANT: 95% real code at 02_AI_AGENTS/FinSavvyAI/. Do NOT rebuild.
- execute(): wrap FinSavvyAI provider routing as MCP tools
- Expose: analyze_llm_usage, detect_prompt_injection, route_to_provider
- emitter.riskDelta() for suspicious LLM patterns

TASK C3 — Track C SDK finalization: run full test suite, ensure 80%+ coverage
```

---

## Day 4 — Risk Scoring Setup (A) + SaaS Connectors (B) + More Skill Packaging (C)

### Track A — Sprint 13 Prep: Risk Scoring Schema

```
CONTEXT: Sprint 13 (Risk Intelligence) officially starts Day 6 but we can
pre-build the schema and scoring framework today to remove Day 6 blockers.

DESIGN PATTERN: Strategy (RiskScorer — each signal is a Strategy)
FILE BUDGET: ≤ 200 lines

TASK A1 — Risk schema:
Add to packages/db/src/schema/security.ts:
  risk_scores: id, orgId, entityId, entityType, score (int 0-100),
    signals TEXT (JSON array), calculatedAt, previousScore, trend
  risk_signals: id, riskScoreId, source, weight, rawValue, normalizedValue,
    metadata TEXT, createdAt

TASK A2 — RiskScorer base class (100 lines max):
Create apps/api/src/services/risk/risk-scorer.ts
- Pattern: Strategy
- RiskSignal interface: { source, weight, value, metadata }
- RiskScorer abstract class: addSignal(), calculate(): number (0-100)
- WeightedRiskScorer extends RiskScorer: weighted average with bounds

TASK A3 — First signal: CspmRiskSignal (80 lines max):
Create apps/api/src/services/risk/signals/cspm-signal.ts
- Implements RiskSignal
- Input: Finding[] for an account
- Scoring: Critical=25pts, High=15pts, Med=5pts, Low=1pt, cap at 100
- Pattern: Strategy (pluggable into WeightedRiskScorer)

TASK A4 — Tests for RiskScorer + CspmRiskSignal
```

---

### Track B — Sprint 12 Complete: Agent Token Rotation

```
TASK B1 — Agent gateway token rotation (100 lines max):
Create apps/api/src/services/rotation/agent-token-rotator.ts
- Rotate X-Gateway-Token for agent instances on schedule
- Generate new token → update KV → notify agent via webhook → invalidate old

TASK B2 — Sprint 12 integration test: full rotation saga end-to-end mock
TASK B3 — Sprint 12 DoD: all tasks in sprint-12-credential-lifecycle.md marked done
```

---

### Track C — pipewarden + tenantiq packaging

```
TASK C1 — pipewarden-cicd-security skill (120 lines max):
Create packages/skills/pipewarden-cicd-security/index.ts
Read: docs/skills/skill-catalog.md → pipewarden-cicd-security section
IMPORTANT: PipeWarden has 168 E2E tests, real code. Do NOT rebuild.
- execute(): scan CI/CD pipeline configs for security misconfigs
- emitter.complianceEvidence() for SOC2/PCI CI/CD controls

TASK C2 — tenantiq-m365-security skill (120 lines max):
Create packages/skills/tenantiq-m365-security/index.ts
Read: docs/skills/skill-catalog.md → tenantiq-m365-security section
Read: docs/sprints/sprint-15-saas-posture.md → FULL.0 section
IMPORTANT: TenantIQ M365 scanning is real. Package, do NOT rebuild.
- execute(): run TenantIQ M365 posture scan
- emitter.saasFinding() for each policy violation
- 14 compliance rules, 9 auto-remediation checks
```

---

## Day 5 — Sprint 11 Complete + Sprint 12 Complete + SDK Milestone

### Track A — Sprint 11 Final: Prowler Cron + Sprint Closeout

```
CONTEXT: Sprint 11 milestone — CSPM scanning is live. Complete remaining tasks.

TASK A1 — CSPM Cron scheduler (60 lines max):
Create apps/api/src/workers/cspm-cron.ts
- CF Cron: 0 */4 * * * (every 4 hours — configurable per account)
- Query cloud_accounts where nextScanAt < now()
- Dispatch scan jobs to CF Queue

TASK A2 — Findings aggregate API (100 lines max):
Create apps/api/src/routes/cspm/findings-summary.ts
- GET /api/v1/cspm/summary — return: { critical, high, medium, low, trend }
- Query findings grouped by severity with 7-day trend
- Cache result in KV for 5 min (expensive aggregate query)

TASK A3 — Sprint 11 DoD: read sprint-11-cspm-prowler.md, mark every
MVP.* and FULL.* task as complete. Run full test suite.

TASK A4 — MILESTONE A CHECK: Can we scan an AWS account and see findings
in the dashboard? If yes → Milestone A achieved, unblock Sprint 13.
```

---

### Track C — Sprint 11b Complete + upm-dependency-audit

```
TASK C1 — upm-dependency-audit skill (120 lines max):
Create packages/skills/upm-dependency-audit/index.ts
Read: docs/skills/skill-catalog.md → upm-dependency-audit section
SCOPE: npm/PyPI/OpenClaw only (Cargo, Go, Hex stubs are empty — skip them)
- execute(): scan agent container's npm/PyPI deps via UPM CVE scanner
- emitter.finding() for each CVE >= HIGH severity

TASK C2 — Sprint 11b DoD: read sprint-11b-skill-sdk.md, mark all tasks done.

TASK C3 — Skill Registry Seed:
Create apps/api/src/db/seeds/skills-registry.ts
- Seed D1 with all 5 packaged skills (tokenforge, queryflux, finsavvyai,
  pipewarden, tenantiq, upm)
- Include metadata: name, description, category, tier, version, author

TRACK C MILESTONE: SDK + 6 skills packaged. Track C feeding Track A on schedule.
```

---

### Week 1 End-of-Week Gate

```bash
# Full system health check — run on all tracks:
pnpm typecheck
pnpm test --coverage
pnpm build
pnpm audit --audit-level=high

# Milestone check:
# Track A: Sprint 11 complete (CSPM scanning operational)
# Track B: Sprint 12 complete (Vault + JIT rotation operational)
# Track C: Sprint 11b complete + 6 skills packaged
# Parallel Day 5 → on schedule for 35-day wall-clock

echo "Week 1 complete. Parallel Day 5/35. Milestones: A=✓ B=✓ C=✓"
```
