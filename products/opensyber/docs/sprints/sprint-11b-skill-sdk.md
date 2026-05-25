> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 11b: Skill SDK — Parallel Development Enabler (1 week)

## Goal
Ship a typed, documented `@opensyber/skill-sdk` npm package that lets any
developer — internal, TenantIQ team, or community — build a security skill
in isolation and publish it to the marketplace without touching the OpenSyber
monorepo. This unlocks **full parallel skill development** across all CNSP
sprints.

## Why This Sprint Exists

Without SDK:
```
Sprint 11 → Sprint 12 → Sprint 13 → Sprint 14 → Sprint 15
  CSPM       Vault       Risk         Graph       SaaS
  ↓                                              (TenantIQ waits)
Sequential. One team. ~44 days minimum.
```

With SDK (this sprint first):
```
               Sprint 11b: Skill SDK (1 week)
                          ↓
        ┌─────────────────┼──────────────────────┐
        ↓                 ↓                      ↓
  Sprint 11            TenantIQ              Community
  CSPM/Prowler         packages M365          GitHub posture
  (internal)           as skill               skill (external)
        ↓                 ↓                      ↓
        └─────────────────┼──────────────────────┘
                          ↓
                 All merge into marketplace
Parallel. Multiple teams. ~10 days to same coverage.
```

## Dependencies
- Sprint 10 complete (existing skill system in place)
- Existing `apps/api/src/routes/skills.ts` — SDK must stay compatible

---

## ⚡ MVP PATH (3 days) — Typed contracts + local runner

### MVP.1 — SDK Package Structure (Day 1)
Create `packages/skill-sdk/` in the monorepo:

```
packages/skill-sdk/
├── src/
│   ├── types.ts          ← SkillProfile, SkillContext, SkillOutput, SkillTarget
│   ├── runtime.ts        ← LocalSkillRunner (dev/test harness)
│   ├── outputs.ts        ← typed emitters: emitFinding(), emitRiskDelta()
│   ├── testing.ts        ← MockSkillContext for unit tests
│   └── index.ts          ← barrel export
├── package.json          ← @opensyber/skill-sdk
└── README.md
```

Core types:

```typescript
// The manifest every skill must export as default
export interface SkillProfile {
  id: string                        // 'prowler-aws-cspm'
  name: string                      // 'AWS Cloud Security (Prowler)'
  version: string                   // semver
  description: string
  author: string
  category: SkillCategory
  tier: 'free' | 'pro' | 'team' | 'enterprise'
  targets: SkillTarget[]            // what inputs the skill needs
  requiredPermissions: Permission[] // checked before install
  configSchema: z.ZodSchema         // user config, validated on install
  outputs: SkillOutputSpec[]        // what tables/events skill emits
  widgets: DashboardWidgetSpec[]    // UI contributions
  schedule: SkillSchedule           // cron or event-driven
  run: (ctx: SkillContext) => Promise<void>  // entry point
}

// What a skill receives at runtime
export interface SkillContext {
  orgId: string
  instanceId: string
  config: Record<string, unknown>   // user config (validated)
  targets: ResolvedTarget[]         // cloud accounts, SaaS tokens, etc.
  emit: SkillEmitter                // emit findings, scores, etc.
  log: SkillLogger                  // structured logging
  vault: VaultClient                // read org secrets
  http: HttpClient                  // pre-authenticated HTTP (rate limited)
}

// Typed emitters so skills always produce correct output shape
export interface SkillEmitter {
  finding(f: CspmFindingInput): void
  saasFinding(f: SaasFindingInput): void
  riskDelta(d: RiskDeltaInput): void
  attackEdge(e: AssetRelationInput): void
  complianceEvidence(e: EvidenceInput): void
  remediationSuggestion(r: RemediationSuggestionInput): void
}
```

