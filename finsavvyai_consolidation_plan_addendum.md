# FinsavvyAI Consolidation Plan — Addendum

Companion to `finsavvyai_full_extended_consolidation_plan.md`. Adds the three sections the master plan currently lacks: a fintech-suite cross-walk, an investor narrative, and a per-repo migration matrix.

---

## 1. fintech-suite Cross-Walk

`portfolio/fintech-suite/` predates the ecosystem map and does not appear in it. On inspection, the suite is **not** a separate product line — every component already belongs somewhere in the new ecosystem. The suite should be dissolved, not migrated as a unit.

### Component-by-component disposition

| fintech-suite component | What it actually is | New home | Action |
|---|---|---|---|
| `quantumbeam/` | Despite the CLAUDE.md description ("algorithmic trading"), the README and code position it as a **quantum-enhanced fraud detection platform** (99.7% accuracy, <50ms latency) | `products/amliq/engines/quantumbeam/` | Fold into AMLIQ as its fraud-scoring engine. Keep the QuantumBeam brand as a sub-engine, not a standalone product |
| `api-gateway/` | Labeled "PipeWarden API Gateway" — Cloudflare Workers + Hono.js, JWT, rate limiting, edge caching, 168 E2E tests | `platform/ai-gateway/` (production base) | Promote: this is the most mature gateway implementation in the portfolio. Replace the stub in `finsavvyai-platform/packages/ai-gateway` |
| `fintech-enterprise-platform/services/billing-payments/` | Multi-gateway payment orchestration, invoicing | `platform/billing/` | Fold in. Replace the LemonSqueezy-only stub |
| `fintech-enterprise-platform/services/analytics/` | Financial analytics, reporting | `platform/telemetry/` (analytics module) | Fold in. Keep separate from raw OTel traces |
| `fintech-enterprise-platform/services/fraud-detection/` | ML-based fraud detection (Go) | `products/amliq/engines/ml-fraud/` | Fold into AMLIQ alongside QuantumBeam |
| `fintech-enterprise-platform/services/shared/` | Cross-service types and utilities | `platform/shared-types/` | Fold in |
| `web/` | Web frontend (Vitest, TypeScript) | `products/amliq/web/` or `websites/finsavvyai.com/` | Inspect routes before deciding; if marketing, fold into the website rebuild |
| `landing-page/` | Single `index.html` | `websites/finsavvyai.com/legacy/` | Archive after website rebuild |
| `k8s/`, `deploy/` | Kubernetes manifests + Terraform | `infrastructure/k8s/legacy-fintech/` | Migrate manifests piece-by-piece as services move; the rest archives |
| `tests/`, `internal/`, `docs/` | Cross-cutting | Co-locate with each migrated service | n/a |
| 11 root-level status `.md` files (BUILD_COMPLETION, GAPS_COMPLETION_REPORT, WAVE1_*, etc.) | Wave-1 sprint artifacts | `_archive/fintech-suite-wave1/` | Snapshot and remove from main tree |

### Why dissolve rather than rename

Keeping `fintech-suite` as a top-level unit would create two parallel hierarchies — the new product-aligned one (AMLIQ, PushCI, etc.) and a legacy domain-aligned one (fintech-suite). The plan's whole thesis is product clarity. Carrying a "suite" label confuses the message.

Also: the suite's three pillars (fraud detection, billing, analytics) map cleanly onto **one product (AMLIQ)** and **two platform services (billing, telemetry)**. There is no residue that needs a separate home.

### Sequencing

1. **Week 1** — Promote `api-gateway/` to `platform/ai-gateway/`. This unblocks every other product needing a real gateway.
2. **Week 2-3** — Fold billing-payments + analytics into platform/.
3. **Week 4-6** — Move QuantumBeam and ML fraud-detection into AMLIQ; consolidate the AML scoring API.
4. **Week 7** — Archive remaining shell (`k8s`, `deploy`, status docs).
5. **Week 8** — Delete `portfolio/fintech-suite/` directory.

