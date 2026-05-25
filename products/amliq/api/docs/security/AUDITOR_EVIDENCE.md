# Auditor evidence index — AMLIQ / Aegis

Last updated: 2026-04-29.
Owner: engineering. Linked from `docs/compliance/soc2_readiness.md`.

This file is the entry point an external auditor (SOC 2 Type 1, ISO
27001 stage 1, FCA / EU AMLA / FinCEN MSB) will reach for first. Each
row maps a control claim to a verifiable artefact in this repository
or the running deployment. No-bluf rule: every link must produce real
output when the auditor runs the command listed.

## 1. Vulnerability management

| Control | Evidence | How to verify |
|---|---|---|
| Dependency CVE scan | `docs/security/govulncheck-2026-04-29.txt` | `govulncheck ./...` returns "No vulnerabilities found." |
| Patch cadence | `git log --grep="fix(security)"` | Recent: `b81d09c` (pgx v5.5.0 → v5.9.2 patches GO-2024-2098 + GO-2024-2567) |

## 2. Free-tier and quota enforcement

| Control | Evidence | How to verify |
|---|---|---|
| Daily cap per tenant when no subscription | `internal/billing/free_tier_enforcer.go`, `api/middleware_usage.go` | Run `go test ./api/ -run TestFreeTierBlocksAt11thRequest -v` — 11th request returns 402 `FREE_TIER_EXHAUSTED` |
| Persisted across restarts | `internal/billing/free_tier_enforcer.go` uses `UsageRepository` (DB-backed) | Counter survives process restart unlike the in-memory tracker fallback |
| Coverage of billable routes | `api/router.go`, `api/router_compliance.go`, `api/router_compliance_ext.go`, `api/router_txn_monitor.go` | `grep -n usageCheck api/router*.go` — 11 gated handlers |

## 3. Multi-tenant isolation

| Control | Evidence | How to verify |
|---|---|---|
| Tenant scoping on every screen | per-handler `ClaimsFromContext` enforces `claims.TenantID` | `grep -rn "ClaimsFromContext" api/handler_screen*.go` |
| GDPR Art. 17 erasure scoped to caller's tenant | `internal/gdpr/erasure.go` rejects empty `tenant_id`, all SQL filters by `tenant_id = $1` | `go test ./internal/gdpr/ -run Erase` |
| Row-level filter via `deleted_at IS NULL` partial index | `migrations/`, see prior memory note | `psql ... \d entities` shows partial index |

## 4. Audit trail

| Control | Evidence | How to verify |
|---|---|---|
| Append-only audit table (real DB triggers) | `migrations/069_audit_immutability.up.sql` installs `audit_entries_immutable` and `audit_events_immutable` triggers that raise on UPDATE/DELETE. Sanctioned retention purges require `SET aegis.allow_audit_purge=on` in the same session. | `psql -c "\\d audit_entries"` shows the trigger, and `DELETE FROM audit_entries LIMIT 1` raises `feature_not_supported` |
| List-sync observability | `migrations/065_list_sync_audit.up.sql`, `internal/storage/pgx/list_sync_audit_repo.go` | Per-sync row with status / duration / fetch_strategy / error |
| GDPR erasure logged | `internal/gdpr/erasure.go:logErasure` writes `gdpr_erasure` action with redacted counts | Auditor sample query: `SELECT action, details FROM audit_entries WHERE action='gdpr_erasure'` |

## 5. Privacy / GDPR

| Control | Evidence | How to verify |
|---|---|---|
| Sub-processor directory published | `GET /api/v1/privacy/subprocessors` (no auth) | `curl http://host/api/v1/privacy/subprocessors` returns JSON |
| Data subject erasure endpoint | `POST /api/v1/privacy/erase`, admin-only, tenant-scoped | `api/handler_privacy.go` |
| Retention policy | `internal/gdpr/retention.go` — screening 90d, alerts 365d, audit 7y | `go test ./internal/gdpr/ -run Retention` |

## 6. Health and availability

| Control | Evidence | How to verify |
|---|---|---|
| Liveness probe | `GET /health` | `curl http://host/health` |
| Readiness probe (DB ping) | `GET /ready` | `curl http://host/ready` |
| Per-subsystem report | `GET /health/full` (DB + list-sync staleness) | Returns 503 when any subsystem is stale or failing |
| Latency dashboard | `GET /status` (HTML) + `GET /health/latency` (JSON) | Public, polled every 5s |

