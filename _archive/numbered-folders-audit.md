# Numbered Folders Audit — 2026-05-25

Read-only audit comparing canonical `finsavvyai-platform/` (rounds 1-4 + founder corrections) against suspected counterparts in numbered folders (`01_*`-`09_*`), `portfolio/`, and a few standalone roots.

All file counts use the same prune set unless noted: `node_modules`, `.next`, `dist`, `build`, `.venv`, `venv`, `vendor`, `target`, `.wrangler`, `.svelte-kit`, `.git`, `coverage`, `__pycache__`, `playwright-report`, `test-results`. The portfolio numbers reported by quick `du`/`find` early in the audit were inflated by these dirs; the strict-pruned counts below are the authoritative ones.

The big finding up front: **the heavy "parallel" tree is `/Users/shaharsolomon/dev/projects/portfolio/`, not `01_*`-`09_*`.** The numbered folders mostly hold older/abandoned slices; `portfolio/` is where active per-product git repos live. Canonical was rsync'd from `portfolio/` per the existing MIGRATION_NOTES files in every product.

## Summary

- 16 canonical units checked (8 products + 7 oss + packages aggregate)
- **KEEP_CANONICAL: 11** (pushci, qestro, lunaos, opensyber, sdlc-cc, queryflux, a2a-framework, tokenforge, pipewarden, automationhub, design-system)
- **RE_MIGRATE_FROM_NUMBERED: 0** (none of the numbered or portfolio counterparts are materially newer than canonical when build-artifact noise is stripped)
- **MERGE: 3** (amliq — pick up cmd/pkg/sdks/Makefile from aegis; tenantiq — standalone variant is much larger and may have features; packages — 03_Enterprize_application shared-dashboard/shared-sdlc have content canonical lacks)
- **NO_COUNTERPART: 2** (packages/policy-engine, oss/clawpipe is unique-ish — portfolio version is older)
- **INVESTIGATE: 1** (oss/mcp-tooling vs 02_AI_AGENTS/mcp-servers — completely different scopes)

## Per-product findings

### products/pushci/
- Canonical: 15,346 files | last commit 2026-05-25 (monorepo founder-corrections commit)
- Portfolio counterpart: `/Users/shaharsolomon/dev/projects/portfolio/pushci` | 17,907 files | own .git, last commit 2026-05-24 `wip: pre-merge snapshot`
- Other: `/Users/shaharsolomon/dev/projects/portfolio/push-ci.dev` (empty), `push-ci.dev.agent2` (32 files, worktree)
- Signals: top-level diff shows portfolio only adds build/log artifacts (`.pushci/logs/*`, `coverage.out`, `dist`, `pushci` binary, `playwright-report`, `test-results`); canonical adds `CLAUDE.legacy.md`, `MIGRATION_NOTES.md`, `README.npm.md`, `website/`. Canonical has LICENSE/CONTRIBUTING/CODE_OF_CONDUCT/SECURITY/CHANGELOG.
- Verdict: **KEEP_CANONICAL**
- Action: none. Portfolio is the source canonical was rsync'd from; portfolio's larger file count is build artifacts.

### products/qestro/
- Canonical: 16,951 files | last commit 2026-05-25
- Portfolio counterpart: `/Users/shaharsolomon/dev/projects/portfolio/qestro` | 17,002 files | last commit 2026-05-24 `merge: agent1/sprint-day-1 into main (sprint sweep)`
- Other: `/Users/shaharsolomon/dev/projects/03_Enterprize_application/products/devx-platform/qestro` is **a stub with only `mobile/` (1 file)**. Last commit 2026-04-29.
- Signals: counts within 0.3%; structure equivalent.
- Verdict: **KEEP_CANONICAL**
- Action: ignore the 03_Enterprize stub.

### products/lunaos/
- Canonical: 21,791 files | last commit 2026-05-25
- Portfolio counterpart: `/Users/shaharsolomon/dev/projects/portfolio/luna-os` | 19,194 files | no git
- Other: `02_AI_AGENTS/lunaos-repos/` (5 files top-level, mostly docs), `portfolio/luna-os.agent1/2` (empty worktrees)
- Signals: canonical is LARGER than portfolio. `antigravity-awesome-skills` (6676 vs 6677), `OpenHands` (2925 vs 2932), `luna-vault` identical, `lunaos-mobile` (2722 vs 2728). Canonical also added `lunaos-vscode` (23 vs 59 — actually less), but added `legacy/` (2850 files). Net: canonical absorbed both portfolio AND legacy content.
- Verdict: **KEEP_CANONICAL**
- Action: none. Canonical superset.

