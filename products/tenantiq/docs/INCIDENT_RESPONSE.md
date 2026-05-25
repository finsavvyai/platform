# Incident Response Plan

> Required by M365 Cert (control B6).
> Owner: Security on-call. Last updated: 2026-04-29. Review: quarterly.

## Severity matrix

| Sev | Definition | Response time | Comms cadence |
|---|---|---|---|
| **SEV-1** | Confirmed data breach OR full outage OR auth bypass | within **15 min** detect→respond | every 30 min until contained |
| **SEV-2** | Single-tenant data exposure OR partial outage OR exploited vuln | within **1 hour** | every 2 hours |
| **SEV-3** | Degraded perf OR potential vuln (not yet exploited) OR sub-processor outage | within **4 hours** | daily until resolved |
| **SEV-4** | Bug, no security impact | next business day | as needed |

## Roles

| Role | Person | Backup |
|---|---|---|
| Incident Commander | founder | senior eng |
| Comms Lead | founder | marketing |
| Tech Lead | senior eng | founder |
| Customer Lead | success/support | founder |

> **Action item:** publish names + on-call contacts to private runbook, not this file (this file is auditor-readable).

## Detection sources

- Sentry alerts (`SENTRY_DSN` configured)
- Cloudflare Analytics anomaly detection
- LemonSqueezy webhook signature failures
- Customer reports (security@tenantiq.app)
- Vulnerability disclosure (`.well-known/security.txt`)
- Sub-processor breach notifications (Microsoft, Anthropic, Resend, Twilio, LemonSqueezy, Cloudflare)

## Response phases

### 1. Detect & triage (≤15 min for SEV-1)

- IC declares severity
- War room channel opened
- Customer-facing status page set to "Investigating" if user-visible

### 2. Contain

Common containment actions:

- **Auth bypass / token leak**: rotate `JWT_SECRET`, force-invalidate sessions via KV wipe (`session:*`), require re-login.
- **Graph token leak**: rotate `GRAPH_TOKEN_KEK`, invalidate stored refresh tokens, force re-consent.
- **Sub-processor compromise**: revoke API key, switch to backup or disable feature flag.
- **Code injection**: roll back via `wrangler rollback`, deploy patch.
- **Data exfiltration**: block source IP at Cloudflare, capture forensic snapshot.

### 3. Eradicate & recover

- Apply patch + verify with regression tests
- Run targeted SAST/DAST on affected component
- Re-enable affected features

### 4. Post-incident review (within 5 business days)

- Timeline reconstruction from audit log + Sentry + Cloudflare logs
- Root cause analysis (5-whys)
- Action items with owners + dates
- Update threat model if new vector identified

## Customer notification

| Trigger | Notification | Within |
|---|---|---|
| Confirmed PII / Graph data breach affecting tenant | direct email to admin + DPA-required | **72 hours** (GDPR) |
| Sub-processor breach affecting tenant | direct email | 72 hours |
| Service-impacting outage SEV-1/2 | status page + email if >1h | 1 hour |

Notification template lives in private runbook; auditor sees redacted version on request.

## Regulator notification

| Regulator | When | How |
|---|---|---|
| GDPR supervisory authority | confirmed PII breach with risk to subjects | within 72h, OneTrust or direct submission |
| US state attorneys-general | per state breach laws | per state |
| Microsoft (M365 Cert obligation) | any breach affecting Graph data | via Partner Center incident report |

## Evidence preservation

- Cloudflare logs: 30 days retention, export to R2 on incident
- D1 audit log: 1 year (already)
- Sentry events: 90 days, export on incident
- Worker version history: `wrangler deployments list`

## Tabletop exercise

- Run **quarterly**. Scenarios rotate:
  - Q1: leaked refresh token in KV
  - Q2: malicious sub-processor
  - Q3: auth bypass via JWT alg confusion
  - Q4: D1 cross-tenant query bug

Each tabletop produces an action-item list. Open items tracked in `.luna/security-actions.md`.

## Sub-processor breach contacts

| Vendor | Contact | DPA reference |
|---|---|---|
| Cloudflare | https://www.cloudflare.com/trust-hub/abuse/ | DPA §X |
| Microsoft | Partner Center incident form | MSPA |
| Anthropic | trust@anthropic.com | DPA |
| Resend | security@resend.com | DPA |
| Twilio | security@twilio.com | DPA |
| LemonSqueezy | security@lemonsqueezy.com | DPA |
| Sentry | security@sentry.io | DPA |