---

## 2. Investor Narrative

### Elevator pitch (one paragraph)

FinsavvyAI is the operational stack for AI-generated software. As AI writes more code, that code needs to be validated before merge, tested at runtime, orchestrated across environments, secured against autonomous misuse, and governed for compliance — and today those concerns are handled by separate point tools built for human developers. We ship a unified platform (PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc) with an open-source wedge (PipeWarden) that detects risky AI-generated PRs the moment they're proposed. Developers adopt PushCI for free, upgrade into Qestro for runtime QA, then OpenSyber and SDLC.cc as their AI usage hits production. Our category is **AI-native software infrastructure**, and the founding insight is that the existing DevOps stack was built for a world where humans wrote the code.

### Longer narrative

**The wedge** is PushCI + PipeWarden OSS. AI code-generation is now a daily workflow for ~30% of working developers, but the merge gate has not adapted: linters and SAST tools were built for human authorship patterns and miss the failure modes specific to LLM output (hallucinated APIs, license contamination, prompt-injected dependencies, over-confident refactors). PipeWarden is the open-source detection engine; PushCI is the hosted product that turns those detections into a developer experience inside GitHub and Cursor. OSS gives us distribution and credibility; hosted gives us revenue.

**The expansion** is everything that happens after merge. Qestro runs autonomous QA against the running application — not "tests written by humans for code written by AI," but a runtime agent that explores the surface area an AI just changed. OpenSyber sits in production and watches AI agents themselves, not just the code they produced; as MCP usage scales, runtime AI security becomes the equivalent of WAFs for HTTP. SDLC.cc is the governance layer for regulated organizations that need to prove which AI wrote which line, under which policy. AMLIQ is the same operating principle (autonomous investigation) applied to a specific high-value vertical: AML at 1/10 the cost of World-Check.

**The moat** has three layers. First, **OSS gravity** — every PipeWarden install is a sensor that informs our risk rules and a leading indicator for hosted conversion. Second, **shared infrastructure** — auth, billing, telemetry, AI gateway, and policy engine are built once and serve all products, so each new product launches at marginal cost. Third, **the integrated trace** — because every product writes to the same telemetry layer, a single PR can be tracked from PushCI detection → Qestro runtime test → OpenSyber runtime alert → SDLC.cc compliance artifact. No point-tool competitor can replicate that without building the whole stack.

**The category** is AI-native software infrastructure. The right comparison is not "another DevSecOps vendor" — it is "what Datadog was to cloud monitoring, what Snyk was to vulnerability management, what HashiCorp was to multi-cloud." Each of those categories existed because a previous infrastructure shift (cloud, microservices, multi-cloud) created a new operational surface that legacy tools could not address. AI-generated code is that shift today. The category will be named in the next 18 months, and we intend to define it.

**Why now.** Three forcing functions: (1) AI code-gen adoption is past the early-majority threshold inside engineering organizations; (2) regulators (EU AI Act, US executive orders, Israeli AI directives) are moving from guidance to enforceable compliance, creating a buyer for SDLC.cc; (3) runtime AI agents are entering production environments, creating a buyer for OpenSyber. Each of these would individually justify a company. Together they create an ecosystem where the cost of integration across vendors exceeds the cost of buying the integrated platform.

**Use of funds.** A Series A funds (a) finishing the platform consolidation (auth, billing, telemetry, AI gateway, policy engine) so new product launches cost weeks not quarters, (b) PushCI + PipeWarden GTM (developer growth, GitHub Marketplace, content), and (c) the AMLIQ commercial team to close the first enterprise contracts that anchor revenue while the wedge compounds.

---

## 3. Repo Migration Matrix

Every directory in `portfolio/` is assigned to one of five buckets:

