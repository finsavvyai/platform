# TenantIQ Expansion Plan — 5 Phase Roadmap (A–E)

**Generated:** 2026-04-28
**Goal:** Beat CoreView / Syskit Point / BetterCloud. Build moats: AI-native detection, ecosystem (Skill SDK), anonymized industry data, multi-cloud TAM.
**Approach:** No-bluff. Each phase grounded in verified existing files; gaps are honest.

## Phase Index

| ID | Title | Effort | Plan |
|----|-------|--------|------|
| A | SSO Hardening + Drift Attribution | 3w | [A-sso-drift.md](./A-sso-drift.md) |
| B | Copilot Governance Deep | 2w | [B-copilot-deep.md](./B-copilot-deep.md) |
| C | Skill SDK + External Marketplace | 2.5w | [C-skill-sdk.md](./C-skill-sdk.md) |
| D | Anonymized Cross-MSP Benchmark | 1.5w | [D-cross-msp-benchmark.md](./D-cross-msp-benchmark.md) |
| E | Google Workspace Beta | 3w | [E-google-workspace.md](./E-google-workspace.md) |

**Total:** ~12 weeks calendar w/ no parallelism, ~8 weeks w/ 2-eng parallelism.

## Sequence

```
Week 0─┬─ A (SSO+Drift)         ─────────────┐
       │                                      │
Week 3─┼─ B (Copilot Deep)  ──────┐           ├── E starts after A done
       │                          │           │   (provider abstraction
Week 3─┴─ C (Skill SDK) ─────┐    │           │   needs stable tenants table)
                              │    │           │
Week 5─                       ├────┴───────────┤
                              │                │
Week 5.5─ D (Benchmark)  ─────┘                │
                                                │
Week 6─────────────── E (Workspace) ────────────┘
                                                ┴── Week 9
```

**Critical path:** A (gates enterprise sales) → E (gates multi-cloud TAM expansion).
**Parallel path:** B + C can run alongside A w/ separate engineer (different surfaces).
**D depends on data accumulation:** opt-in cohort needs ≥10 tenants per slice; runs after onboarding update lands in Phase A or earlier.

## Sequencing Rationale

1. **A first** — every enterprise deal asks "can you do SCIM?" + "where's the audit trail?" Gates revenue.
2. **B + C in parallel** — different surfaces (B = M365 Graph; C = SDK + marketplace). Two engineers can run side-by-side.
3. **D last (small)** — needs cohort opt-in data accumulating; landing it after onboarding flow updates lets it ship populated.
4. **E after A** — provider abstraction needs stable migrations; running E1 mid-A risks merge conflicts on `tenants` schema.

## Verified Current State (Snapshot)

Confirmed exists (will be extended, not built):
- SSO: `sso.ts`, `sso-callback.ts`, `sso-jit.ts`, `sso-handlers.ts`, `sso-login.ts`, `sso-schemas.ts` (611 LOC)
- Drift: `lib/snapshots/drift-detector.ts`, `diff.ts`, `capture.ts` (678 LOC suite)
- Copilot: `copilot-readiness.ts` (181), `copilot-security.ts`, `copilot-usage.ts`, `lib/copilot/{readiness-engine,readiness-checks,readiness-report,readiness-types,usage-analytics}.ts`
- Skills: `tenants/skills-routes.ts` (70), `marketplace-config.ts` (81), `SkillCard/Gate/Recommendation` Svelte components, `skill-gate` middleware
- MSP benchmark: `msp-benchmark.ts` (67) intra-MSP only
- Tenants table: M365-only via `azure_tenant_id NOT NULL`

Confirmed absent (greenfield in plans):
- SCIM 2.0 (Phase A)
- Sensitivity-label / oversharing / IPI scanners (Phase B)
- `packages/skill-sdk` (Phase C)
- Cross-org `benchmark_aggregates` table (Phase D)
- `packages/google-workspace` (Phase E)
- Tenant cohort dimensions: industry, employee_band, region (Phase D)