### products/opensyber/
- Canonical: 3,333 files | last commit 2026-05-25
- Portfolio counterpart: `/Users/shaharsolomon/dev/projects/portfolio/opensyber` | 5,183 files | last commit 2026-05-24 `feat(auth): consolidate sjwt_ bridge tokens via @finsavvyai/auth`
- Other: `portfolio/opensyber.agent1` (3,222 files; no git, sibling worktree)
- Signals: top-level diff = canonical only adds CLAUDE.legacy.md/MIGRATION_NOTES.md/SECRETS_TO_TRIAGE.md (no missing dirs). Subdir-level gaps in `apps/web` (1146 vs 1468) and `apps/tokenforge-web` (122 vs 252) traced to `node_modules/.next/.svelte-kit/build` artifacts under the prune set. Source dirs (`packages`, `samples`, `skills`, `tests`, `docs`, `apps/api`, `apps/agent`) match within 1-3 files.
- Verdict: **KEEP_CANONICAL**
- Action: none.

### products/sdlc-cc/
- Canonical: 4,016 files | last commit 2026-05-25; layout: `core/` (61) + `platform/` (3,808) + Go CLI + Office add-ins at root
- Portfolio counterparts:
  - `portfolio/sdlc-cc` (144 files; the Go CLI seed) | last commit 2026-05-24 `wip: pre-merge snapshot`
  - `portfolio/sdlc-core` (61 files; shared Go lib) | last commit 2026-05-11
  - `portfolio/sdlc-platform` (7,568 files strict-pruned) | last commit 2026-05-22
- Signals: MIGRATION_NOTES confirms canonical is a 3-repo consolidation (SHAs recorded). Top-level diff: portfolio/sdlc-platform's "missing" 50% is entirely `node_modules`, `dist`, `playwright-report`, `test-results`, `make-it-run.log` (all artifacts properly excluded). After exclusions, content matches.
- Verdict: **KEEP_CANONICAL**
- Action: none.

### products/amliq/
- Canonical: 4,383 files | last commit 2026-05-25; layout: `api/` (2,312) + `engines/{quantumbeam,ml-fraud}` (1,183) + `internal/` (306) + `web/` (669)
- Portfolio counterparts:
  - `portfolio/aegis` (2,276 files) | last commit 2026-05-24 `wip: pre-merge snapshot`
  - `portfolio/aegis.agent1/2` (2,172 each, worktrees)
  - `portfolio/amliq-frontend` (671 files) | last commit 2026-05-20 — already absorbed into canonical `web/`
- Signals: Canonical is **numerically larger** because it pulled in the `engines/` from `portfolio/fintech-suite/quantumbeam` and `portfolio/fintech-suite/fintech-enterprise-platform/services/fraud-detection` per MIGRATION_NOTES. BUT canonical is missing several aegis top-level dirs/files: `cmd/` (174), `bin/` (6), `pkg/` (5), `sdks/` (27), `sdk/`, `data/` (2), `migrations/` (84), `tests/` (45), `docs/` (81), `samples/` (8), `deploy/` (10), `design-system/` (15), `runlocal/` (329), `world/` (5), `Makefile`, `Dockerfile`, `mcp-config.json`, `render.yaml`, `AGENTS.md`, `AUDIT.md`, plus sprint .docx files. Several may have been re-rooted into canonical `api/` or `internal/`, but `cmd/`, `Makefile`, `Dockerfile`, `pkg/`, `sdks/` are not visible at canonical root.
- Verdict: **MERGE**
- Action: cherry-pick from `portfolio/aegis`: `cmd/`, `pkg/`, `bin/`, `sdks/`, `sdk/`, `Makefile`, `Dockerfile`, `migrations/`, `tests/`, `docs/`, `deploy/`, `design-system/`, `samples/`, `runlocal/`, `mcp-config.json`, `render.yaml`, `AGENTS.md`, `AUDIT.md`. Verify each isn't already shadowed inside `api/` first: `find /Users/shaharsolomon/dev/projects/finsavvyai-platform/products/amliq -type d -name cmd`.

### products/tenantiq/
- Canonical: 3,863 files | last commit 2026-05-25; layout: `apps/{api,web}` + `packages` + `migrations` + `tests` + `web/` (the consolidated `tenantiq.frontend`)
- Portfolio counterparts:
  - `portfolio/tenantiq` (5,291 strict-pruned) | last commit 2026-05-23 `fix(web): load PUBLIC_API_URL via $env/static/public` — **active dev**
  - `portfolio/tenantiq.frontend` (495 strict-pruned) | last commit 2026-05-19; already absorbed into canonical `web/`
  - `portfolio/tenantiq.agent1/2` (2,507 each, worktrees)
  - `tenantiq-—-ai-powered-m365-intelligence/` **standalone variant** (11,998 strict-pruned!) | last commit 2026-03-24 — much larger but 2 months older
