# CNSP Daily Execution — Master Plan

**Last updated:** 2026-03-01
**Total wall-clock:** 35 days parallel (4 tracks)
**Critical path:** Track A — Core Spine

---

## How to Use These Prompts

Each week file (`week-1-foundation.md` through `week-5-platform.md`) contains
**paste-and-run day prompts**. Open a fresh Claude Code session, paste the full
day block, and execute.

Every prompt is designed to be **self-contained**: it carries its own context,
references the right sprint doc, lists the open-source libs to pull in, and
ends with a mandatory security-audit + definition-of-done gate.

**Never skip the DoD gate.** If any item is red, the day is not done.

---

## Design Pattern Catalog

Every new file must declare its primary pattern in a top comment:
`// Pattern: <name>` — engineers should recognize the shape immediately.

| Pattern | When to use | CNSP example |
| --- | --- | --- |
| **Repository** | Data access abstraction | `CloudAccountRepository`, `FindingRepository` |
| **Adapter** | Wrap third-party SDK in a typed interface | `ProwlerAdapter`, `FinSavvyAIAdapter`, `ClerkAdapter` |
| **Strategy** | Interchangeable algorithm at runtime | `RiskScorer`, `RemediationSelector`, `LLMProvider` |
| **Observer/Event** | Decouple producer from consumer | `SkillEmitter`, `FindingCreatedEvent`, `SOARTrigger` |
| **Command** | Encapsulate a unit of work | `RemediationCommand`, `PlaybookStep`, `AutomationAction` |
| **Factory** | Construct typed objects from raw data | `SkillFactory`, `FindingFactory`, `PlaybookFactory` |
| **DAG/Pipeline** | Ordered, dependency-aware execution | `AutomationHub DAG`, `Attack Graph BFS`, `PlaybookRunner` |
| **Middleware Chain** | Pre/post hooks on request/response | Hono `clerkAuth → requirePermission → handler` |
| **Decorator** | Wrap existing behavior transparently | `AuditLogger`, `RateLimiter`, `CacheLayer` |
| **Saga** | Long-running distributed state machine | `RemediationWorkflow`, `ComplianceAuditRun` |

---

## Open-Source Library Registry

Pull these before building. Each is a **proven drop-in**; do not hand-build.

### Security / CSPM
```bash
# Prowler — AWS/GCP/Azure CSPM (Python, invoke via subprocess or Docker)
pip install prowler            # or: docker pull toniblyx/prowler

# Semgrep — SAST scanning (language-agnostic rules)
pip install semgrep

# Trivy — container + dependency scanning
brew install aquasecurity/trivy/trivy
```

### Graph / Analytics
```bash
# graphlib (Node built-in ≥ v16) — DAG topological sort
# import { Topological } from 'node:v8' — no install needed

# graphology — typed graph data structure for attack graphs
pnpm add graphology graphology-traversal graphology-shortest-path

# d3-hierarchy — tree/force layouts for frontend attack graph
pnpm add d3-hierarchy
```

### AI / LLM
```bash
# Anthropic SDK — already used; extend via FinSavvyAI adapter
pnpm add @anthropic-ai/sdk       # in packages/tokenforge already

# AI SDK (Vercel) — streaming helpers for Next.js
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai
```

### Automation / SOAR
```bash
# AutomationHub SOAR DAG engine (portfolio — not npm)
# See: packages/skills/automationhub-soar/  (packaged Day 12)

# Temporal-compatible workflow types (CF Workflows adapter)
pnpm add @cloudflare/workflows-types
```

### Data / PDF
```bash
# Zod — already present, extend schemas not add new validators
pnpm add zod    # already installed

# pdf-lib — PDF report generation (Security Health Check Reports)
pnpm add pdf-lib

# @react-pdf/renderer — React → PDF for dashboard reports
pnpm add @react-pdf/renderer
```

### Testing
```bash
# Vitest — already configured, do not change config
pnpm add -D vitest @vitest/coverage-v8

# MSW — HTTP mocking for integration tests
pnpm add -D msw

# Playwright — E2E (already in apps/web)
pnpm add -D @playwright/test
```

---

## MCP Registry — Active Servers Per Track

Configure once in `~/.config/claude/mcps.json`. These are the MCP servers
that provide real-time tool assistance to Claude Code sessions.