- **CORE** — primary product (move to `finsavvyai/products/<name>/`)
- **OSS** — open-source component (move to `finsavvyai/oss/<name>/`)
- **PLATFORM** — shared service (fold into `finsavvyai/platform/<service>/`)
- **INFRA** — internal tooling or sprint infrastructure (keep, mark as non-product)
- **ARCHIVE** — retire, snapshot to `_archive/`, do not migrate

### Core products

| Repo | Bucket | New path | Notes |
|---|---|---|---|
| `pushci` | CORE | `products/pushci/` | Primary wedge |
| `push-ci.dev` | CORE | merge into `products/pushci/website/` | Symlink alias today; consolidate |
| `qestro` | CORE | `products/qestro/` | Runtime QA |
| `luna-os` | CORE | `products/lunaos/` | Orchestration |
| `lunaforge` | CORE | merge into `products/lunaos/legacy/` | Predecessor; harvest useful code, retire brand |
| `opensyber` | CORE | `products/opensyber/` | Runtime AI security |
| `sdlc-cc` | CORE | `products/sdlc-cc/` | Governance (primary) |
| `sdlc-core` | CORE | merge into `products/sdlc-cc/core/` | Shared lib |
| `sdlc-platform` | CORE | merge into `products/sdlc-cc/platform/` | Hosted layer |
| `aegis` | CORE | `products/amliq/` | AMLIQ backend (rename) |
| `amliq-frontend` | CORE | merge into `products/amliq/web/` | |
| `tenantiq` | CORE | `products/tenantiq/` | M365 governance |
| `tenantiq.frontend` | CORE | merge into `products/tenantiq/web/` | |
| `fintech-suite` | DISSOLVE | see Section 1 | Components migrate to AMLIQ + platform |

### OSS components

