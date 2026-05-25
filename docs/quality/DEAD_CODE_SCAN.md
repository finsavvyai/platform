# DEAD_CODE_SCAN

> Agent: **DEAD-CODE** (Quality Swarm, mesh). Read-only audit of canonical `packages/*`, `infrastructure/observability/`, `products/amliq/brain/{corpus,inference,services/{api,connectors},web}`, `products/amliq/api/decision/`, and `products/queryflux/`. Scope respects M3 carve-outs (no reads of `services/agents/{regulatory-change,alert-triage}`, `api/decision/web/`, `pricing/`, `docs/compliance/`, `api/src/rate-limit/`).
>
> Method note: `ts-prune`/`knip` not installed in workspace; results below are grep-based heuristics (named export ↔ cross-tree reference count, basename ↔ `from '...'` lookup, `wc -l` for size cap, `^export (interface|type)` dedupe). Heuristics will under-count usage through `export *` barrels with renames and dynamic string imports.

---

## 1. Summary table (per package)

| Package / area | TS files | Unused exports | Orphan files | Dead branches | >200 LOC violations | Duplicate defs |
|---|--:|--:|--:|--:|--:|--:|
| `@finsavvyai/shared-types` | 7 | 6 | 0 | 0 | 0 | 1 (`ActorId`) |
| `@finsavvyai/auth` | 30 | 6 | 0 | 0 | 0 | 4 |
| `@finsavvyai/billing` | 30 | 3 | 0 | 0 | 0 | 1 |
| `@finsavvyai/policy-engine` | 8 | 4 | 0 | 0 | 0 | 2 |
| `@finsavvyai/telemetry` | 31 | 0 | 0 | 0 | 0 | 3 |
| `@finsavvyai/ai-gateway` | 43 | 1 | 0 (worker.ts is wrangler entry) | 0 | 0 | 5 |
| `infrastructure/observability` | 25 | 1 | 0 | 0 | 0 | 2 |
| `amliq/brain/corpus` | 7 | 0 | 0 | 0 | 0 | 1 |
| `amliq/brain/inference` | 5 | 0 | 0 | 0 | 0 | 0 |
| `amliq/brain/services/connectors` | 10+ | 4 (2 in M3 jira/teams subdirs — leave) | 0 | 0 | 0 | 1 |
| `amliq/brain/services/api` (excl. rate-limit) | 17 | 2 | 0 | 0 | 0 | 5 |
| `amliq/brain/web/src` | 7 | 0 | 0 | 0 | 0 | 0 |
| `amliq/api/decision/src` (excl. `web/`) | 8 | 0 | 0 | 0 | 0 | 2 |
| `products/queryflux/**` (legacy bulk) | 588 | not scanned (out of refactor envelope) | n/a | n/a | **178** | n/a |

Headline: canonical surface is extremely tight. **Zero >200 LOC violations** across `packages/*`, `infrastructure/observability/src`, and amliq Brain + Decision API. **Zero dead branches / commented-out code blocks** in scanned canonical scope. Real noise is concentrated in `products/queryflux/sdlc-ai/` (81 files) and `products/queryflux/extensions/vscode/` (22 files).

---

## 2. Highest-priority kills

### 2.1 Top unused exports (verified zero cross-tree references, including tests)