| MCP Server | Track | Tools provided |
| --- | --- | --- |
| **GitHub MCP** | All | `create_branch`, `push_files`, `create_pull_request`, `list_issues` |
| **AWS MCP** (Prowler context) | A, B | `describe_resources`, `list_findings`, `get_compliance_summary` |
| **QueryFlux MCP** | A, C | `nl_to_sql`, `execute_query`, `explain_query_plan` |
| **OpenSyber MCP** | A, D | `list_skills`, `install_skill`, `get_skill_logs`, `get_agent_metrics` |
| **Cloudflare MCP** | A, D | `list_workers`, `deploy_worker`, `tail_logs`, `list_d1_databases` |
| **Context7 MCP** | All | `resolve_library_id`, `query_docs` — live framework docs |

### MCP Session Startup Command
```bash
# At start of each Claude Code session, verify MCPs are connected:
# Claude will automatically use these if configured in settings.
# Check: /mcp status
```

---

## OpenHands Integration (AI Agent Skill)

OpenHands (formerly OpenDevin) is a first-class **hosted skill** on OpenSyber.
It represents the product eating its own cooking: OpenSyber secures itself by
running AI coding agents inside monitored containers.

**Skill ID:** `openhands-agent`
**Landing sprint:** Sprint 19 (Marketplace) — featured at launch

```typescript
const openhandsSkill: SkillProfile = {
  id: 'openhands-agent',
  name: 'OpenHands AI Coding Agent',
  category: 'ai_agent',
  tier: 'pro',
  targets: [{ type: 'opensyber_container', required: true }],
  outputs: [
    { type: 'agent_activity', table: 'agent_sessions' },
    { type: 'finding', source: 'openhands_monitor' },
    { type: 'audit_event', category: 'ai_agent_action' },
  ],
  schedule: { trigger: 'manual' },
  openSourceRepo: 'https://github.com/All-Hands-AI/OpenHands',
}
```

**Integration pattern:**
1. User clicks "Deploy OpenHands" in OpenSyber dashboard
2. Hetzner VM provisioned with `openhands:latest` Docker image
3. OpenSyber agent daemon wraps all outbound calls with TokenForge binding
4. Every file edit, bash command, browser action is logged as `agent_activity`
5. Security monitor (Sprint 11) scans agent's container in real-time
6. Anomaly (data exfil attempt, unexpected network call) → auto-suspend + alert

---

## File Budget Rules (MANDATORY)

Every source file in `src/`, `app/`, `lib/` must stay ≤ 200 lines.

**Enforcement strategy per day:**
```bash
# Run after every file edit to catch violations immediately
find apps packages -path "*/node_modules" -prune -o \
  -name "*.ts" -not -name "*.test.ts" -not -name "*.d.ts" \
  -exec awk 'END{if(NR>200)print FILENAME": "NR" lines — OVER BUDGET"}' {} \;
```

**Split strategy when over 200 lines:**
- Route handler > 200 lines → extract `service.ts` + `validators.ts`
- Component > 200 lines → extract sub-components + `hooks.ts`
- Schema > 200 lines → split into domain-specific schema files
- Test file > 200 lines → acceptable (tests are exempt from the 200-line rule)

---

## Security Audit Checklist (Run After Every Task)

Copy this into every day's DoD gate:

```
[ ] No secrets/tokens in any committed file (run: git secrets --scan)
[ ] All new API routes validate auth before DB access
[ ] All user inputs validated with Zod schema (server-side)
[ ] Parameterized queries only — no string concatenation in SQL
[ ] RBAC: requirePermission() on every write route
[ ] Audit log: every state change records actorId + action + resourceId
[ ] Rate limiting: public endpoints have sliding-window KV limiter
[ ] CORS: only opensyber.cloud and tokenforge.dev in production
[ ] No console.log with sensitive data (actorId, tokens, emails)
[ ] Dependencies: pnpm audit --audit-level=high (no unresolved High+)
```

---

## Definition of Done (Global Gate)

A day is "done" only if ALL of the following pass:

