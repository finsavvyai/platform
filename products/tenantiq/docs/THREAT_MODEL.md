# Threat Model — STRIDE

> Required by M365 Cert. STRIDE per trust boundary.
> Last updated: 2026-04-29 — review every 6 months or after major arch change.

## Trust boundaries

```
[Browser] ──TLS──▶ [Cloudflare Edge] ──▶ [Workers Runtime]
                                              │
                                ┌─────────────┼──────────────┐
                                ▼             ▼              ▼
                              [D1]          [KV]           [R2]
                                              │
                                              ▼
                                       [Microsoft Graph]
```

Trust boundaries:

- **TB1**: Browser ↔ Edge (TLS 1.3, HSTS preload)
- **TB2**: Edge ↔ Worker (Cloudflare-internal, mTLS-equivalent)
- **TB3**: Worker ↔ D1/KV/R2 (Cloudflare-internal API tokens)
- **TB4**: Worker ↔ Microsoft Graph (delegated OAuth bearer)
- **TB5**: Worker ↔ third parties (Anthropic, Resend, Twilio, LemonSqueezy, Sentry)

## Asset inventory

| Asset | Sensitivity | Storage |
|---|---|---|
| Customer Graph refresh tokens | Critical | KV (AES-GCM via `GRAPH_TOKEN_KEK`) |
| Customer JWT session | High | HttpOnly cookie + KV |
| Tenant configuration cache | High | D1 |
| User PII (email, name, oid) | Medium | D1 `platform_users` |
| Audit logs | High | D1 `audit_log` |
| Snapshot exports | Medium | R2 (per-org prefix) |
| LemonSqueezy webhook secret | Critical | secret |
| AZURE_CLIENT_SECRET | Critical | secret |

## STRIDE per boundary

### TB1 — Browser ↔ Edge

| Threat | Vector | Mitigation | Status |
|---|---|---|---|
| **S**poof | Phishing site capturing OAuth code | exact `redirect_uri` match in Azure App Reg, state+nonce CSRF | ✅ |
| **T**amper | MITM token theft | TLS 1.3 + HSTS `max-age=31536000` | ✅ |
| **R**epudiate | User denies action | audit log per mutating endpoint | ✅ |
| **I**nfo disclose | XSS exfiltrating session | `HttpOnly` cookie, CSP `default-src 'self'`, `X-Frame-Options DENY` | ✅ |
| **D**oS | Credential stuffing /login | rate limit 5/60s on `/auth/*` | ✅ |
| **E**oP | CSRF on state-changing endpoint | `SameSite=Lax`, double-submit on critical mutations | ⚠ partial — non-OAuth mutations rely on cookie SameSite |

### TB3 — Worker ↔ D1/KV/R2

| Threat | Vector | Mitigation | Status |
|---|---|---|---|
| S | Worker code injection writes wrong org | every query `WHERE org_id = ?`; lint rule | ✅ |
| T | Tenant A reads tenant B | row-scoped queries + `requireTenant` middleware | ✅ |
| I | Refresh tokens leak from KV | AES-GCM at rest with `GRAPH_TOKEN_KEK` | ✅ |
| E | Privilege escalation via JWT forge | RS256 (preferred) or HS256 with rotation | ⚠ partial — RS256 not deployed yet |

### TB4 — Worker ↔ Microsoft Graph

| Threat | Vector | Mitigation | Status |
|---|---|---|---|
| S | Stolen access token used elsewhere | bound to tenant via `oid` claim, server-side rotation | ✅ |
| I | Over-fetching user data | least-privilege scopes (E2); justify per scope | ⚠ — see `docs/GRAPH_PERMISSIONS.md` |
| D | Graph throttling cascades | exponential backoff in `graph-client.ts` | ⚠ partial — verify all callers |
| E | Token replay across tenants | per-tenant refresh tokens in KV by azure_tenant_id | ✅ |

### TB5 — Worker ↔ third parties

| Threat | Vector | Mitigation | Status |
|---|---|---|---|
| S | Webhook spoofing (LemonSqueezy, TokenForge) | HMAC-SHA256 signature verification | ✅ |
| T | Webhook replay | timestamp ±5min (TokenForge `X-TF-Timestamp`, OpenClaw `payload.timestamp`); idempotency via KV digest 7d (LemonSqueezy — no timestamp in vendor spec) | ✅ |
| I | Anthropic prompt leakage | tenant data scrubbed before LLM call where possible | ⚠ partial — formal review pending |
| R | Sentry capturing PII | `beforeSend` strips tokens; review needed | ⚠ partial |

## High-priority remediations

1. **Enforce CSRF tokens on non-OAuth mutations** — TB1 EoP partial.
2. **Deploy RS256 keys** — TB3 EoP partial. Path exists in `jwt-keys.ts`; just ship `RS256_PRIVATE_KEY`/`RS256_PUBLIC_KEY` secrets.
3. **Webhook replay window enforcement** — TB5 T partial. Add `±5m` timestamp gate uniformly.
4. **Sentry PII scrubber audit** — TB5 R partial. Document `beforeSend` rules.
5. **Graph scope justification doc** — TB4 I. See `docs/GRAPH_PERMISSIONS.md`.
6. **Anthropic prompt PII review** — TB5 I. Document scrubbing pre-LLM.

## Review schedule

- 6-monthly: re-walk every boundary.
- After: any new sub-processor, new scope, new auth flow, or auditor finding.