| Repo | Bucket | New path | Notes |
|---|---|---|---|
| `pipewarden` | OSS | `oss/pipewarden/` | Plan's primary OSS asset |
| `pipewarden-real-archive-20260412` | ARCHIVE | `_archive/pipewarden-pre-rewrite/` | Pre-rewrite snapshot |
| `homebrew-pipewarden` | OSS | `oss/homebrew-pipewarden/` | Distribution tap |
| `clawpipe` | OSS | `oss/clawpipe/` | LunaOS runtime support |
| `clawpipe-server` | OSS | merge into `oss/clawpipe/server/` | |
| `clawpipe-booster-benchmark` | OSS | merge into `oss/clawpipe/benchmark/` | |
| `tokenforge` | OSS | `oss/tokenforge/` | Telemetry SDK (plan's named OSS) |
| `mcpoverflow` | OSS | `oss/mcp-tooling/` | Matches plan's "MCP tooling" OSS line |
| `automationhub` | OSS | `oss/automationhub/` | Workflow primitives — useful base for LunaOS |
| `packages` (F8 UI) | OSS | `oss/design-system/` | Satisfies "shared design system" requirement |
| `a2a-framework` | OSS | `oss/a2a-framework/` | Keep if active; archive if stale (check last commit) |
| `code-safety-suite` | OSS | merge into `oss/pipewarden/rules/` | Folds into PipeWarden rule set |
| `opensource` | INFRA | keep as `opensource/` | Vendored third-party code; not ours |

### Platform services (fold-in from fintech-suite + others)

| Source | Bucket | New path | Notes |
|---|---|---|---|
| `fintech-suite/api-gateway` | PLATFORM | `platform/ai-gateway/` | Promote to production base |
| `fintech-suite/.../billing-payments` | PLATFORM | `platform/billing/` | Replace LemonSqueezy-only stub |
| `fintech-suite/.../analytics` | PLATFORM | `platform/telemetry/analytics/` | |
| existing `finsavvyai-platform/packages/auth` | PLATFORM | `platform/auth/` | Already in place |
| existing `finsavvyai-platform/packages/policy-engine` | PLATFORM | `platform/policy-engine/` | Backed by PipeWarden OSS |

### Internal infrastructure (keep, non-product)

| Repo | Bucket | Rationale |
|---|---|---|
| `autoboot` | INFRA | Active sprint/automation harness despite the FastPM domain being parked |
| `sprint-city`, `sprints` | INFRA | Internal sprint planner |
| `coderailflow` | INFRA → evaluate | CF-first workflow automation; could become a LunaOS module or fold into automationhub |
| `coderail-dev` | INFRA → evaluate | Rule validation engine; check overlap with PipeWarden |
| `jiraz-timeline` | INFRA | Internal Jira tooling |
| `python/`, `go/`, `logs/` | INFRA | Utility folders, keep |
| `_harness/`, `_audits/`, `_briefs/`, `_reviews/`, `_merge_logs/`, `_drafts/`, `_reports/`, `_profile_export/` | INFRA | Sprint-loop machinery |

### Archive (unrelated to thesis, or domain already parked)

| Repo | Bucket | Reason |
|---|---|---|
| `autoboot` (the FastPM product) | ARCHIVE | `fastpm.dev` domain parked per plan; keep code as `autoboot` infra above, retire the product framing |
| `subsforge` | ARCHIVE | `subsforge.dev` parked |
| `viralsplit` | ARCHIVE | `viralsplit.io` parked |
| `smartreply-ai` | ARCHIVE | `smartrepli.ai` parked |
| `devwrapped` | ARCHIVE | Developer self-stats app, off-thesis |
| `flujo` | ARCHIVE → or fold | Early-preview AI workflow tool; if active, fold into LunaOS; otherwise archive |
| `global-remit` | ARCHIVE | Remittance fintech, off-thesis (and outside AMLIQ scope) |
| `hashmal` | ARCHIVE | Unclear scope, low signal |
| `immortal-fc` | ARCHIVE | Empty README, no signal |
| `looma-sh` | ARCHIVE | V2V messaging API — interesting but off-thesis |
| `moneh-hacham` | ARCHIVE | Smart meter project, off-thesis |
| `notebooklm-py` | ARCHIVE | Research toy |
| `pixel-pets` | ARCHIVE | AI creature franchise, off-thesis |
| `vibepulse` | ARCHIVE | Chrome extension games, off-thesis |
| `scangenie` | ARCHIVE | AI object scanner, off-thesis |
| `windsu-credit-manager` | ARCHIVE → or fold | "AI Code Quality Predictor"; check overlap with PushCI, otherwise archive |
| `yallabye` | ARCHIVE | Israeli travel app, off-thesis |
| `codebridge` | ARCHIVE | Unclear scope |
| `queryflux`, `queryflux-git`, `querylens` | ARCHIVE → or fold | Query-related tooling; likely fold one into a product, archive duplicates |
| All `*.agent1`, `*.agent2` directories | ARCHIVE | Worktree variants from parallel-agent runs; snapshot and delete |
| `pipewarden-real-archive-20260412` | ARCHIVE | Already named as archive |

### Summary counts

- **CORE products**: 7 product lines (PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc, AMLIQ, TenantIQ) consolidating ~13 repos
- **OSS**: ~10 repos consolidating into 7 OSS packages
- **PLATFORM**: 5 services, fed by fintech-suite components + existing stubs
- **INFRA**: ~9 internal-tooling repos kept
- **ARCHIVE**: ~22 repos retired or domain-parked

### Migration sequencing (90 days)

**Days 1-30** — Stand up the monorepo skeleton (`finsavvyai/{platform,products,oss,infrastructure,websites}`); promote fintech-suite `api-gateway` to `platform/ai-gateway`; fold billing-payments into `platform/billing`. Archive the 22 off-thesis repos in one sweep.

**Days 31-60** — Move PushCI + PipeWarden into the monorepo first (highest-value, lowest-risk). Open-source PipeWarden under the new structure. Move Qestro and LunaOS (with lunaforge code harvested).

**Days 61-90** — Move OpenSyber, SDLC.cc (consolidating sdlc-cc, sdlc-core, sdlc-platform), AMLIQ (consolidating aegis + amliq-frontend + QuantumBeam + ML fraud-detection), TenantIQ. Delete `portfolio/fintech-suite/`.

---

## 4. Matrix Corrections (2026-05-25)

Founder re-examination of four flagged repos (`founder_decisions_memo.md`). Three of the four were misclassified.

### Updated bucket assignments

| Repo | Old bucket | **New bucket** | Reason |
|---|---|---|---|
| `queryflux-git` | ARCHIVE → or fold | **CORE (8th product)** | Active shipping (Tasks 11.x SSO+Subs+SecHard merged within 7 days), 791 files, multi-surface (web/desktop/mobile/MCP/ext), fills data-layer gap |
| `queryflux` (empty placeholder) | ARCHIVE → or fold | **CORE (fold into QueryFlux)** | Was 0B placeholder; skipped during migration |
| `querylens` | ARCHIVE → or fold | **CORE (fold under products/queryflux/lens/)** | Sub-component of QueryFlux |
| `autoboot` (FastPM product) | ARCHIVE | **ARCHIVE (immediate takedown)** | Unchanged classification; founder confirmed immediate decommission with site shutdown + DNS redirect. Sprint harness (root-level scripts) is a SEPARATE thing and stays as INFRA |
| `looma-sh` | ARCHIVE | **EXTERNALIZE (spin-out)** | Live prod (relay.looma.sh), paid tiers, investor brief, IP work. Off-thesis but valuable → spin out as sibling entity |
| `a2a-framework` | OSS (conditional: keep if active) | **OSS (definite)** + MIT LICENSE added | Standards-aligned protocol impl; strategic OSS leverage; LunaOS depends on it as wire protocol |

### Updated counts

- **CORE**: **8** product lines (PushCI, **QueryFlux**, Qestro, LunaOS, OpenSyber, SDLC.cc, AMLIQ, TenantIQ) consolidating ~15 repos
- **OSS**: ~7 packages (a2a-framework now unconditional)
- **PLATFORM**: 5 services (unchanged)
- **INFRA**: ~9 internal-tooling repos + sprint harness explicitly enumerated separate from FastPM
- **EXTERNALIZE**: 1 (looma-sh) — new bucket
- **ARCHIVE**: ~20 (down by 2; queryflux + querylens promoted to CORE; looma moved to EXTERNALIZE; autoboot still archive but classified separately from harness)

### Updated GTM funnel

```
Developer uses Cursor
  → installs PushCI         (code validation)
  → adopts QueryFlux        (safe DB layer for AI agents)        ← NEW
  → adopts Qestro           (runtime QA)
  → adopts OpenSyber        (runtime AI security)
  → adopts SDLC.cc          (governance)
```

QueryFlux slots in early — every developer using AI code-gen also needs a safe DB layer for the agent.

### Executed in this pass

- `products/queryflux/` created (rsync from `queryflux-git`, fold `querylens` → `lens/`); MIGRATION_NOTES + README + CLAUDE.md + CONSOLIDATION_TODO.md written.
- Archive snapshots removed: `_archive/portfolio-snapshots/{queryflux-git,queryflux,querylens}/`.
- `_archive/fastpm-2026-05/TAKE_DOWN_ACTIONS.md` written (10-step user checklist for site shutdown + DNS redirect + extension unpublish + GitHub archive).
- `_archive/externalized/{INDEX.md,looma-sh/SPIN_OUT_PLAN.md}` written (10-step spin-out checklist).
- `oss/a2a-framework/LICENSE` (MIT) + new platform-aligned `README.md` written.

### Still requires user action (outside repo)

- Take down `fastpm.dev` site + configure DNS redirect → `finsavvyai.com`.
- Spin out Looma as separate entity (entity + domain + Stripe + IP transfer).
- After both: manually delete `/portfolio/autoboot/` and `/portfolio/looma-sh/`.

---

*End of addendum. Pair with `finsavvyai_full_extended_consolidation_plan.md`.*