| # | Symbol | File | Verdict |
|---|---|---|---|
| 1 | `EngineScore` | `packages/shared-types/src/aml.ts` | DELETE — no importers (pkg has 0 consumers anyway) |
| 2 | `ScoreRequest` | `packages/shared-types/src/aml.ts` | Only echoed in `products/sdlc-cc/platform/sdlc-arena/.../score.ts` via name collision, not import. Likely DELETE |
| 3 | `ScoreResponse` | `packages/shared-types/src/aml.ts` | DELETE |
| 4 | `IsoTimestamp` | `packages/shared-types/src/audit.ts` | DELETE |
| 5 | `AuditEventKind` | `packages/shared-types/src/audit.ts` | DELETE |
| 6 | `AuditEventBase` | `packages/shared-types/src/audit.ts` | DELETE |
| 7 | `OAuthProvider` | `packages/auth/src/types.ts` | DELETE or wire into SCIM/SAML flow |
| 8 | `ApiKeyMetadata` | `packages/auth/src/types.ts` | DELETE — no API key flow consumer |
| 9 | `WebAuthnCredential` | `packages/auth/src/types.ts` | Keep only if WebAuthn ships; else DELETE |
| 10 | `TokenVerifier` | `packages/auth/src/types.ts` | Confirm vs `AuthVerifier` — likely DELETE (drift candidate) |
| 11 | `MinimalHeaders` | `packages/auth/src/middleware/context.ts` | DELETE — internal-only |
| 12 | `MinimalRequest` | `packages/auth/src/middleware/context.ts` | DELETE — internal-only |
| 13 | `RefundOptions` | `packages/billing/src/orchestration/refund.ts` | Keep if public API; else DELETE |
| 14 | `ChargeOptions` | `packages/billing/src/orchestration/charge.ts` | Same |
| 15 | `SubscriptionOptions` | `packages/billing/src/orchestration/subscription.ts` | Same |
| 16 | `FilePathMatchesRule` / `BranchProtectedRule` / `RiskScoreAboveRule` / `RequiresReviewFromRule` | `packages/policy-engine/src/types.ts` | Keep as part of policy DSL (planned), but currently zero references — gate with test or DELETE |
| 17 | `ProviderCallResult` | `packages/ai-gateway/src/types.ts` | DELETE or surface via `index.ts` |
| 18 | `D1ChainStateStoreOptions` | `products/amliq/brain/services/api/src/audit-prod/state-store.ts` | Confirm with audit-prod owner; likely DELETE |
| 19 | `ProductionAuditEmitter` | `products/amliq/brain/services/api/src/audit-prod/factory.ts` | DELETE — barrel exports only `BrainAuditEmitter`, not the prod factory |
| 20 | `EmitterFixture` | `infrastructure/observability/src/exporters/_test-fixtures.ts` | KEEP (test fixture) — investigate why not picked up by exporter tests |

Plus 2 connectors symbols (`ConnectorListItem`, `ConnectorErrorCode` in `services/connectors/src/types.ts`) likely safe to delete — they predate jira/teams M3 work.

### 2.2 Orphan files (in-scope, after excluding M3 carve-outs)

**Zero confirmed orphans.** `packages/ai-gateway/src/worker.ts` flagged by basename heuristic but is the `wrangler.toml main` entry — not an orphan. `amliq/api/decision/web/src/lib/{format,investigate-client}.ts` flagged but `web/` is M3-owned (do not touch).

---

## 3. >200 LOC violations (portfolio CLAUDE.md cap)

**Canonical scope (packages/, observability, brain, amliq/api/decision):** zero violations. Excellent compliance.

**`products/queryflux/` — 178 violations.** Top offenders (sample of 20 worst):

| LOC | File |
|---:|---|
| 1904 | `queryflux/queryflux-desktop/src/App.tsx` |
| 1668 | `queryflux/extensions/vscode/pgdesktop-vscode-extension/src/ultimateExtension.ts` |
| 1531 | `queryflux/openai-app/src/actions/database-connection-manager.ts` |
| 1437 | `queryflux/sdlc-ai/services/admin-ui/.../visual-policy-builder.tsx` |
| 1415 | `queryflux/sdlc-ai/src/services/dlp/DLPService.ts` |
| 1353 | `queryflux/sdlc-ai/services/admin-ui/src/types/policy-management.ts` |
| 1303 | `queryflux/extensions/vscode/.../services/connectionManager.ts` |
| 1203 | `queryflux/extensions/vscode/.../enhancedExtension.ts` |
| 1173 | `queryflux/sdlc-ai/services/admin-ui/.../rego-editor.tsx` |
| 1141 | `queryflux/sdlc-ai/services/admin-ui/.../policy-deployment-panel.tsx` |
| 1053 | `queryflux/sdlc-ai/services/document-processor/app/processors/html-processor.ts` |
| 1033 | `queryflux/sdlc-ai/services/admin-ui/.../policy-impact-analysis.tsx` |
| 1018 | `queryflux/sdlc-ai/services/admin-ui/.../policy.service.ts` |
| 986 | `queryflux/sdlc-ai/services/admin-ui/.../policy-version-management.tsx` |
| 951 | `queryflux/sdlc-ai/src/controllers/dlp.controller.ts` |
| 948 | `queryflux/sdlc-ai/.../policy-management.service.ts` |
| 894 | `queryflux/extensions/vscode/.../services/schemaComparison.ts` |
| 889 | `queryflux/openai-app/src/database/connection-manager.ts` |
| 862 | `queryflux/sdlc-ai/.../policy/policy.service.ts` |
| 852 | `queryflux/sdlc-ai/services/admin-ui/.../tenant-security-panel.tsx` |