## Cross-Phase Risks

1. **Migration ordering** — Phases A (0013, 0014), B (0015–0017), C (0018–0020), D (0021, 0022), E (0023–0025). Reserve numeric ranges; coordinate if parallel work touches same range.
2. **`tenants` schema churn** — Phases D (cohort cols) and E (provider col) both modify `tenants`. Combine into single migration if possible to reduce backfill risk.
3. **Cron crowding** — wrangler.toml already has 8 crons. Adding nightly aggregator (D), monthly payout (C), drift attribution post-step (A) brings to ~11. Worker cron limit on Cloudflare paid tier is 30; OK but monitor.
4. **Privacy + legal review** — Phase C (marketplace T&C) and Phase D (anonymization claims) have non-engineering blockers. Start legal track Day 1 of each phase.
5. **External dependencies** — Phase A needs Okta sandbox cert review; Phase E needs Workspace admin to grant DWD scopes; Phase C needs LemonSqueezy variant configuration. All can stall plans — pre-stage in Week 0.

## Definition of Done (per Phase)

Per portfolio CLAUDE.md and tenantiq CLAUDE.md:
- [ ] All new files ≤200 LOC
- [ ] Unit tests pass; ≥90% line / ≥85% branch coverage
- [ ] Integration tests for cross-component behavior
- [ ] Type-check clean (`npx tsc --noEmit`)
- [ ] No new SAST / dependency / secret scan findings
- [ ] Apple HIG pass on new UI: contrast, focus, keyboard, screen reader
- [ ] Migration applied locally (`npm run db:migrate:local`); remote application deliberate (separate change with approval)
- [ ] Updated CLAUDE.md if architecture or test strategy changes
- [ ] No TODO/FIXME without linked issue

## Honest Caveats

- Effort estimates are solo-eng working-day, not calendar. Add 1.5–2x for context-switching, code review, deployment friction.
- Phase E migration to provider abstraction will likely surface more code paths than initial grep suggests. Budget 1–2d slip on E1.
- Phase C marketplace launch is **gated by legal review of contributor T&C, payout taxation, and skill liability**. Engineering can ship technical pieces; public launch waits on legal.
- Phase D anonymization claim is binding once published. Early cohorts may lack k=10 sample size; communicate "Insufficient data" honestly rather than launch hollow.
- Roadmap explicitly does NOT include: Worker-for-Platforms, Gemini governance, deep Drive analytics for Workspace, predictive ML, or anything not concretely scoped above. Hold the line.

## What's Already Done (Earlier Sessions)

For context — recently shipped (don't redo):
- ScubaGear-style per-tenant CIS overrides (Phase 2 of leverage-roadmap, complete 2026-04-27)
- OpenSyber HMAC alert dispatcher
- TokenForge webhook receiver
- Auth gate / public route fix
- Phase 0 honesty pass on CLAUDE.md

See `.luna/tenantiq/leverage/adoption-roadmap.md` for prior leverage-driven work.

## Skipped Multi-Day Phases (From Leverage Roadmap)

These remain deferred (each multi-day, listed for tracking, not in expansion plan unless promoted):
- Phase 1 SSO core build → **superseded by Expansion Phase A** (extends existing instead of rebuilding)
- Phase 3 CIS coverage gap (5–7d) → not in expansion; pure breadth work
- Phase 4 vitest-pool-workers migration (2–3d) → not in expansion; tooling work
- Phase 5 Drift detection → **superseded by Expansion Phase A4 + A3** (UI + attribution)
- Phase 6 cloud_environment + MITRE/NIST tags (~4d) → partially overlaps Expansion Phase E1 + E5

## Next Action

Pick Phase to start. **Recommended: A (3-week burn, gates revenue).**

Once chosen, command:
```
Build Phase A. No bluffing. Stop at each task boundary for review.
```

Each task in each phase ends with an atomic commit. Reviewer can stop/redirect after any commit without losing work.