```
[ ] pnpm typecheck — zero TypeScript errors
[ ] pnpm test — all tests pass
[ ] pnpm build — zero build errors
[ ] Coverage ≥ 80% lines + branches on new files (90% for tokenforge/)
    Run: pnpm vitest run --coverage --coverage.thresholds.lines=80
    Per-package thresholds: see master-plan.md Coverage Gates table
[ ] All new files ≤ 200 lines (source files; test files exempt)
[ ] Error path tests exist for every new service:
    - invalid input (Zod failure), DB failure, auth failure (401/403)
    - Skills: must throw on error (no internal try/catch in execute())
[ ] All non-public routes have requirePermission() (review new routes)
[ ] Public routes (marketplace listing, trust portal) do NOT have clerkAuth()
[ ] Security audit checklist complete (all 10 items checked)
[ ] No TODO/FIXME left in added code without a linked issue
[ ] Sprint doc task items marked complete in sprint-XX.md
[ ] SkillEmitter: all 7 methods used correctly (automationAction included)
```

---

## Track Assignments

```
Track A — Core Spine (Developer 1):
  Days 1-5:   Sprint 11 (CSPM + Prowler)
  Days 6-8:   Sprint 13 (Risk Intelligence)
  Days 9-13:  Sprint 14 (Attack Graph)
  Days 14-17: Sprint 16 (AI Intelligence)
  Days 18-21: Sprint 17 (Remediation Engine)
  Days 22-26: Sprint 20 (Enterprise Exit / SOC2)
  Days 27-31: Sprint 22 (Platform Data / GraphQL)

Track B — Identity + SaaS (Developer 2):
  Days 1-4:   Sprint 12 (Credential Lifecycle / Vault)
  Days 6-11:  Sprint 15 (SaaS Posture / TenantIQ)
  Days 15-19: Sprint 18 (Multi-Cloud: AWS+GCP+Azure extend)

Track C — Skill Packaging (Developer 3):
  Day 1-3:    Sprint 11b (Skill SDK)
  Days 3-4:   tokenforge-session-security + queryflux-mcp
  Days 4-5:   finsavvyai-llm-gateway + pipewarden-cicd-security
  Days 6-7:   tenantiq-m365-security
  Days 9-10:  mcpoverflow-connector-gen + querylens-nl-sql
  Days 11-12: quantumbeam-fraud-detection + automationhub-soar
  Days 12-13: upm-dependency-audit + qestro-security-testing
  Day 13:     openhands-agent packaging

Track D — Marketplace + Platform (Developer 1, after Day 21):
  Days 22-25: Sprint 19 (Marketplace)
  Days 27-29: Sprint 21 (Platform Connect / SOAR)
```

---

## Skill SDK — Mandatory Usage in Every Skill File

Every skill file in `packages/skills/` MUST use the official SDK interfaces.
No skill is allowed to query D1 or call Hono routes directly.

### Core Interfaces (defined in packages/shared/src/types/skills.ts)

```typescript
// SkillContext — injected by SkillRunner, never construct manually
interface SkillContext {
  agentId: string
  orgId: string
  userId: string
  cloudAccounts: CloudAccount[]
  db: DrizzleDB        // read-only access for skill queries
  kvNamespace: KVNamespace
  emit: SkillEmitter   // the only way to produce outputs
}

// SkillEmitter — the ONLY output mechanism for skills
interface SkillEmitter {
  finding(f: FindingInput): void
  saasFinding(f: SaasFindingInput): void
  riskDelta(d: RiskDeltaInput): void         // { source, weight, delta: number }
  attackEdge(e: AttackEdgeInput): void        // { from, to, confidence }
  complianceEvidence(c: ComplianceEvidenceInput): void
  remediationSuggestion(r: RemediationInput): void
  automationAction(a: AutomationActionInput): void
}

// SkillManifest — what every skill file must export as default
interface SkillManifest {
  profile: SkillProfile    // from skill.json (validated at load time)
  execute(ctx: SkillContext, emitter: SkillEmitter): Promise<void>
}
```

### Skill File Template (copy-paste for every new skill)

```typescript
// Pattern: Adapter (wraps external tool/library as SkillManifest)
import type { SkillContext, SkillEmitter, SkillManifest } from '@opensyber/shared'
import profile from './skill.json'

const skill: SkillManifest = {
  profile,
  async execute(ctx: SkillContext, emitter: SkillEmitter): Promise<void> {
    // 1. Read from ctx.db or ctx.cloudAccounts (read-only)
    // 2. Call the wrapped library/tool
    // 3. Emit results through emitter.*() — never write to DB directly
    // 4. All errors thrown here are caught by SkillRunner (no try/catch needed)
  },
}

export default skill
```

### Skill.json Template