- [ ] Create `packages/skill-sdk/src/types.ts` (< 200 lines)
- [ ] Create `packages/skill-sdk/src/outputs.ts` (< 200 lines)
- [ ] Export from `packages/skill-sdk/src/index.ts`
- [ ] Add to `pnpm-workspace.yaml`

### MVP.2 — Local Development Runner (Day 1–2)

```typescript
// Skill author runs: npx opensyber-skill dev ./my-skill.ts
// Connects to local OpenSyber dev instance, runs skill, shows output
export class LocalSkillRunner {
  constructor(private profile: SkillProfile) {}

  async run(config: unknown): Promise<SkillRunResult> {
    const ctx = this.buildMockContext(config)
    await this.profile.run(ctx)
    return { findings: ctx.captured.findings, ... }
  }

  async validate(): Promise<ValidationResult> {
    // Check profile schema, permissions, output specs
  }
}
```

- [ ] Create `packages/skill-sdk/src/runtime.ts` (< 200 lines)
- [ ] Create `packages/skill-sdk/src/testing.ts` — `MockSkillContext`:
  - Captures all emit() calls for assertions
  - Mock vault.read(), http.get() with configurable responses
- [ ] Write tests for the SDK itself (meta-testing)

### MVP.3 — Refactor Sprint 11 Prowler Skill (Day 2–3)
Convert the Sprint 11 Prowler service into a proper SDK-based skill:

```typescript
// packages/skills/prowler-aws-cspm/src/index.ts
import { defineSkill } from '@opensyber/skill-sdk'
import { z } from 'zod'

export default defineSkill({
  id: 'prowler-aws-cspm',
  version: '1.0.0',
  category: 'cspm',
  tier: 'pro',
  targets: [{ type: 'aws_account', required: true }],
  requiredPermissions: ['cloud.write'],
  configSchema: z.object({
    services: z.array(z.string()).default(['iam', 's3', 'ec2']),
    severity: z.enum(['all', 'critical', 'high']).default('all'),
  }),
  outputs: [{ type: 'cspm_findings' }, { type: 'risk_delta' }],
  widgets: [
    { id: 'cspm-severity-chart', title: 'Findings by Severity', type: 'bar' },
    { id: 'cspm-critical-count', title: 'Critical Findings', type: 'stat' },
  ],
  schedule: { cron: '0 2 * * *' },
  async run(ctx) {
    const account = ctx.targets.find(t => t.type === 'aws_account')
    const output = await runProwlerCli(account.credentials, ctx.config)
    for (const finding of parseProwlerOutput(output)) {
      ctx.emit.finding(finding)
    }
  },
})
```

- [ ] Create `packages/skills/prowler-aws-cspm/` using SDK
- [ ] Create `packages/skills/vault-rotation-agent/` using SDK
- [ ] Update skill installer API to accept SDK-format skills
- [ ] Write tests for both skills using `MockSkillContext`

---

## 🔵 FULL PATH (7 days) — CLI, packaging, and TenantIQ integration

Everything in MVP plus:

### FULL.1 — Skill CLI (`opensyber-skill`)
```bash
npx @opensyber/skill-cli init my-skill      # scaffold from template
npx @opensyber/skill-cli dev                # run locally with hot reload
npx @opensyber/skill-cli test               # run skill tests
npx @opensyber/skill-cli validate           # check profile + schema
npx @opensyber/skill-cli publish            # publish to marketplace
npx @opensyber/skill-cli pack               # create .opensyber bundle
```

- [ ] Create `packages/skill-cli/` (Node.js CLI, wraps SDK)
- [ ] Template generator: `init` scaffolds TypeScript + vitest + README
- [ ] Bundler: packages skill as single `.opensyber` file (zip + manifest)
- [ ] Publish flow: authenticate, validate, upload to R2, trigger marketplace review

### FULL.2 — TenantIQ Skill Package
Convert TenantIQ's intelligence engine into an SDK-compliant skill:

