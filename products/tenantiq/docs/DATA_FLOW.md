# Data Flow Diagram

> Required by M365 Cert. Maps every category of customer data through the system.

Last updated: 2026-04-29

## Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER (MSP)                             │
│                                                                         │
│   Browser (app.tenantiq.app)                                            │
└───────────┬─────────────────────────────────────────────────────────────┘
            │ TLS 1.3
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cloudflare Pages (web)                            │
│                       SvelteKit static + SSR                            │
└───────────┬─────────────────────────────────────────────────────────────┘
            │ same-site cookie + Bearer
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Cloudflare Workers — tenantiq-api                      │
│                         api.tenantiq.app                                │
│                                                                         │
│  ┌──────────────┬──────────────┬──────────────┬──────────────────┐      │
│  │ auth/*       │ tenants/*    │ cis/*        │ webhooks/*       │      │
│  │ JWT issue    │ Graph fetch  │ control eval │ HMAC verify      │      │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────────┘      │
└─────────┼──────────────┼──────────────┼──────────────┼──────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
    ┌─────────┐   ┌──────────────┐  ┌────────┐  ┌─────────────┐
    │   D1    │   │  Microsoft   │  │   KV   │  │   R2        │
    │ tables  │   │    Graph     │  │ tokens │  │ exports     │
    └─────────┘   └──────────────┘  └────────┘  └─────────────┘
          │
          ▼
   ┌──────────────────────────────────────────┐
   │ External: Anthropic, Resend, Twilio,     │
   │ LemonSqueezy, Sentry (per-feature gated) │
   └──────────────────────────────────────────┘
```

## Data categories & lifecycle

### DC1 — Authentication identifiers

| Field | Source | Storage | Retention | Encryption |
|---|---|---|---|---|
| `azure_oid` | Microsoft id_token | D1 `platform_users` | account lifetime | TLS in transit, native at rest |
| `email` | Microsoft id_token | D1 `platform_users` | account lifetime | same |
| `name` | Microsoft id_token | D1 `platform_users` | account lifetime | same |
| Session JWT | issued by us | HttpOnly cookie + KV | 24h | TLS, KV native |

### DC2 — Graph access tokens

| Field | Source | Storage | Retention | Encryption |
|---|---|---|---|---|
| `access_token` | Microsoft `/token` endpoint | KV `graph:{tid}:access_token` | TTL = `expires_in` (≤1h) | KV native |
| `refresh_token` | Microsoft `/token` endpoint | KV `graph:{tid}:refresh_token_v2` | until revoked | **AES-256-GCM** application-layer (`GRAPH_TOKEN_KEK`) |

### DC3 — Tenant configuration cache

| Field | Source | Storage | Retention | Encryption |
|---|---|---|---|---|
| Users / licenses | Graph `/users`, `/subscribedSkus` | D1 `users_cache`, `licenses` | refreshed hourly, purged with tenant | TLS, native |
| CIS scan results | Graph (multiple) + evaluator | D1 `cis_scans`, `control_results` | 1 year | same |
| Config snapshots | Graph (policies, settings) | R2 + D1 metadata | 90 days (configurable) | R2 native |
| Audit log | every mutating endpoint | D1 `audit_log` | 1 year | native |

### DC4 — Telemetry / errors

| Field | Source | Storage | Retention | Encryption |
|---|---|---|---|---|
| Error context | `Sentry.captureException` | Sentry SaaS (US) | 90 days | TLS, vendor managed |
| Request metadata | Cloudflare Analytics | CF Analytics | 30 days | vendor managed |
| Audit events | `writeAuditLog` | D1 `audit_log` | 1 year | native |

## PII inventory

| Item | Classification | Justification | Where |
|---|---|---|---|
| Customer admin email | PII (low) | login + notification | D1 |
| Customer admin name | PII (low) | UI display | D1 |
| Customer admin Azure OID | pseudonymous identifier | auth correlation | D1 + KV |
| End-user emails (cached from tenant) | PII — **customer's data** | feature: user lifecycle, alerts | D1 `users_cache` |
| End-user display names | PII — customer's data | same | D1 |

**No** payment cards, SSNs, health data, or financial account numbers stored. Payment is handled by LemonSqueezy (PCI-DSS scope offloaded).

## Cross-border transfers

| From | To | Mechanism |
|---|---|---|
| Cloudflare global edge | Microsoft Graph (varies by tenant region) | TLS, customer-controlled tenant region |
| Worker | Anthropic (US) | TLS, DPA in place |
| Worker | Resend (US) | TLS, DPA |
| Worker | Twilio (US) | TLS, DPA |
| Worker | LemonSqueezy (US/EU) | TLS, DPA |
| Worker | Sentry (US) | TLS, DPA, scrubber for PII |

EU customers: Standard Contractual Clauses incorporated by reference in `docs/DPA.md`.

## Data deletion path

See `docs/DATA_DELETION.md`. Summary: customer triggers `DELETE /api/account` → cascade across D1 (org-scoped), KV (token + session keys), R2 (org-prefixed objects). 30-day soft-delete window then hard wipe.