```json
{
  "id": "skill-id-kebab-case",
  "name": "Human Readable Name",
  "version": "1.0.0",
  "category": "cspm | saas | ai_intelligence | automation | session_security | dependency | ai_agent",
  "tier": "free | pro | enterprise",
  "targets": [{ "type": "opensyber_agent | opensyber_container", "required": true }],
  "outputs": [
    { "type": "finding | saas_finding | risk_delta | attack_edge | compliance_evidence" }
  ],
  "schedule": {
    "trigger": "scheduled | event | manual | stream",
    "cron": "*/15 * * * *",
    "event": "finding.created"
  },
  "author": "opensyber-portfolio",
  "openSourceRepo": "https://github.com/..."
}
```

### SkillRunner — How Skills Are Executed (reference only, not called directly)

```typescript
// apps/api/src/skills/skill-runner.ts — SkillRunner wraps every execute() call:
// 1. Injects SkillContext (db, kv, orgId, etc.)
// 2. Collects all emitter.* calls into SkillRunResult.events[]
// 3. Enforces 30s timeout (configurable per skill)
// 4. Records skill_runs row in D1 after completion
// 5. Any thrown error is caught, run marked failed, never crashes parent
```

---

## Coverage Gates — Exact Commands Per Context

### Per-file Coverage (run after every task)

```bash
# Check coverage for a specific directory:
pnpm vitest run --coverage --reporter=verbose apps/api/src/services/risk/

# Check a single file:
pnpm vitest run --coverage apps/api/src/services/ai/threat-triage-service.ts

# Full coverage report with threshold enforcement:
pnpm vitest run --coverage \
  --coverage.thresholds.lines=80 \
  --coverage.thresholds.branches=80 \
  --coverage.thresholds.functions=80
```

### Threshold Requirements by Package

| Package/Directory | Lines | Branches | Functions | Notes |
| --- | --- | --- | --- | --- |
| `packages/tokenforge/` | 90% | 90% | 90% | Production-grade session security |
| `apps/api/src/services/` | 80% | 80% | 80% | Core business logic |
| `apps/api/src/routes/` | 80% | 75% | 80% | All route handlers |
| `apps/api/src/skills/` | 80% | 80% | 80% | Skill adapters + runner |
| `packages/skills/` | 80% | 80% | 80% | Every skill individually |
| `apps/web/src/` | 70% | 65% | 70% | React components (harder to test) |
| `packages/shared/` | 85% | 80% | 85% | Shared types + constants |

### vitest.config Coverage Setup (confirm exists in each package)

```typescript
// vitest.config.ts — must be in every app/package
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
      },
      exclude: ['**/*.d.ts', '**/node_modules/**', '**/*.test.ts'],
    },
  },
})
```

### Coverage in CI (GitHub Actions step)

```yaml
- name: Test with coverage
  run: pnpm vitest run --coverage --reporter=json
- name: Coverage gate
  run: |
    node -e "
      const cov = require('./coverage/coverage-summary.json');
      const lines = cov.total.lines.pct;
      if (lines < 80) { console.error('Coverage failed:', lines); process.exit(1); }
    "
```

---

## Git Worktrees — Concurrent Track Execution

Three tracks run simultaneously. Git worktrees give each developer (or each
Claude Code session) an **isolated working copy on a dedicated branch**
without interference between tracks.

### Initial Worktree Setup (run once before Day 1)

```bash
# From repo root (/Users/shaharsolomon/dev/projects/opensyber):

# Create worktrees for each track
git worktree add ../opensyber-track-a feat/cnsp-track-a-core-spine
git worktree add ../opensyber-track-b feat/cnsp-track-b-identity-saas
git worktree add ../opensyber-track-c feat/cnsp-track-c-skill-packaging
git worktree add ../opensyber-track-d feat/cnsp-track-d-marketplace

# Verify:
git worktree list
# /Users/shaharsolomon/dev/projects/opensyber              [main]
# /Users/shaharsolomon/dev/projects/opensyber-track-a      [feat/cnsp-track-a-core-spine]
# /Users/shaharsolomon/dev/projects/opensyber-track-b      [feat/cnsp-track-b-identity-saas]
# /Users/shaharsolomon/dev/projects/opensyber-track-c      [feat/cnsp-track-c-skill-packaging]
# /Users/shaharsolomon/dev/projects/opensyber-track-d      [feat/cnsp-track-d-marketplace]
```