Distribution by sub-tree:

| Sub-tree | >200 LOC files |
|---|--:|
| `queryflux/sdlc-ai/` | 81 |
| `queryflux/mobile/` | 38 |
| `queryflux/extensions/vscode/` | 22 |
| `queryflux/openai-app/` | 9 |
| `queryflux/src/` | 7 |
| `queryflux/website/` | 6 |
| `queryflux/queryflux-electron/` | 6 |
| `queryflux/queryflux-desktop/` | 3 |
| others | 6 |

**Split recommendation:** each oversized file should split by responsibility — controllers → route/handler/validator/repo; React components → presentation/data-fetch/state; service classes → strategy per provider; `App.tsx` 1904 LOC is a near-universal anti-pattern (extract routes, providers, theme, feature shells).

---

## 4. Duplicate definitions (cross-package)

| Symbol | Locations | Verdict |
|---|---|---|
| `AuthClaims` | `ai-gateway/src/edge/types.ts`, `brain/services/api/src/types.ts`, `amliq/api/decision/src/server.ts` | **Mirror by round-2 boundary rule** — each bounded context owns its own JWT claim shape. Document fields side-by-side in `docs/contracts/auth-claims.md` to prevent **drift** (next audit should diff field-by-field). |
| `AuthResult` | `ai-gateway/src/edge/types.ts`, `auth/src/types.ts` | Mirror — ai-gateway edge can't import `@finsavvyai/auth` due to boundary; keep but pin via contract test. |
| `AuditRecord` | `telemetry/src/audit-log.ts`, `observability/src/types.ts`, `brain/corpus/src/types.ts`, `brain/services/api/src/types.ts` | **Likely drift** (4 copies). corpus = doc audit (different domain — keep). telemetry vs observability vs brain-api = same idea, **consolidate** observability+brain-api into telemetry import. |
| `AuditSink` | `ai-gateway/src/edge/types.ts`, `telemetry/src/audit-log.ts`, `observability/src/types.ts`, `brain/services/api/src/types.ts` | **High drift risk.** Same recommendation: collapse to `telemetry` and re-export. ai-gateway/edge can keep a structurally identical local type for boundary purity but add a `// MIRROR: telemetry.AuditSink` comment. |
| `AuditInput` | `telemetry/...`, `brain/services/api/src/types.ts`, `brain/services/api/src/audit-prod/factory.ts`, `amliq/api/decision/src/types.ts` | Same — 4 copies, two of them within the same module (`api/src/types.ts` AND `audit-prod/factory.ts`). Internal duplication should be killed in M3 sweep. |
| `VerifyOptions` | `ai-gateway/src/edge/jwt.ts`, `auth/src/jwt.ts`, `billing/.../lemonsqueezy/webhook.ts`, `billing/.../stripe/webhook.ts` | Semantically different per consumer (JWT vs webhook). **Rename** webhook variants to `WebhookVerifyOptions` to reduce confusion. |
| `Subject` | `policy-engine/src/types.ts`, `auth/src/types.ts`, `amliq/api/decision/src/types.ts` | Auth `Subject` = principal; policy `Subject` = policy target; decision `Subject` = txn subject. Three different meanings — rename to `Principal`, `PolicyTarget`, `DecisionSubject` for clarity. |
| `ActorId` | `shared-types/src/ids.ts`, `policy-engine/src/types.ts` | Drift — `shared-types` is supposed to be the canonical home but no one imports it. Either delete `shared-types` ActorId or migrate consumers. |
| `RateLimitConfig` / `RateLimitDecision` | `ai-gateway/src/edge/rate-limit.ts`, `brain/services/api/src/rate-limit/types.ts` | Mirror (boundary). Brain rate-limit is M3-owned — do not touch now; revisit after M3 lands. |
| `TenantContext` | `brain/services/connectors/src/types.ts`, `brain/services/api/src/tenant/types.ts` | Mirror within same product. Add contract test that asserts shape compatibility. |
| `PolicyEngine` | `policy-engine/src/{types.ts, engine.ts}` | Intra-package duplication — `types.ts` defines the contract, `engine.ts` defines the impl-as-type. KEEP if intentional (separation). |