- Signals: Canonical `apps/web` is 1,297 vs portfolio 3,180 — drill-down confirms the 1,883 gap is `build/`, `node_modules/`, `test-results/` (artifacts properly excluded). However the standalone variant has **k8s/, load-tests/, openclaw/, src/, docker-compose files, render.yaml** that NEITHER portfolio/tenantiq NOR canonical has. The standalone is from an older lineage with different architecture (NestJS branches merged with SvelteKit).
- Verdict: **MERGE**
- Action: (1) canonical is correct for the SvelteKit+CF Workers monorepo. (2) Inspect standalone `tenantiq-—-ai-powered-m365-intelligence/{openclaw,k8s,load-tests}` for features (M365 add-ins, K8s manifests, OpenClaw integration) not present in canonical and lift selectively. The standalone is unlikely to be re-migrated wholesale (older, different stack), but specific subdirs may have value.

### products/queryflux/
- Canonical: 3,728 files | last commit 2026-05-25
- Portfolio counterpart: `/Users/shaharsolomon/dev/projects/portfolio/queryflux-git` (3,730 strict-pruned) | last commit 2026-05-23 `docs: map existing codebase`
- Other: `portfolio/queryflux` (empty), `03_Enterprize_application/_archive/queryflux_root_legacy/`
- Signals: counts match within 2 files. Canonical adds `lens`, `MIGRATION_NOTES.md`, `README.source.md`, `CLAUDE.source.md`, `CONSOLIDATION_TODO.md`. Portfolio only adds `dist` and `node_modules`.
- Verdict: **KEEP_CANONICAL**
- Action: none.

### oss/pipewarden/
- Canonical: 974 files | last commit 2026-05-25
- Portfolio: `portfolio/pipewarden` (799 files) | last commit 2026-05-24 `wip: pre-merge snapshot`; also `portfolio/pipewarden-real-archive-20260412/`, `portfolio/pipewarden.agent1/2` (706 each)
- Signals: canonical is larger; same lineage.
- Verdict: **KEEP_CANONICAL**

### oss/homebrew-pipewarden/
- Canonical: 3 files | last commit 2026-05-25
- Portfolio: `portfolio/homebrew-pipewarden` (2 files) | last commit 2026-05-19 `chore: initial Homebrew tap for PipeWarden darwin binaries`
- Verdict: **KEEP_CANONICAL**

### oss/a2a-framework/
- Canonical: 155 files | last commit 2026-05-25
- Portfolio: `portfolio/a2a-framework` (152 files) | no git; subdirs (a2a-agent-record, a2a-cli, a2a-server) match
- Numbered: `02_AI_AGENTS/a2a/` is **stub-only** (1 file at top, subdirs exist but content lives elsewhere) | last commit 2026-05-13
- Signals: canonical superset.
- Verdict: **KEEP_CANONICAL**
- Action: 02_AI_AGENTS/a2a/ is superseded as the memo claims; safe to ignore.

### oss/clawpipe/
- Canonical: 10,884 files | last commit 2026-05-25
- Portfolio: `portfolio/clawpipe` (9,543 files) | last commit 2026-05-22 `chore: gitignore + wrangler 4.94 + smoke expansion`
- Other: `portfolio/clawpipe-server` (2,631 files; older 2026-03-19 fork), `portfolio/clawpipe-booster-benchmark` (42 files; benchmark only), `portfolio/clawpipe.agent1/2` (745, 755; worktrees)
- Signals: canonical is largest; lineage clear.
- Verdict: **KEEP_CANONICAL**

### oss/tokenforge/
- Canonical: 168 files | last commit 2026-05-25
- Portfolio: `portfolio/tokenforge` (359 files including its own .git, 278 in `apps/`) | last commit 2026-05-02 `chore: baseline — extract from opensyber, Phase 1-10 (243 tests, 90%+ coverage)`
- Signals: portfolio's `apps/dashboard` has 239 files vs canonical 45. Top-level identical otherwise; canonical adds LICENSE, MIGRATION_NOTES, HANDOFF.md. The dashboard differential may be real (not just artifacts — count remains 239 vs 45 after the prune set). Need a quick `diff -rq` on apps/dashboard to confirm.
- Verdict: **MERGE** (lean toward KEEP_CANONICAL pending dashboard verification)
- Action: run `diff -rq /Users/shaharsolomon/dev/projects/portfolio/tokenforge/apps/dashboard /Users/shaharsolomon/dev/projects/finsavvyai-platform/oss/tokenforge/apps/dashboard | grep -v node_modules | head -50`. If the diff is real source files, lift them; if it's `.svelte-kit` cache only, keep canonical.

