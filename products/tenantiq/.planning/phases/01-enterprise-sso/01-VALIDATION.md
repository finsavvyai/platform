---
phase: 1
slug: enterprise-sso
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x with `environment: 'node'` |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run src/routes/sso-login.test.ts src/routes/sso-callback.test.ts src/routes/sso-jit.test.ts src/cron/sso-cert-monitor.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run --coverage` |
| **Estimated runtime** | ~8 seconds (quick) / ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command above (~8s)
- **After every plan wave:** Run full suite — 90% line / 85% branch thresholds must pass
- **Before `/gsd:verify-work`:** Full suite green + coverage thresholds met
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| SSO-01/02 | 01 | 0 | SSO-01, SSO-02 | unit | `npx vitest run src/routes/sso.test.ts` | ✅ exists | ⬜ pending |
| SSO-03-login | 02 | 1 | SSO-03 | unit | `npx vitest run src/routes/sso-login.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-03-callback-oidc | 02 | 1 | SSO-03 | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-03-callback-saml | 02 | 1 | SSO-03 | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-04-jit | 03 | 1 | SSO-04 | unit | `npx vitest run src/routes/sso-jit.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-04-concurrent | 03 | 1 | SSO-04 | unit (concurrent) | `npx vitest run src/routes/sso-jit.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-05-cert-monitor | 04 | 2 | SSO-05 | unit | `npx vitest run src/cron/sso-cert-monitor.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-05-skip-empty | 04 | 2 | SSO-05 | unit | `npx vitest run src/cron/sso-cert-monitor.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-06-missing-state | 02 | 1 | SSO-06 | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-06-replayed-state | 02 | 1 | SSO-06 | unit | `npx vitest run src/routes/sso-callback.test.ts` | ❌ Wave 0 | ⬜ pending |
| SSO-06-nonce-ttl | 02 | 1 | SSO-06 | unit (KV.put spy) | `npx vitest run src/routes/sso-login.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/routes/sso-login.test.ts` — covers SSO-03 login initiation + SSO-06 nonce TTL
- [ ] `apps/api/src/routes/sso-callback.test.ts` — covers SSO-03 callback (OIDC + SAML), SSO-06 state validation, SSO-04 JIT trigger
- [ ] `apps/api/src/routes/sso-jit.test.ts` — covers SSO-04 JIT upsert + concurrent race scenario
- [ ] `apps/api/src/cron/sso-cert-monitor.test.ts` — covers SSO-05 alert thresholds (60/30/7 days) + skip-empty

*Framework install: none needed — Vitest already configured in `apps/api/vitest.config.ts`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SAML SSO end-to-end with real Okta | SSO-03 | Requires live WorkOS + Okta test org | Configure WorkOS sandbox, create Okta SAML app, trigger login flow from Settings UI |
| Settings UI SSO tab renders correctly | SSO-01, SSO-02 | Frontend component; Playwright E2E deferred to Phase 4 | Navigate to /settings, verify SSO tab present, fill SAML/OIDC form, confirm success toast |
| Cert expiry email received by org admin | SSO-05 | Requires production email delivery (Resend) | Set cert `valid_until` to 3 days ahead in test DB, trigger cron, verify notification created in DB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