## 7. Disaster recovery

| Control | Evidence | How to verify |
|---|---|---|
| Backup procedure | `scripts/backup.sh` (pg_dump + gzip + sha256) | `DB_URL=... ./scripts/backup.sh` writes `aegis-<ts>.sql.gz` + checksum |
| Restore procedure | `scripts/restore.sh` (refuses non-test DB names) | `DB_URL=...test BACKUP_FILE=... ./scripts/restore.sh` |
| RTO / RPO | RTO 4h, RPO 24h (daily backup) | Documented in `scripts/backup.sh` header |

## 8. Cryptography and data sources

| Control | Evidence | How to verify |
|---|---|---|
| Real source URLs (no placeholders) | `internal/ingestion/crypto_wallets.go` (15 OFAC chains, live-verified) + `crypto_sdn_csv.go` + `crypto_ransomwhere.go` | `go test ./internal/ingestion/ -run "Crypto|SDN|Ransom"` |
| Multi-language transliteration | `internal/screening/transliterate_*.go`, `normalize_cyrillic.go`, `normalize_cjk.go`, `normalize_hebrew.go` | grep above; tests in same package |
| GLEIF LEI coverage 206,796 entities, 169 jurisdictions | per prior structural audit (memory id 99–101) | `psql -c "SELECT COUNT(*) FROM lei_entities"` |

## 9. Real-time / customer-facing surfaces

| Control | Evidence | How to verify |
|---|---|---|
| Iframe embed (zero-auth drop-in KYC) | `api/handler_iframe_page.go` serves `GET /embed?key=…`, posts results to parent via `window.postMessage` | `curl -s http://host/embed | grep widget.js` |
| Server-Sent Events alert stream | `api/handler_alerts_stream.go` at `GET /api/v1/alerts/stream`, tenant-scoped, SSE keepalive every 20s | `curl -N -H 'Authorization: Bearer …' /api/v1/alerts/stream` |
| Adverse-media continuous ingestion | `cmd/worker/media_pipeline.go` + `internal/ingestion/media_gdelt_fetch.go` (manifest → zip → unzip → AML-filtered articles) | Inspect worker logs: `media pipeline: fetched N AML-relevant articles` |
| Sub-processor changelog | `GET /api/v1/privacy/subprocessors/changelog` (public JSON) | `curl /api/v1/privacy/subprocessors/changelog` |
| Latency p95 / p99 | `api/handler_latency.go` + `/status` HTML dashboard | `curl /health/latency \| jq .p95_latency_ms` |

## 10. Open items remaining (out-of-band by definition)

These cannot be closed by code in a single session and are listed
honestly so the auditor sees the gap up front.

- External penetration test report — third-party engagement
- Signed DPA with every sub-processor in §5 — legal workstream
- Encryption key rotation automation — manual procedure
  documented at `docs/compliance/key-rotation-procedure.md`; KMS
  integration tracked on roadmap
- 6–12 month evidence collection window for SOC 2 Type 2
- Annual security training records

## 11. Israel-specific evidence (PPA / IMPA / NBCTF)

| Control | Evidence | How to verify |
|---|---|---|
| Israel compliance map | `docs/compliance/israel.md` | Maps every Israeli law to a code path |
| Hebrew privacy notice (draft) | `docs/compliance/privacy-notice-he.md` | Pending legal review |
| Structured screening record for IMPA filing | `internal/reports/impa_sar.go` + `GET /api/v1/reports/impa-sar/{id}` (AMLIQ-namespaced XML; IMPA does **not** publish a public XSD) | `go test ./internal/reports/ -run Impa` |
| NBCTF designation lists (orgs / individuals / crypto) | `internal/ingestion/all_lists.go`, `nbctf_crypto.go` | `go test ./internal/ingestion/ -run NBCTF` |
| Israeli PEP coverage | Wikidata SPARQL: 178 mayors, 1184 Knesset (live-verified), judiciary | per `docs/compliance/israel.md` §3 |
| Hebrew transliteration in screening | `internal/screening/transliterate_hebrew.go`, `normalize_hebrew.go` | grep + tests in same package |

## 12. Sign-off

This document must be re-checked before each audit window. Bump the
"Last updated" date and add a `git log --oneline` reference to the
commit that performed the verification pass.
