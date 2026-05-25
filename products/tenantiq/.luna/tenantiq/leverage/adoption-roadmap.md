<!-- cspell:words tenantiq scubagear monkey365 cli-microsoft365 workers-sdk pnp -->

# Adoption Roadmap — tenantiq leverage

Sequenced for compounding wins, not parallel work. Each phase ends with a verifiable artifact.

## Phase 0 — Truth pass (½ day, do first)

- Fix CLAUDE.md "miniflare in use" claim → either land Phase 4 or correct the doc to reality.
- Reason: every later claim about test infra builds on this.

## Phase 1 — Federated SSO (~1.5 weeks) — unblocks enterprise revenue

- Source: pnp/cli-microsoft365 patterns (federated identity, certificate, managed identity).
- Files: new `apps/api/src/middleware/auth-federated.ts`, `apps/api/src/routes/auth-saml.ts`, `apps/api/src/routes/auth-oidc.ts`, new `org_idp_config` table.
- Why first: CLAUDE.md "Left → Priorities §1" calls SAML/OIDC SSO "critical for MSP sales". Highest revenue gate.
- Acceptance: Okta + Entra-as-IdP both work end-to-end against a staging tenant.

## Phase 2 — YAML config-as-code (~3–5 days)

- Source: ScubaGear `exclusions` / `annotations` / `omissions`.
- Files: `packages/shared/src/cis/scuba-config.schema.ts`, migration `0018_cis_tenant_overrides.sql`, modifications to `apps/api/src/lib/cis/scanner.ts:1` (59 LOC).
- Why second: small footprint, big customer-customization win after SSO lets bigger orgs onboard.
- Acceptance: a tenant admin can mark control "X" as accepted-risk via UI, the next scan honors it.

## Phase 3 — Close CIS coverage gap (~5–7 days)

- Source: Monkey365 (160+ checks claim) + ScubaGear baselines.
- Files: extend each `apps/api/src/lib/cis/controls-*.ts` (verified counts: 13/12/1/25/13/14/25; lower-bound 103 unique, upper ~120; gap 40–60).
- Add `cisVersion` field; allow tenant to pin version (~3 days inside the same phase).
- Acceptance: tenantiq enumerates ≥160 controls, parity claim verifiable in code.

## Phase 4 — Workers-runtime tests (~2–3 days)

- Source: workers-sdk `@cloudflare/vitest-pool-workers`.
- Files: `apps/api/vitest.config.ts:6` (replace `environment: 'node'`), `apps/api/package.json` deps.
- Why fourth: lands after Phases 1–3 add real surface to test against bindings + D1.
- Acceptance: existing 1213 tests pass under the new pool; coverage thresholds (90 line / 85 branch from `vitest.config.ts:14`) hold.

## Phase 5 — Snapshot + drift detection (~5–7 days)

- Source: Microsoft365DSC resource taxonomy.
- Files: extend `packages/db/src/schema-d1.ts` `config_snapshots` table, new cron `apps/api/src/cron/capture-snapshot.ts`, new lib `apps/api/src/lib/drift/diff.ts`, new web route `/audit/drift`.
- Acceptance: a captured baseline + a tenant change produces a structured drift record visible on `/audit/drift`.

## Phase 6 — National-cloud + MITRE/NIST mapping (~4 days, parallelizable)

- National-cloud (Monkey365): modify `apps/api/src/lib/graph-client.ts:1` (194 LOC), add `cloud_environment` column on `tenants`, settings UI.
- MITRE/NIST mapping (ScubaGear): extend `CisControl` type with `frameworks?: { nist?, attack? }`, source mappings from ScubaGear `docs/misc/mappings.md` (CC0-1.0, attribution required).
- Acceptance: USGov tenant can run a scan; CIS UI displays NIST/ATT&CK badges per control.

## Total

≈ **5–7 weeks** sequential. Phase 6 sub-tasks parallelize to compress to ~5 weeks if two engineers are available.

## What gets deliberately skipped

- OPA/Rego runtime (ScubaGear) — workers feasibility unverified.
- PS DSC push/enforce (M365DSC) — out of charter.
- Per-workload CLI surface (cli-microsoft365) — out of charter.
- Cloudflare C3 + chrome-devtools-patches deep work — defer until needed.

## Self-check

Every file path cited above was verified in this session via `ls` / `wc -l` / `grep`. Effort estimates are explicitly **rough** — they will move once the code is opened. Re-run `/ll-no-bluff` after Phase 1 lands to verify commit messages are honest about what changed.