### Daily Workflow Per Track

```bash
# Terminal 1 — Track A (Core Spine)
cd /Users/shaharsolomon/dev/projects/opensyber-track-a
git pull origin main                 # sync with main before starting
pnpm install                          # sync deps
# ... run day's Track A prompt in this Claude Code session

# Terminal 2 — Track B (Identity/SaaS)
cd /Users/shaharsolomon/dev/projects/opensyber-track-b
git pull origin main
# ... run day's Track B prompt

# Terminal 3 — Track C (Skill Packaging)
cd /Users/shaharsolomon/dev/projects/opensyber-track-c
git pull origin main
# ... run day's Track C prompt
```

### Merge Strategy

```bash
# Track C merges into main first (lowest blast radius — no core code touched):
cd /Users/shaharsolomon/dev/projects/opensyber-track-c
git push origin feat/cnsp-track-c-skill-packaging
# → Open PR, review, merge → main

# Track B merges after Track C (SaaS + identity depends on SDK from C):
cd /Users/shaharsolomon/dev/projects/opensyber-track-b
git fetch origin main && git merge origin/main  # pick up Track C skills
git push origin feat/cnsp-track-b-identity-saas
# → Open PR, review, merge → main

# Track A merges last (core spine has the most changes):
cd /Users/shaharsolomon/dev/projects/opensyber-track-a
git fetch origin main && git merge origin/main  # pick up B+C
git push origin feat/cnsp-track-a-core-spine
# → Open PR, full review, merge → main

# Track D starts after Milestone C (Day 21) — branch from post-Track-A main
git worktree add ../opensyber-track-d feat/cnsp-track-d-marketplace origin/main
```

### Conflict Prevention Rules

1. **Track C writes only to `packages/skills/`** — never touches `apps/`
2. **Track B writes only to `apps/api/src/routes/saas/`, `apps/api/src/routes/vault/`, `apps/web/.../saas/`**
3. **Track A owns `apps/api/src/services/`, `apps/api/src/workers/`, schema migrations**
4. **Schema migrations (packages/db/src/migrations/)**: coordinate on a shared channel before creating. Track A creates all migrations; Track B/C request via message, Track A adds their tables.
5. **packages/shared/src/types/skills.ts** — Track C owns this file. Track A/B must NOT modify skill types without Track C review.

### Schema Migration Coordination Protocol

Since migrations are sequential and must not conflict:

```bash
# Only Track A creates migrations. B and C request via:
# 1. Create a file: packages/db/migration-requests/track-b-day1.md
#    Contents: table name, columns, who needs it, why
# 2. Track A reviews + adds to next migration batch
# 3. Track A runs: cd packages/db && pnpm db:generate && pnpm db:migrate
# 4. Track A commits migration → Track B/C pull and get the table

# Migration request file format:
cat > packages/db/migration-requests/track-b-day1.md << 'EOF'
# Track B Migration Request — Day 1
Tables needed: vault_secrets, vault_rotation_logs
Columns: (see sprint-12 doc for full spec)
Needed by: Day 1 end of day
EOF
```

### Running Claude Code Per Track (Concurrent Sessions)

Each track runs as a **separate Claude Code session** pointing at its worktree:

```bash
# Open 3 terminal windows. In each:

# Window 1:
cd /Users/shaharsolomon/dev/projects/opensyber-track-a
claude   # starts new Claude Code session for Track A

# Window 2:
cd /Users/shaharsolomon/dev/projects/opensyber-track-b
claude   # separate session for Track B

# Window 3:
cd /Users/shaharsolomon/dev/projects/opensyber-track-c
claude   # separate session for Track C
```

Paste the day's **Track A / Track B / Track C prompt block** into the
corresponding session. Sessions are isolated — no context bleed.

### Worktree Cleanup After Merge

```bash
# After a track's branch is merged to main:
git worktree remove ../opensyber-track-c
git branch -d feat/cnsp-track-c-skill-packaging
```

---

## Quick Reference Links

- Sprint docs: `docs/sprints/sprint-XX-name.md`
- Skill catalog: `docs/skills/skill-catalog.md`
- Parallel plan: `docs/sprints/parallel-execution-plan.md`
- CNSP roadmap: `docs/sprints/cnsp-roadmap.md`
- API patterns: `CLAUDE.md` → API Patterns section
- Schema: `packages/db/src/schema/`