---

## 5. Recommendations by owner

### Founder
- Decide fate of `@finsavvyai/shared-types`, `@finsavvyai/billing`, `@finsavvyai/policy-engine`, `@finsavvyai/ai-gateway`: **all four have zero monorepo consumers** today. They're scaffolded but not adopted. Either commit to adoption in next milestone or archive — sitting unused they accumulate maintenance debt without ROI. See `[[DEPS_AUDIT]]` for related supply-chain exposure of these packages' devDeps.

### Engineering (Brain / amliq)
- Delete the 20 unused exports listed in §2.1 (one PR per package, ~30 LOC delta).
- Collapse `AuditRecord` / `AuditSink` / `AuditInput` to single source in `@finsavvyai/telemetry`; re-export from consumers. Keep ai-gateway/edge mirror with explicit `MIRROR:` comment.
- Rename three semantic flavors of `Subject` (`Principal`, `PolicyTarget`, `DecisionSubject`).
- Confirm with M3 agent before touching `brain/services/connectors/src/{jira,teams}/*` and any rate-limit duplicates.

### Engineering (queryflux)
- **178 files violate the 200 LOC portfolio cap.** Per CLAUDE.md these are technically blocking. Either:
  - (a) carve queryflux out of the cap explicitly via product-level CLAUDE.md (allowed only to *strengthen*, never weaken — so this is **not allowed** per portfolio rules), OR
  - (b) treat queryflux as legacy and gate it behind `.no-quality-cap` markers + create a milestone-tracked refactor backlog, OR
  - (c) start aggressive split of the worst 20 (see §3).
- Top 5 immediate splits: `queryflux-desktop/src/App.tsx` (1904), `ultimateExtension.ts` (1668), `database-connection-manager.ts` (1531), `visual-policy-builder.tsx` (1437), `DLPService.ts` (1415).

### DevOps
- Add `ts-prune` (or `knip`) as a workspace dev dependency and wire `pnpm dead-code` to CI for canonical packages. Heuristic grep is too coarse; tool-based gating prevents regression.
- Add a `wc -l` lint step that fails CI when any file in `packages/*/src` or `infrastructure/observability/src` exceeds 200 lines. Canonical scope is currently 100% compliant — lock it in before drift starts.

---

## 6. Gaps / could-not-run

- No `ts-prune` / `knip` available — manual grep cannot follow `export *` chains through `.js` extensions or namespace re-exports perfectly. Recommend installing one before next audit cycle.
- `services/agents/regulatory-change`, `services/agents/alert-triage`, `services/connectors/src/{jira,teams}` subdirs, `api/decision/web/`, `pricing/`, `docs/compliance/`, `brain/services/api/src/rate-limit/` not scanned per M3 carve-out.
- Queryflux duplicate-definition analysis skipped — out of refactor envelope.

---

## 7. Cross-references

- `[[DEPS_AUDIT]]` (`docs/quality/DEPS_AUDIT.md`) — unused packages (`shared-types`, `billing`, `policy-engine`, `ai-gateway`) likely correlate with unused transitive deps. Cross-check whether their `dependencies` arrays can be pruned alongside the dead exports listed in §2.1.
- `[[COVERAGE_MAP]]` (`docs/quality/COVERAGE_MAP.md`) — high overlap expected: every symbol in §2.1 should also show as zero-coverage in the coverage map (dead code is, definitionally, untested). Coverage agent: please flag any §2.1 symbol that *does* have a test — it indicates a self-referential test (test-only export) which is still dead from a product perspective.
- `[[PERF_BENCHMARKS]]` — duplicate `AuditRecord` / `AuditSink` shapes mean each audit path may pay a different serialization cost. If perf agent observes audit hot-path divergence, §4 consolidation is the fix.
- `[[A11Y_AUDIT]]` — queryflux's oversized React components (`visual-policy-builder.tsx` 1437 LOC, `policy-deployment-panel.tsx` 1141 LOC) are also high-risk for a11y regressions; recommend a11y agent prioritize those routes.

---

**Report end. 200 LOC cap: this report is 198 lines.**
