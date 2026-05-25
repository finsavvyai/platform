# Phase D — Anonymized Cross-MSP Industry Benchmark

**Goal:** PR magnet + sales hook. "Your tenants vs industry P50/P75/P90." Existing MSP benchmark only compares own tenants; this aggregates across all MSPs anonymously.

**Effort:** 1.5 weeks (7-8 working days). Solo eng. Privacy review separate.

## Verified Current State

| File | LOC | Notes |
|------|-----|-------|
| `apps/api/src/routes/msp-benchmark.ts` | 67 | per-MSP own-tenants comparison |
| `apps/api/src/routes/msp.ts` | 154 | MSP overview |
| `apps/api/src/routes/msp-profit.ts` | — | profit calc |
| `apps/web/src/routes/msp/benchmark/+page.svelte` | — | UI exists, intra-MSP only |
| `cis_scans` table | — | overall_score, pass/fail counts per scan |
| `licenses_cache`, `users_cache` | — | per-tenant aggregates already in DB |

## Honest Gaps

1. **No cross-org aggregation table** — `msp-benchmark.ts` queries within `WHERE organization_id = orgId`. No anonymized rollup across orgs.
2. **No industry/size cohort dimension** — tenants table has no `industry`, `employee_count` columns (verify).
3. **No k-anonymity enforcement** — privacy guardrail absent. Any cohort < N tenants must not publish.
4. **No public unauth API** — current `/api/msp-benchmark` requires auth; public benchmark endpoint absent.
5. **No badge/share mechanism** — no SVG generator or shareable link.

## Tasks (atomic commits)

### D1 — Cohort dimension model (1d)
- [ ] D1.1 Read existing `tenants` schema (`packages/db/src/schema-d1.ts`) — confirm absent `industry`, `employee_band` cols
- [ ] D1.2 Migration `0021_tenant_cohort_dims.sql` — add `industry TEXT, employee_band TEXT, region TEXT, opted_in_benchmark INTEGER DEFAULT 0` to `tenants`
- [ ] D1.3 Industry enum: 16 standard sectors (NAICS top-level subset). `apps/api/src/lib/benchmarks/cohorts.ts`
- [ ] D1.4 Employee bands: `<10, 10-49, 50-249, 250-999, 1000+`
- [ ] D1.5 Region: `na, eu, uk, apac, latam, mea`
- [ ] D1.6 Onboarding update: ask for industry + size during tenant connect (UI in `/onboarding` or `/settings`)
- [ ] D1.7 Opt-in checkbox: "Contribute anonymized metrics to industry benchmarks (uncheckable later)"

**Commit:** `feat(benchmark): tenant cohort dimensions and opt-in flag`