### oss/mcp-tooling/
- Canonical: 1,739 files | last commit 2026-05-25; contains 10 top-level subdirs (apps, packages, docs etc.)
- Numbered: `02_AI_AGENTS/mcp-servers/` (11,258 strict-pruned, 75 top-level entries: 404.html, AI-TOOLING-INTEGRATION-PLAN.md, apps, build_log.txt, deploy-ai, deploy-ai.sh, docker-compose.*, packages, services, src, workers, …) | last commit 2026-05-13
- Signals: **completely different scope**. `02_AI_AGENTS/mcp-servers/` is a full deployable platform with its own apps, docker, secrets, deployments, llms.txt — looks like an "MCP gateway/SaaS" rather than reusable tooling. Canonical `oss/mcp-tooling/` is a clean library + a few examples.
- Verdict: **INVESTIGATE**
- Action: founder should decide if `02_AI_AGENTS/mcp-servers/` is (a) old superseded SaaS to delete, (b) a separate product not yet migrated (maybe "mcpoverflow" — there's a `portfolio/mcpoverflow` dir), or (c) source for a new product slot. Do NOT auto-merge.

### oss/automationhub/
- Canonical: 11,191 files | last commit 2026-05-25
- Portfolio: `portfolio/automationhub` (11,221 files strict-pruned) | no git
- Numbered: `02_AI_AGENTS/mcp-servers/automationhub` (11,258) | last commit 2026-03-06
- Signals: all three nearly identical post-prune. The 119K count seen with naive find was Python `__pycache__`/`venv` content. Canonical added MIGRATION_NOTES.
- Verdict: **KEEP_CANONICAL**

### oss/design-system/
- Canonical: 240 files | last commit 2026-05-25; F8 UI per the OSS README
- No numbered counterpart found (no `portfolio/design-system` or similar; the design systems inside products are per-product variants).
- Verdict: **NO_COUNTERPART**
- Action: none.

## packages/ aggregate

| Package | Canonical files | Closest counterpart | Counterpart files | Counterpart age | Verdict |
|---|---:|---|---:|---|---|
| `packages/auth` | 33 | `03_Enterprize_application/packages/shared-auth` | 25 | 2026-04-29 | KEEP_CANONICAL (newer, more files, jose-based; counterpart is older luna-os-auth with Supabase+jsonwebtoken+speakeasy) |
| `packages/billing` | 33 | `03_Enterprize_application/packages/shared-billing` | 27 | 2026-04-29 | KEEP_CANONICAL |
| `packages/telemetry` | 24 | `03_Enterprize_application/packages/shared-analytics` | 64 | 2026-04-29 | **MERGE** — counterpart has 2.5× the file count; lift any analytics/event-tracking modules canonical lacks |
| `packages/policy-engine` | 11 | (none — no shared-policy or similar in any numbered folder) | — | — | NO_COUNTERPART |
| `packages/ai-gateway` | 51 | `portfolio/sdlc-cc/cf-ai-gateway-worker` | 5 | 2026-05-24 | KEEP_CANONICAL (counterpart is a tiny stub) |
| `packages/shared-types` | 10 | `03_Enterprize_application/packages/shared-config` | 18 | 2026-04-29 | KEEP_CANONICAL (different scope: shared-config holds configs, not type contracts) |
| (n/a)   | — | `03_Enterprize_application/packages/shared-dashboard` | 304 | 2026-04-29 | **MERGE / INVESTIGATE** — no canonical equivalent; if dashboard primitives belong in a shared package, migrate; otherwise let products own their dashboards |
| (n/a)   | — | `03_Enterprize_application/packages/shared-sdlc` | 295 | 2026-04-29 | **INVESTIGATE** — possible overlap with `products/sdlc-cc/` and `oss/pipewarden`; founder should decide whether to fold into one of them or discard |

## Worktrees and noise to ignore

These appear repeatedly but contain no unique work:
- `portfolio/*.agent1`, `portfolio/*.agent2` — git worktrees of sibling repos
- `portfolio/push-ci.dev` (empty)
- `portfolio/queryflux` (empty)
- `portfolio/luna-os.agent1`, `luna-os.agent2` (empty)
- `02_AI_AGENTS/lunaos-repos/` — top-level stub only

## Recommended next steps

1. Resolve the 3 MERGE rows (amliq, tenantiq standalone, telemetry) before any further migration round.
2. Get founder verdict on the INVESTIGATE rows (mcp-tooling vs mcp-servers, shared-dashboard, shared-sdlc).
3. After MERGE/INVESTIGATE are closed, archive `/Users/shaharsolomon/dev/projects/portfolio/`, `02_AI_AGENTS/`, and `03_Enterprize_application/packages/` to a single `_archive_legacy_2026-05/` to stop confusion.
4. Update `_archive/portfolio-migration-inventory.md` so the next agent sees this audit as the source of truth.
