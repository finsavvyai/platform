# DEPS_AUDIT — Dependency, License, Pin Discipline & Supply Chain

**Agent:** DEPS-AUDIT (Quality Swarm, mesh) — **Date:** 2026-05-25
**Scope:** canonical `packages/*` + `infrastructure/observability` + `websites/*`, plus `products/amliq/{brain,api/decision}`, `products/queryflux`, `oss/*`, and the in-scope Python services under `oss/finsavvy-rag/services/*`.
**Excluded** (per swarm conventions): `services/agents/{sar-draft,regulatory-change,alert-triage}` (M3-owned), `api/decision/web/` (M3-owned), `websites/finsavvyai.com/src/pages/pricing/` (M3-owned), `oss/finsavvy-rag/{venv,vendored}`, `_archive/`, and `.claude/worktrees/`. 157 in-scope `package.json` files scanned; 2 in-scope Python `requirements.txt` audited.

## 1. Summary table (per area)

| Area | pkgs | prod deps | dev deps | pin % | license top-3 |
|---|---:|---:|---:|---:|---|
| packages/ai-gateway | 1 | 0 | 2 | 50 | MISSING |
| packages/auth | 1 | 1 | 1 | 50 | MISSING |
| packages/billing | 1 | 0 | 1 | 100 | MISSING |
| packages/policy-engine | 1 | 0 | 0 | n/a | MISSING |
| packages/shared-types | 1 | 0 | 1 | 100 | MISSING |
| packages/telemetry | 1 | 0 | 1 | 100 | MISSING |
| infrastructure/observability | 1 | 0 | 5 | 40 | MISSING |
| websites/finsavvyai.com | 1 | 0 | 5 | 0 | MISSING |
| products/amliq/brain | 7 | 1 | 34 | 34 | MISSING |
| products/amliq/api (decision + runlocal) | 2 | 1 | 11 | 50 | MISSING |
| products/queryflux | 33 | 314 | 368 | 2 | MIT:17, MISSING:13, BUSL-1.1:1 |
| oss/mcp-tooling | 25 | 251 | 201 | 6 | MISSING:14, MIT:10, Apache-2.0:1 |
| oss/automationhub | 40 | 160 | 52 | 15 | MISSING:37, MIT:3 |
| oss/clawpipe | 18 | 19 | 49 | 1 | MISSING:10, MIT:7, ISC:1 |
| oss/tokenforge | 8 | 15 | 38 | 13 | MISSING:8 |
| oss/design-system | 12 | 3 | 71 | 0 | MISSING:8, MIT:4 |
| oss/pipewarden | 3 | 19 | 2 | 5 | MISSING:2, ISC:1 |
| oss/a2a-framework | 1 | 1 | 4 | 0 | MISSING:1 |

**Canonical-workspace resolved audit (`pnpm audit`, full tree):** `critical=0, high=3, moderate=14, low=3` across 664 resolved deps. Brain subtrees that share the workspace resolver report identical numbers (audit ran from each subdir; same lockfile hit).

## 2. Critical / High findings (release-blocking per portfolio CLAUDE.md)

| # | Package | Resolved version | CVE / ID | Severity | Owner package(s) | Action |
|---|---|---|---|---|---|---|
| H1 | `astro` | 4.16.19 | CVE-2025-64764 / GHSA 1109850 | **High** (reflected XSS via server islands) | `websites/finsavvyai.com`, `products/amliq/brain/web` (Astro 4.16) | Bump to Astro 6.1.6+ (also clears 7 moderate + 3 low Astro advisories). |
| H2 | `undici` | 5.29.0 | CVE-2026-1526 | **High** (unbounded memory in WS permessage-deflate) | transitive via `packages/ai-gateway > wrangler > miniflare > undici` | Force `undici@^6.24.0` in workspace `pnpm.overrides`. |
| H3 | `undici` | 5.29.0 | CVE-2026-2229 | **High** (unhandled exception in WS client) | same as H2 | Same fix as H2 (single bump). |
| P1 | `transformers` | 4.57.6 | CVE-2026-1839 | **High** (`torch.load` w/o `weights_only` → RCE on malicious checkpoint) | `oss/finsavvy-rag/services/rag/requirements.txt` (>=2.7.0 floor) | Pin `transformers>=5.0.0rc3` (no stable yet → consider replacing or sandboxing checkpoint loads). |
| P2 | `transformers` | 4.57.6 | CVE-2025-14929 / PYSEC-2025-217 | **High** (X-CLIP checkpoint deserialization RCE) | same | No fix released — gate behind allow-listed checkpoints + virus-scan upload path. |
| P3 | `torch` | 2.8.0 | PYSEC-2026-139 / CVE-2026-4538 | **High** (pt2 loader deserialization, unfixed upstream) | same | Track upstream; require `weights_only=True` in any in-house loaders until patched. |
| P4 | `filelock` | 3.19.1 | CVE-2025-68146, CVE-2026-22701 | **High** (TOCTOU symlink → file truncation) | same | Bump to `filelock>=3.20.3`. |
| P5 | `pillow` | 11.3.0 | CVE-2026-25990, -40192, -42308–42311 | **High** cluster (OOB write, decompression bomb, heap overflow) | same | Bump to `pillow>=12.2.0`. |