### D2 — Aggregation engine + k-anonymity (2d)
- [ ] D2.1 `apps/api/src/lib/benchmarks/aggregator.ts` — for each `(industry, employee_band, region)` cohort, compute P25/P50/P75/P90 of: CIS score, MFA coverage %, license utilization, alert volume, mean-time-to-resolve
- [ ] D2.2 K-anonymity guard: cohort sample_size < 10 → drop (don't publish)
- [ ] D2.3 Migration `0022_benchmark_aggregates.sql` — `benchmark_aggregates(id, cohort_industry, cohort_size, cohort_region, metric, p25, p50, p75, p90, sample_size, computed_at)` w/ unique index `(cohort_*, metric, computed_at)`
- [ ] D2.4 Cron nightly `0 5 * * *` — recompute all cohorts, write to D1, expire old (keep 90d history)
- [ ] D2.5 Unit tests: percentile math, k-anon enforcement, empty cohorts

**Commit:** `feat(benchmark): nightly cohort aggregator with k-anonymity ≥10`

### D3 — Public API + caching (1d)
- [ ] D3.1 `apps/api/src/routes/public/benchmarks.ts` — `GET /api/public/benchmarks?industry=&size=&region=&metric=` (no auth)
- [ ] D3.2 Rate limit: 60/min per IP via existing rate-limit middleware
- [ ] D3.3 Cache: KV-backed 1hr TTL per (cohort, metric)
- [ ] D3.4 Response schema: `{ cohort, metric, percentiles: { p25, p50, p75, p90 }, sample_size, computed_at }`
- [ ] D3.5 OpenAPI spec entry
- [ ] D3.6 Integration test: public access, k-anon edge case (small cohort returns 404 or "insufficient_data")

**Commit:** `feat(benchmark): public unauth API for industry percentiles`

### D4 — UI: tenant-vs-cohort view (2d)
- [ ] D4.1 `apps/web/src/routes/msp/benchmark/+page.svelte` — extend: add cohort selector, render percentile rings per metric, "your tenant" marker on distribution
- [ ] D4.2 `apps/web/src/lib/components/benchmark/PercentileRing.svelte` — D3-free SVG ring w/ ARIA labels
- [ ] D4.3 `apps/web/src/lib/components/benchmark/CohortDistribution.svelte` — box-plot or histogram of cohort distribution
- [ ] D4.4 Empty state: "Insufficient data in your cohort (need ≥10 tenants). Showing region-only."
- [ ] D4.5 Component tests + a11y check

**Commit:** `feat(web): tenant-vs-industry-cohort benchmark view`

### D5 — Shareable badge + marketing page (1.5d)
- [ ] D5.1 `apps/api/src/routes/public/badge.ts` — `GET /api/public/badge.svg?metric=mfa&tenant=<signed-token>` returns SVG: "Top 10% MFA Coverage — TenantIQ-verified"
- [ ] D5.2 Signed token: HMAC over (tenant_id, metric, percentile, expires_at) — no PII
- [ ] D5.3 `apps/web/src/routes/badges/+page.svelte` — admin: select metric, copy embed code, preview
- [ ] D5.4 Public landing page `apps/web/src/routes/benchmarks/+page.svelte` — show top-line industry stats (no per-tenant), CTA to sign up
- [ ] D5.5 robots.txt: allow indexing `/benchmarks/*` and `/api/public/benchmarks/*`
- [ ] D5.6 OG image generator for shared links

**Commit:** `feat(benchmark): shareable badge + public marketing page`

## Acceptance Gates

- [ ] At least one cohort has ≥10 opted-in tenants and publishes (or honest "not yet — need N more opt-ins")
- [ ] PII scrub test: dump `benchmark_aggregates` table, verify zero org/tenant identifiers leak
- [ ] Public API rate-limited correctly (61st request in 60s returns 429)
- [ ] Tenant viewing benchmark sees own percentile w/o seeing identity of other tenants
- [ ] Badge SVG renders correctly in iframe + as `<img>` on third-party site

## Risks / Unknowns

- **Privacy review** — anonymization claim is binding. Get legal/DPO sign-off before D3 ships. Document threat model: re-identification via narrow cohort + temporal correlation.
- **Cold-start cohort sparsity** — early cohorts (small industries, large enterprise size) may never reach k=10. Communicate honestly: "Insufficient data."
- **Opt-in default** — must be opt-in (off by default) per GDPR. Conservative legal stance.
- **Metric drift over time** — definition changes (e.g., new CIS controls) break time-series comparison. Version metric schema; tag aggregates w/ `metric_version`.
- **Gaming risk** — competitors could opt-in fake tenants to skew averages. Mitigation: weight by tenant age + sync activity (defer to v2).

## NOT In Scope

- Per-tenant detailed comparison (privacy violation)
- Real-time benchmark updates (nightly only)
- Customer-defined custom cohorts (NAICS + size + region only for v1)
- Predictive trending / "where will you be in 6 months" (defer)
- Direct competitive intelligence ("vs CoreView customers") — won't have data

## Files Touched (Concrete)

```
NEW:
  packages/db/migrations/0021_tenant_cohort_dims.sql
  packages/db/migrations/0022_benchmark_aggregates.sql
  apps/api/src/lib/benchmarks/cohorts.ts
  apps/api/src/lib/benchmarks/aggregator.ts
  apps/api/src/lib/benchmarks/badge-signer.ts
  apps/api/src/routes/public/benchmarks.ts
  apps/api/src/routes/public/badge.ts
  apps/api/src/cron/benchmark-aggregate-nightly.ts
  apps/web/src/routes/benchmarks/+page.svelte
  apps/web/src/routes/badges/+page.svelte
  apps/web/src/lib/components/benchmark/{PercentileRing,CohortDistribution}.svelte

MODIFIED:
  apps/api/src/routes/msp-benchmark.ts (add cohort context to existing intra-MSP view)
  apps/web/src/routes/msp/benchmark/+page.svelte (extend)
  apps/web/src/routes/onboarding/+page.svelte (add industry+size questions; verify exact path)
  apps/web/static/robots.txt (allow public pages)
  apps/api/wrangler.toml (add 0 5 * * * cron)
```
