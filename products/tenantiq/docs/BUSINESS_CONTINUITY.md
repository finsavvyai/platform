# Business Continuity Plan

> M365 Cert B7. Pairs with `docs/DR_RUNBOOK.md` (technical recovery) and
> `docs/INCIDENT_RESPONSE.md` (incident comms).

Last reviewed: 2026-04-29. Owner: founder.

## Scope

What keeps the business running when a critical sub-processor or single founder/operator is unavailable.

## Critical paths

| Path | Required for | Fallback |
|---|---|---|
| Customer sign-in | every interaction | sessions cached 24h via JWT cookie + KV; Graph refresh tokens cached for ~90 days |
| CIS scan | core feature | cached last-scan results in D1; new scans queued |
| Alerts dispatch | customer trust | DB-persisted; redelivery queue retries 24h |
| Billing | recurring revenue | LemonSqueezy is the source of truth — we re-sync on next webhook |

## Sub-processor scenarios

### Cloudflare extended outage (>4h)

- **Impact**: full platform offline; data inaccessible.
- **Plan**: status page hosted on a 2nd registrar (Vercel `status.tenantiq.app` — TODO). Comms via email through Resend (separate provider).
- **Recovery**: Cloudflare 99.99% historical SLA — accept dependency.
- **Contractual**: SLA credits via standard Cloudflare commercial agreement.

### Microsoft Graph extended outage (>4h)

- **Impact**: sync stale; scans fail; new tenant onboarding blocked.
- **Plan**: serve cached scan + alert data; banner "Microsoft Graph degraded".
- **Customer-facing**: incident notice within 1h, hourly updates.

### Anthropic outage

- **Impact**: AI recommendations degraded.
- **Plan**: feature flag `AI_FALLBACK_MODE` returns last-known recommendations; UI shows "AI recommendations temporarily paused".
- **Action item**: implement provider-failover (already exists in `ai-providers-dispatch.ts` for Anthropic↔Gemini↔DeepSeek).

### Single-founder unavailability (illness, leave)

- **Impact**: incident response slowed; deploys blocked; customer support delayed.
- **Plan**:
  - **2nd founder/eng has**: GitHub admin, Cloudflare admin, LemonSqueezy admin, domain registrar admin, secrets vault access via 1Password Family Plan shared vault.
  - **Customer support**: Resend forwards `support@` to a shared inbox accessible to 2nd founder.
  - **Incident response**: documented in `INCIDENT_RESPONSE.md`. Backup IC named.
  - **External lawyer + accountant**: contracted retainer for emergencies.

### Solo-founder catastrophic event

- **Plan**: legacy contact at lawyer holds sealed instructions to:
  1. Notify customers + initiate orderly wind-down per `docs/DPA.md` Art. 8.
  2. Trigger account-purge cron preserving only audit data per regulator hold.
  3. Refund pro-rata via LemonSqueezy.
  4. Hand company to nominated executor.

## Operational redundancies

| Resource | Primary | Backup |
|---|---|---|
| Domain registrar | Cloudflare Registrar | Porkbun (secondary) |
| DNS | Cloudflare | export of zone file in 1Password |
| Source code | GitHub | mirrored to GitLab weekly (planned) |
| Secrets | Cloudflare Workers Secrets | sealed copy in 1Password vault, rotated when changed |
| Customer billing | LemonSqueezy | data exportable via their API to JSON |
| Email | Resend | secondary domain pointed to fallback transactional provider on contract |

## RTO/RPO summary (combined view)

| Tier | RTO | RPO |
|---|---|---|
| API surface (worker) | 30 min (rollback) | 0 (stateless) |
| D1 (tenant data) | 4 h | 24 h |
| KV (sessions/tokens) | 1 h re-auth window | 0 — recoverable from JWT or Microsoft refresh |
| R2 (exports) | best-effort, no SLA today | up to 24 h |
| Sub-processor (each) | varies — see scenarios | varies |

## Drill schedule

- **Quarterly tabletop**: see `DR_RUNBOOK.md`.
- **Annual full-review**: re-walk every scenario above; update vendors / contacts; verify backup restore actually works.

## Open gaps (tracked)

1. Cross-region R2 replication.
2. KV nightly snapshot to R2.
3. Status page on a separate provider.
4. GitLab repo mirror.
5. Documented backup IC name in private runbook.