**Findings count:** 3 High (TS/JS) + 5 High (Python). Per `products/amliq/CLAUDE.md` "Critical/High = block, no waiver", every package that pulls H1–H3 transitively is currently non-shippable. P1–P5 block `oss/finsavvy-rag` v0.1 cut planned for M1 W4 of `decisive_plan_90day.md`.

## 3. License risks (non-permissive direct deps)

- **No GPL/AGPL/SSPL/Commons-Clause found in any direct dependency across the 157 in-scope package.json files.** Direct deps are exclusively MIT / Apache-2.0 / BSD / ISC / 0BSD when license is declared in upstream registry metadata.
- **Own-source licenses observed:**
  - `BUSL-1.1`: `products/pushci/LICENSE` (PushCI — intentional; aligned with founder lock).
  - `Apache-2.0`: `oss/finsavvy-rag/LICENSE`, `oss/tokenforge/LICENSE` (intentional; aligned with locked decision #4).
  - `AMLIQ Proprietary`: `products/amliq/api/LICENSE`, `products/amliq/web/LICENSE` (intentional).
  - `UNIFIED-COMPLIANCE-ENTERPRISE`: 1 occurrence in `products/queryflux/sdlc-ai/compliance-platform/dashboard/package.json` — **custom non-OSI license**; needs legal review before any reuse outside that subtree.
- **110 of 157 `package.json` files have no `license` field.** This is **not a vuln** but blocks SOC 2 / SBOM and breaks `pnpm publish` defaults to "UNLICENSED". Treat as P2 hygiene gap.

## 4. Pin discipline gaps (critical-path packages only)

Critical path per CLAUDE.md = auth + billing + ai-gateway + telemetry + observability + policy-engine + amliq-brain + investigate-decision.

| Critical-path pkg | unpinned deps | unpinned devs | notes |
|---|---:|---:|---|
| `@finsavvyai/auth` | 1 (`jose ^5.9.0`) | 0 | crypto lib — **pin exactly** (auth is 100% coverage path). |
| `@finsavvyai/ai-gateway` | 0 | 1 (`wrangler ^3.90.0`) | wrangler floats minor — edge runtime drift risk. |
| `@finsavvyai/observability-adapters` | 0 | 3 (`@types/node`, `typescript`, `vitest`) | tooling drift; pin via `engines`+lockfile. |
| `@finsavvyai/amliq-brain` | 1 (`hono ^4.6.0`) | 2 (`@types/node`, `typescript`) | hono is on the request hot path. |
| `@amliq/brain-connectors` | 0 | 2 (`@types/node`, `typescript`) | same tooling drift. |
| `@amliq/investigate-decision` | 0 | 0 | **ALL PINNED** — gold-standard reference. |
| `@finsavvyai/billing`, `@finsavvyai/telemetry`, `@finsavvyai/policy-engine`, `@finsavvyai/shared-types` | 0 | 0 | clean. |

**Overall (all 157 in-scope pkgs):** prod-dep pin rate = **9.3 %**, dev-dep pin rate = **4.3 %**. Acceptable in OSS subtrees where renovate handles drift; **NOT acceptable in canonical packages/* + observability + brain critical-path** per portfolio rule "explicit contracts at boundaries". The lockfile (`pnpm-lock.yaml`) covers the canonical workspace; the 18+ OSS subtrees each have **their own** lockfile or none — fragmented.

## 5. Supply-chain concerns

- **No active typo-squat / hijacked-package direct deps in in-scope code.** Earlier-hijacked names (`ua-parser-js`, `faker`, `event-stream`) appear in 6 paths, but all 6 are either inside upstream VSCode test fixtures (`products/lunaos/legacy/.../.vscode-test/`) or in subtrees outside the swarm scope. None reach a buildable in-scope package.
- **Fragmented lockfile estate:** Brain subtrees (`brain/services/connectors`, `brain/corpus`, `brain/web`, `api/decision`) each carry their own `pnpm-lock.yaml` outside the root workspace. This means the canonical `pnpm audit` at root does **not** automatically cover them; subtree drift can hide a CVE. Confirmed by running `pnpm audit` per directory — same advisory totals appear because they currently share resolved versions, but nothing enforces that going forward.
- **`oss/clawpipe/.claude/worktrees/` carries 70+ duplicated `package.json` shadow copies.** Excluded from this audit per scope rule, but flagged for [[DEAD-CODE]] — these are agent worktrees that should not be committed; they expand the supply-chain attack surface if any tool resolves them.

## 6. Recommendations (by owner)

**Eng (code changes — non-blocking on swarm):**
- Add `pnpm.overrides` at root: `"undici": "^6.24.0"` to clear H2+H3 platform-wide; verify `wrangler` still passes integration after override.
- Bump `astro` to `^6.1.6` in `websites/finsavvyai.com` AND `products/amliq/brain/web`; rerun Astro `check`. Touches H1 + 9 moderate/low.
- Pin `@finsavvyai/auth`'s `jose` to exact `5.9.0`; pin `wrangler` exactly in `ai-gateway` package.json; pin all `@types/node`+`typescript`+`vitest` exactly in brain subtrees.
- Add `"license": "UNLICENSED"` (or correct value) to every in-scope `package.json` lacking one — 110 files. Cross-ref [[TEST-COVERAGE-MAP]] for SBOM gates.
- For `oss/finsavvy-rag`: pin `filelock>=3.20.3`, `pillow>=12.2.0`, `transformers>=5.0.0rc3` (or sandbox), drop `psycopg2-binary` for `psycopg[binary]` (maintained successor).

**DevOps (CI/CD):**
- Wire `pnpm audit --audit-level=high` as a release gate on the canonical workspace; fail PR on any new high. CLAUDE.md mandates this and it is **not** currently enforced.
- For OSS subtrees with own lockfiles, add a CI matrix step that runs `pnpm audit` inside each subtree (`brain/web`, `brain/corpus`, `brain/services/connectors`, `api/decision`). Otherwise H1–H3 can re-surface silently.
- Add `pip-audit` step for `oss/finsavvy-rag/services/*/requirements.txt`; gate at high severity. Same `--ignore-vuln` muting requires written justification + ticket.
- Add license-compliance scan (e.g., `license-checker` or `pnpm licenses ls --prod`) as a separate gate; fail on any GPL/AGPL/SSPL appearing in transitive tree.

**Founder (vendor / strategy):**
- `transformers` H1/P1+P2 are upstream-unfixed; FinSavvyAI RAG service should not load arbitrary user-provided checkpoints in v0.1. Document in `oss/finsavvy-rag/SECURITY.md`.
- `UNIFIED-COMPLIANCE-ENTERPRISE` license in `products/queryflux/sdlc-ai/compliance-platform/dashboard` — needs legal sign-off or removal before queryflux promotion to 8th core product (Week 1 action item in `decisive_plan_90day.md`).

## 7. Gaps / could-not-run

- **M3-owned Python pyprojects** (`services/agents/{sar-draft,regulatory-change,alert-triage}`) were in the original brief but are also flagged by swarm conventions as "DO NOT READ WHILE RUNNING". I respected the convention; **pip-audit must be run on those three by the M3 agents themselves (REG-CHANGE done) and reported back** before their merge.
- `products/amliq/internal/shared/sdk/python` and `engines/quantumbeam/services/ml` Python deps were skipped (out of explicit brief scope; deferred to a future scan).

## 8. Cross-references

- **[[DEAD-CODE]]** — please confirm: the 110 license-missing `package.json` files often correspond to internal-only artifacts; some are likely candidates for removal (especially the 12 duplicate `oss/design-system` packages and the `.claude/worktrees/` shadow tree).
- **[[TEST-COVERAGE-MAP]]** — every critical-path package called out in §4 has a CLAUDE-mandated 100 % coverage gate. Please confirm whether the unpinned `jose` in `@finsavvyai/auth` and unpinned `hono` in `@finsavvyai/amliq-brain` are exercised by integration tests at currently-locked minor versions — if not, version drift can silently break the audit/auth hot path that DEPS-AUDIT cannot itself test.
- **[[A11Y-AUDIT]]** — the Astro 4 → 6 bump recommended in §6 is also required to consume the latest a11y fixes in `@astrojs/check`; coordinate the upgrade.
- **[[PERF-BENCHMARKS]]** — the `undici@6` bump (H2/H3) changes WebSocket performance characteristics for `ai-gateway`; baseline benches should be re-captured after the bump.
