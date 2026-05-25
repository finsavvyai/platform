# Phase B — Copilot Governance Deep

**Goal:** Own hottest M365 category Q2 2026. Existing readiness assessment is shallow; ship 4 deep capabilities competitors lack.

**Effort:** 2 weeks (10 working days). Solo eng.

## Verified Current State

| File | LOC | Notes |
|------|-----|-------|
| `apps/api/src/routes/copilot-readiness.ts` | 181 | POST /assess, history, PDF |
| `apps/api/src/routes/copilot-readiness-pdf.ts` | — | PDF export |
| `apps/api/src/routes/copilot-security.ts` | 98 | security signals |
| `apps/api/src/routes/copilot-usage.ts` | 81 | usage analytics |
| `apps/api/src/lib/copilot/readiness-engine.ts` | — | 7-category scoring engine |
| `apps/api/src/lib/copilot/readiness-checks.ts` | — | check definitions |
| `apps/api/src/lib/copilot/readiness-report.ts` | — | HTML→PDF report |
| `apps/api/src/lib/copilot/readiness-types.ts` | — | shared types |
| `apps/api/src/lib/copilot/usage-analytics.ts` | — | usage aggregation |
| `apps/web/src/routes/security/copilot/+page.svelte` | — | UI page exists |
| `apps/web/src/routes/security/copilot-usage/+page.svelte` | — | usage UI exists |
| `apps/api/src/lib/copilot-prompt-guard.ts` | — | prompt guard exists |
| Table | — | `copilot_assessments` exists per route |

## Honest Gaps

1. **No sensitivity-label coverage scanner** — readiness-engine doesn't enumerate Purview/MIP labels per file/site.
2. **No oversharing scanner** — no SharePoint/OneDrive "Anyone link" enumeration tied to Copilot-readable scope.
3. **No IPI (indirect prompt injection) scanner** — prompt-guard exists for live prompts but no batch-scan of file content for known IPI markers.
4. **No license efficiency dashboard** — usage data exists but no assigned-vs-active ROI math, no reclaim recommendations.

## Tasks (atomic commits)

### B1 — Sensitivity label coverage (3d)
- [ ] B1.1 `apps/api/src/lib/copilot/label-coverage.ts` — Graph calls: `/security/informationProtection/labels`, `/sites/{id}/drive/items` w/ `extractSensitivityLabels`
- [ ] B1.2 Aggregate per-site coverage % + per-user (top owners of unlabeled files)
- [ ] B1.3 Migration `0015_copilot_label_coverage.sql` — `copilot_label_coverage(id, tenant_id, scanned_at, total_files, labeled_files, by_label_json, top_unlabeled_owners_json)`
- [ ] B1.4 Route `POST /api/copilot/label-coverage/scan`, `GET /latest`
- [ ] B1.5 Unit tests for aggregation, edge cases (no labels configured at all)
- [ ] B1.6 UI tab `/security/copilot/labels` w/ coverage ring + drill-down

**Commit:** `feat(copilot): sensitivity label coverage scanner`

### B2 — Oversharing scanner (3d)
- [ ] B2.1 `apps/api/src/lib/copilot/oversharing-scanner.ts` — enumerate sharing links via `/sites/{id}/drives/{id}/items?$expand=permissions`
- [ ] B2.2 Risk classifier: link type (anonymous/org/specific) × sensitivity label × file recency
- [ ] B2.3 Migration `0016_copilot_oversharing.sql` — `copilot_oversharing_findings(id, tenant_id, site_id, file_id, file_path, link_type, risk_score, sensitivity_label, owner_upn, scanned_at)`
- [ ] B2.4 Route `POST /api/copilot/oversharing/scan`, `GET /findings?risk=high`
- [ ] B2.5 Unit tests for classifier
- [ ] B2.6 UI tab `/security/copilot/oversharing` — sortable findings table w/ remediation actions
- [ ] B2.7 Throttle: max 10k files/scan; pagination via `@odata.nextLink`

**Commit:** `feat(copilot): oversharing scanner with risk classification`

