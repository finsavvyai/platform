<!-- cspell:words tenantiq opensyber tokenforge openclaw Syber Tenantiq TOKENFORGE Opensyber Drizzle drizzle webauthn webhooks -->

# No-Bluf Report — tenantiq

Date: 2026-05-02 (supersedes 2026-05-01 prior scan)
Scope: last 10 commits + changed `docs/**.md`
Mode: interactive (report-only — history immutable)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 0 |
| Low      | 0 |

1 unverified claim. Located in immutable commit history — cannot
edit without force-push (disallowed by rules). Documenting only.

---

## Findings

### B1 (High) — Phantom script count in commit `2be930c`

**Where:** commit `2be930c` body, "Six scripts + three GH workflows that
turn the manual cert-prep work into a continuous pipeline."

**Reality:** `git show --stat 2be930c` shows **4** scripts added:

```
scripts/cert-evidence-bundle.ts          | 105 ++++
scripts/check-cert-drift.ts              | 118 ++++
scripts/gen-architecture-diagram.ts      | 120 ++++
scripts/gen-cover-letter.ts              |  73 +++
```

3 workflows correct (`auto-bump-dates.yml`, `cert-renewal-prep.yml`,
`cert-status.yml`).

**Type:** numeric overcount.

**Fix:** none — commit published. History preservation rule blocks
rewrite. No downstream doc references the wrong number, so no doc
fix needed either.

---

## Verified Claims

All checked against current source:

- `JWT_ISSUER`/`JWT_AUDIENCE` constants — `apps/api/src/routes/auth-session.ts:12-13`
- `revokeJti()` exported + used — `auth-session.ts:96`, `auth.ts:236`
- 16-byte JTI via `crypto.getRandomValues` — `auth-session.ts:20`
- WS `scope==='ws'` assertion — `websocket.ts:28`
- `auth-session-revocation.test.ts` — 5 `it()` blocks (matches "5/5")
- 33-table cascade: 21 tenant_id + 6 org_id + 2 organization_id + 3 FK + 1 root —
  `account-deletion.ts` arrays match (consistent with obs 2595, 2026-05-02)
- `account-deletion.test.ts` — 3 `it()` blocks (matches "3/3")
- `POST /api/platform/organizations/:id/grant-tier` mounted at `platform/index.ts:32`
- `orgs-grant-tier.test.ts` — 5 `it()` blocks (matches "5/5")
- 402 status on missing variant via `BILLING_REQUIRED → 402` mapping
- `/pricing` page + `PUBLIC_ROUTES` entry in `+layout.svelte:39`
- 3 GH workflows present: `cert-status.yml`, `cert-renewal-prep.yml`, `auto-bump-dates.yml`
- 12 live smoke = 8 (`cert-prep-smoke.spec.ts`) + 4 (`cert-prep-signed-in.spec.ts`)
- 8/8 billing matrix = 4 plans × 2 cycles loop in `billing-checkout.spec.ts`
- Referenced docs all present: `SECURITY_AUDIT_2026-05-01.md`, `MS_CERTIFICATION.md`,
  `PARTNER_CENTER_SUBMISSION.md`, `DATA_DELETION.md`, `DATA_CLASSIFICATION.md`,
  `COVER_LETTER.md`, `ARCHITECTURE_DIAGRAM.md`

---

## Loop Status

- 0 Critical, 1 High (immutable history) — terminate
- Working tree clean
- No new bluffs vs prior 2026-05-01 scan in source/docs

## Prior Scan (2026-05-01) — closed

Earlier round caught 4 High bluffs (B1–B4):
- B1/B2: "31 audit-logger call sites" → fixed in commit `e9c8e2f`
- B3: "33 cascade tables" claim vs 30 actual → 3 missing tables added
  (`tf_opensyber_integrations`, `integration_mappings`, `partner_integrations`)
  in `e9c8e2f`; doc + code now match
- B4: GDPR Art. 17 / M365 Cert C7 erasure incomplete → fixed same commit

All four prior findings verified closed in current scan.
