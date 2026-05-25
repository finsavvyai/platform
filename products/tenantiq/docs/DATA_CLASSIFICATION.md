# Data Classification Scheme

> M365 Cert C5. Defines how every data category is labeled, stored, and protected.

Last reviewed: 2026-04-29. Cross-references: `DATA_FLOW.md`, `DATA_RETENTION.md`, `DATA_DELETION.md`.

## Tier definitions

| Tier | Definition | Example |
|---|---|---|
| **Public** | OK to share publicly. No confidentiality requirement. | marketing pages, blog posts, OSS code |
| **Internal** | Non-public but low risk if leaked. | error metrics, performance counters, anonymized usage stats |
| **Confidential** | Customer-related; contractual obligation to protect. | tenant configuration, sync metadata, audit logs |
| **Restricted** | High-impact secrets or PII. Breach is reportable. | OAuth refresh tokens, JWT signing keys, customer admin email, Graph access tokens, API keys, payment data |

## Default handling per tier

| Tier | Encryption at rest | Encryption in transit | Access control | Backup | Logging on access |
|---|---|---|---|---|---|
| Public | not required | not required | none | not required | none |
| Internal | platform default | TLS 1.2+ | authenticated | platform default | sampled |
| Confidential | platform default (Cloudflare native) | TLS 1.3 | authenticated + tenant-scoped | nightly | full audit |
| Restricted | platform native + **app-layer AES-GCM** | TLS 1.3 | authenticated + tenant-scoped + role-restricted | nightly + extra retention | full audit + alert on read |

## Data inventory mapped to tiers

### D1 tables

| Table | Tier | Rationale |
|---|---|---|
| `organizations`, `tenants` | Confidential | tenant identity + Azure tenant ID |
| `platform_users` | Restricted | email + Azure OID = PII |
| `users_cache`, `licenses_cache`, `user_licenses` | Confidential | customer's own user PII — protect, but no app-layer crypto needed (D1 native encryption) |
| `audit_logs`, `tenant_audit_log` | Restricted | per-actor activity — disclosure is reportable |
| `cis_scans`, `control_results` | Confidential | tenant security posture |
| `alerts`, `security_alerts` | Confidential | customer signals |
| `config_snapshots`, `config_drifts` | Confidential | tenant config (some PII implicit in groups/users) |
| `workflows`, `workflow_runs`, `remediation_log` | Confidential | tenant action traces |
| `sso_connections` | Restricted | tenant IdP config including private cert metadata |
| `webhook_configs` | Restricted | contains shared secrets |
| `sync_jobs`, `backup_jobs`, `storage_analytics` | Internal | system telemetry per tenant |
| `tokenforge_*` | Restricted | device-binding signals (hardware fingerprints) |
| `partner_integrations`, `integrations` | Restricted | API keys (config_encrypted) |

### KV keys

| Key prefix | Tier | Notes |
|---|---|---|
| `graph:{tid}:access_token` | Restricted | Cloudflare-native encryption only — short-lived (1h) |
| `graph:{tid}:refresh_token_v2` | Restricted | **app-layer AES-GCM** via `GRAPH_TOKEN_KEK`, see `graph-token-store.ts` |
| `session:{oid}` | Restricted | session JWT — Cloudflare-native; mitigated by 24h TTL |
| `auth:state:*` | Internal | OAuth state nonce, 5-min TTL |
| `consent:{tid}` | Confidential | tenant-consent flag |
| `score:*`, `snapshot:*`, `drift:*` | Confidential | computed analytics caches |
| `ls-webhook-seen:*` | Internal | idempotency hashes |

### R2 prefixes

| Prefix | Tier |
|---|---|
| `exports/{org}/` | Confidential |
| `snapshots/{org}/` | Confidential |
| `reports/{org}/` | Confidential |
| `backups/d1/` | Restricted (full DB dump) |

### In-flight only

| Item | Tier |
|---|---|
| Graph response bodies | Confidential while in worker memory; never persisted in raw form |
| Anthropic prompts | Confidential — scrubbed before send (`docs/SENTRY_SCRUBBING.md` PII rules also apply to AI prompts — gap: formal scrubber helper TODO) |
| Sentry events | Internal (scrubbed per `docs/SENTRY_SCRUBBING.md`) |

## Handling rules

### Restricted tier — additional rules

- **No logging** of raw value to console or audit log.
- **App-layer encryption** when persisted (Graph refresh tokens).
- **Alert on read** in audit log for human-initiated access.
- **Quarterly review** of who/what has access path.
- **Hard rotation** within 90 days or on any incident.

### Confidential tier — rules

- All queries must be tenant-scoped (`WHERE org_id`/`tenant_id`).
- Lints/CI checks: not yet automated — open item.
- Backups encrypted at rest by Cloudflare native.

## Reviewer checklist (PR-time)

For every new field/table/key added:

- [ ] Tier assigned
- [ ] Storage decision matches tier (table above)
- [ ] If Restricted: app-layer encryption present + audit log entry on access
- [ ] Retention defined in `DATA_RETENTION.md`
- [ ] Deletion path covered in `DATA_DELETION.md` cascade

Add the tier label as a comment near the schema definition.