- [ ] Create `packages/skills/tenantiq-m365-security/`:
  - Import `packages/graph` from TenantIQ monorepo (or copy + adapt)
  - Import `packages/intel` rules as `ctx.emit.saasFinding()` calls
  - Import `packages/remediation` as `ctx.emit.remediationSuggestion()` calls
  - Import `packages/ai` tools as `ctx.emit.aiInsight()` calls
- [ ] Map TenantIQ's 14 rules → 14 `ctx.emit.saasFinding()` calls
- [ ] Map TenantIQ's 9 remediation actions → `ctx.emit.remediationSuggestion()`
- [ ] TenantIQ skill config schema: Azure tenant ID + client credentials

### FULL.3 — Widget Registry
Skills declare dashboard widgets; platform renders them:

- [ ] Create `apps/api/src/routes/skill-widgets.ts`:
  - `GET /api/skills/installed/widgets` — list all active widgets from installed skills
- [ ] Widget renderer: `apps/web/src/components/dashboard/SkillWidget.tsx`
  - Receives widget spec + data endpoint
  - Renders: stat_card, bar_chart, gauge, table, timeline
- [ ] Skill dashboard page: user can arrange/pin skill widgets

### FULL.4 — Skill Sandboxing
- [ ] Each skill runs in its own Hetzner VM (reuse agent container infra)
- [ ] Network isolation: skills can only call pre-approved external APIs
- [ ] Resource limits: CPU 0.5 core, RAM 512MB, execution timeout 5min
- [ ] Skill output validation: all emits validated against schema before storing

### FULL.5 — Community Skill Templates
Publish starter templates to GitHub:

- `skill-template-cspm` — for cloud scanner skills
- `skill-template-saas` — for SaaS connector skills
- `skill-template-ai` — for AI analysis skills
- `skill-template-compliance` — for compliance evidence skills

---

## Parallel Development Plan After This Sprint

Once SDK ships, these can ALL be developed simultaneously:

| Skill | Team | Sprint Target | Dependencies |
|---|---|---|---|
| `prowler-aws-cspm` | Internal | Sprint 11 (already) | None |
| `prowler-gcp-cspm` | Internal | Sprint 18 | prowler-aws-cspm pattern |
| `prowler-azure-cspm` | Internal | Sprint 18 | prowler-aws-cspm pattern |
| `prowler-k8s-cspm` | Internal | Sprint 18 | prowler-aws-cspm pattern |
| `vault-rotation-agent` | Internal | Sprint 12 | None |
| `tenantiq-m365-security` | TenantIQ team | Sprint 15 | TenantIQ codebase |
| `github-posture` | Internal | Sprint 15 | SaaS connector pattern |
| `slack-posture` | Community | Sprint 15 | SaaS connector pattern |
| `google-workspace-posture` | Community | Sprint 15 | SaaS connector pattern |
| `ai-compliance-assistant` | Internal | Sprint 16 | AI service |
| `remediation-engine` | Internal | Sprint 17 | Playbook framework |
| `soc2-evidence-collector` | Internal | Sprint 20 | All other skills |

**Without SDK:** 10 skills × ~5 days each = ~50 days sequential
**With SDK:** 10 skills in parallel = ~5–8 days per sprint, all concurrent

---

## Definition of Done
- [ ] `@opensyber/skill-sdk` package exports all types + emitters
- [ ] `MockSkillContext` enables unit testing without platform
- [ ] Prowler skill refactored to use SDK
- [ ] Vault rotation skill using SDK
- [ ] Skill installer validates SDK-format skills
- [ ] All SDK code has tests (>90% coverage — it's a contract)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| SDK types + emitters | 1 | 1 |
| Local runner + test harness | 1 | 1.5 |
| Refactor Prowler + Vault skills | 1 | 1 |
| CLI tool | — | 1.5 |
| TenantIQ skill package | — | 1.5 |
| Widget registry + sandboxing | — | 1.5 |
| **Total** | **3** | **8** |
