---
phase: 3
slug: storage-scanner-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run --coverage` |
| **Estimated runtime** | ~3 seconds (quick) / ~15 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts`
- **After every plan wave:** Run `cd apps/api && npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite green + coverage thresholds met
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| STOR-05-stubs | 03-01 | 0 | STOR-05 | unit (TDD stubs, RED) | `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts` | ✅ exists (add new cases) | ⬜ pending |
| STOR-05-impl | 03-02 | 1 | STOR-05 | unit (GREEN) | `cd apps/api && npx vitest run src/lib/storage/storage-scanner.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Add new failing test cases to existing `apps/api/src/lib/storage/storage-scanner.test.ts`:

- [ ] `'processes 15 users across two chunks of 10'` — verifies chunked batching (STOR-05)
- [ ] `'skips rejected drive fetches without aborting sibling users in chunk'` — verifies Promise.allSettled resilience (STOR-05)
- [ ] `'removes hard-cap — returns all users when list has 150 entries'` — verifies no silent truncation (STOR-05)
- [ ] `'processes 15 SharePoint sites across two chunks of 10'` — verifies SharePoint parallel batch (STOR-05)

*Existing file exists — new `describe` blocks are additive, no rewrite needed*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scan completes in < 30s for a live 100+ user tenant | STOR-05 | Requires real Graph API + production tenant | Trigger storage scan for a tenant with 100+ users via `/governance/storage`, monitor completion without timeout error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
