---
phase: 2
slug: frontend-completions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x (node env for API, jsdom for web) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run --reporter=dot` |
| **Full suite command** | `npm run test` (root — runs both workspaces) |
| **Estimated runtime** | ~12 seconds (quick) / ~45 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run --reporter=dot`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite green + coverage thresholds met
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| COP-03/04/05-api | 01 | 0 | COP-03, COP-04, COP-05 | unit (API) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ❌ Wave 0 | ⬜ pending |
| SNAP-03-metadata | 01 | 0 | SNAP-03 | unit (drift-detector) | `cd apps/api && npx vitest run src/lib/snapshots/drift-detector.test.ts` | ✅ exists | ⬜ pending |
| SNAP-01-widget | 01 | 0 | SNAP-01 | unit (component) | `cd apps/web && npx vitest run src/lib/components/dashboard/DriftSummaryWidget.test.ts` | ❌ Wave 0 | ⬜ pending |
| STOR-02/04-table | 01 | 0 | STOR-02, STOR-04 | unit (component) | `cd apps/web && npx vitest run src/lib/components/storage/ConsumersTable.test.ts` | ❌ Wave 0 | ⬜ pending |
| COP-01-trigger | 02 | 1 | COP-01 | unit (API route) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ✅ exists | ⬜ pending |
| COP-02-score | 02 | 1 | COP-02 | unit (readiness-engine) | `cd apps/api && npx vitest run src/lib/copilot/readiness-engine.test.ts` | ✅ exists | ⬜ pending |
| COP-06-pdf | 02 | 1 | COP-06 | unit (pdf route) | `cd apps/api && npx vitest run src/routes/copilot-readiness.test.ts` | ✅ exists | ⬜ pending |
| SNAP-02-diff | 03 | 1 | SNAP-02 | unit (diff lib) | `cd apps/api && npx vitest run src/lib/snapshots/diff.test.ts` | ✅ exists | ⬜ pending |
| STOR-01-onedrive | 03 | 1 | STOR-01 | unit (API route) | `cd apps/api && npx vitest run src/routes/storage-analytics.test.ts` | ✅ exists | ⬜ pending |
| STOR-03-sharepoint | 03 | 1 | STOR-03 | unit (API route) | `cd apps/api && npx vitest run src/routes/storage-analytics.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/routes/copilot-readiness.test.ts` — add test stubs for `/license-summary` endpoint (COP-03, COP-04, COP-05)
- [ ] `apps/api/src/lib/snapshots/drift-detector.test.ts` — update `metadata` assertion to include `snapshotId`/`baselineId` fields (SNAP-03)
- [ ] `apps/web/src/lib/components/dashboard/DriftSummaryWidget.test.ts` — new component test: renders count + severity, links to /backups/config (SNAP-01)
- [ ] `apps/web/src/lib/components/storage/ConsumersTable.test.ts` — new component test: top-20 cap + ≥90% quota badge (STOR-02, STOR-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF download renders correctly in browser | COP-06 | HTML-to-print, no headless browser in test env | Trigger assessment on /security/copilot, click Export PDF, verify opens print dialog with formatted report |
| Snapshot diff visual rendering | SNAP-02 | CSS diff colors (green/red/yellow) not testable in jsdom | Navigate to /backups/config/compare, compare two snapshots, verify add/remove/change rows render with correct colors |
| Storage sort/filter interaction | STOR-02 | Sort state UX requires real browser interaction | Navigate to /governance/storage, click each column header, verify sort order changes; use filter input, verify rows filter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