### B3 — IPI batch scanner (2d)
- [ ] B3.1 `apps/api/src/lib/copilot/ipi-patterns.ts` — known indirect-prompt-injection markers (ignore previous instructions, system-prompt-ish strings, hidden white-text)
- [ ] B3.2 `apps/api/src/lib/copilot/ipi-scanner.ts` — scan file contents (Word/PDF/text via Graph extract or manual) for patterns
- [ ] B3.3 Migration `0017_copilot_ipi_findings.sql` — `copilot_ipi_findings(id, tenant_id, file_id, pattern_id, snippet, severity, scanned_at)`
- [ ] B3.4 Route `POST /api/copilot/ipi/scan`, `GET /findings`
- [ ] B3.5 Unit tests with sample malicious + benign docs
- [ ] B3.6 UI tab `/security/copilot/ipi` — finding cards w/ snippet + suggested action

**Commit:** `feat(copilot): indirect prompt injection batch scanner`

### B4 — License efficiency dashboard (2d)
- [ ] B4.1 `apps/api/src/lib/copilot/license-efficiency.ts` — join assigned licenses (existing `licenses_cache`) w/ usage from `copilot-usage` 30-day rollup
- [ ] B4.2 Compute: assigned-not-active count, $/active-user, top reclaim candidates (assigned >30d, 0 prompts)
- [ ] B4.3 Route `GET /api/copilot/license-efficiency`
- [ ] B4.4 Unit tests for ROI math edge cases (zero assigned, partial month)
- [ ] B4.5 UI section in `/security/copilot/+page.svelte` — efficiency ring + reclaim list w/ one-click revoke
- [ ] B4.6 Wire reclaim action to existing license-revoke skill (verify it exists; if not, defer revoke action)

**Commit:** `feat(copilot): license efficiency dashboard with reclaim recommendations`

## Acceptance Gates

- [ ] Run all four scanners on real M365 tenant in <10min total
- [ ] Label coverage finds ≥5 unlabeled high-value files (CISO-readable summary)
- [ ] Oversharing surfaces ≥3 anonymous-link risks tied to confidential labels
- [ ] IPI scanner finds known-malicious test docs (seeded fixture) at 100%, 0 false positives on benign sample of 50
- [ ] License efficiency shows reclaim opportunity ≥1 user (or honest "0 found, here's why")
- [ ] PDF report extended w/ all 4 new sections, readable by non-technical CISO

## Risks / Unknowns

- **Graph API throttling** — file enumeration at 10k+ scale may hit 429s. Need exponential-backoff in scanners.
- **Copilot usage data delay** — Microsoft 365 reports API has 24-72h lag. License efficiency math must factor.
- **IPI false positives** — natural-language ML markers will misfire. Start w/ regex-only v1; ML in later phase.
- **Sensitivity label data plane access** — tenants without Purview E5 may not expose labels via Graph. Detect + show "upgrade prompt" instead of zero result.

## NOT In Scope

- Real-time IPI guard at prompt time (already exists at `copilot-prompt-guard.ts`)
- Auto-relabeling files (suggestion only — manual action by admin)
- Copilot-for-GitHub or Copilot-for-Sales-specific features (M365 Copilot only)
- Cross-tenant IPI signature sharing (privacy concerns, defer to Phase D-extension)

## Files Touched (Concrete)

```
NEW:
  packages/db/migrations/0015_copilot_label_coverage.sql
  packages/db/migrations/0016_copilot_oversharing.sql
  packages/db/migrations/0017_copilot_ipi_findings.sql
  apps/api/src/lib/copilot/label-coverage.ts
  apps/api/src/lib/copilot/oversharing-scanner.ts
  apps/api/src/lib/copilot/ipi-patterns.ts
  apps/api/src/lib/copilot/ipi-scanner.ts
  apps/api/src/lib/copilot/license-efficiency.ts
  apps/api/src/routes/copilot/labels.ts
  apps/api/src/routes/copilot/oversharing.ts
  apps/api/src/routes/copilot/ipi.ts
  apps/api/src/routes/copilot/license-efficiency.ts
  apps/web/src/routes/security/copilot/labels/+page.svelte
  apps/web/src/routes/security/copilot/oversharing/+page.svelte
  apps/web/src/routes/security/copilot/ipi/+page.svelte

MODIFIED:
  apps/api/src/routes/copilot-readiness-pdf.ts (extend report sections)
  apps/api/src/lib/copilot/readiness-report.ts (HTML template updates)
  apps/web/src/routes/security/copilot/+page.svelte (mount license-efficiency section)
```
