# Customer Data Deletion Procedure

> Required by M365 Cert (C7) and GDPR Art. 17 (right to erasure).

## Triggers

| Trigger | Path | Window |
|---|---|---|
| Customer self-service | `DELETE /api/account` | immediate soft-delete, 30-day hard-delete |
| Subscription cancellation (LemonSqueezy webhook) | webhook handler | 30-day grace, then auto-purge |
| Support-assisted (manual ticket) | `wrangler` runbook | within 14 days of request |
| Sub-processor offboarding | n/a | data already deleted from that vendor |

## Cascade map

When org `O` is deleted:

### D1 (SQLite)

```sql
-- Order matters: child rows first, FK-clean
DELETE FROM control_results WHERE scan_id IN (SELECT id FROM cis_scans WHERE organization_id = ?);
DELETE FROM cis_scans WHERE organization_id = ?;
DELETE FROM alerts WHERE organization_id = ?;
DELETE FROM workflows WHERE organization_id = ?;
DELETE FROM remediations WHERE organization_id = ?;
DELETE FROM users_cache WHERE organization_id = ?;
DELETE FROM licenses WHERE organization_id = ?;
DELETE FROM config_snapshots WHERE organization_id = ?;
DELETE FROM tenants WHERE organization_id = ?;
DELETE FROM platform_users WHERE organization_id = ?;
DELETE FROM audit_log WHERE organization_id = ?;  -- last; preserve until end
DELETE FROM organizations WHERE id = ?;
```

### KV

Pattern delete (Cloudflare KV `list` + `delete` loop):

- `graph:{azure_tenant_id}:*` for every tenant under the org
- `consent:{tenant_id}:*`
- `session:{azure_oid}` for every member user
- `auth:state:*` (auto-expires in 5 min anyway)
- per-feature caches: `score:*`, `snapshot:*`, `drift:*` keyed by tenant_id

### R2

Object prefix delete:

- `exports/{org_id}/*`
- `snapshots/{org_id}/*`
- `reports/{org_id}/*`

### Sub-processors (manual)

| Vendor | Action | Reference |
|---|---|---|
| Sentry | scrub events tagged `org_id=<id>` via API | DPA Art. 28 |
| Anthropic | no per-tenant store; conversations not retained beyond response | DPA |
| Resend | suppress recipients; old emails purged on vendor's schedule | DPA |
| Twilio | suppress numbers; SMS logs purged on vendor's 13-month default | DPA |
| LemonSqueezy | financial records retained per tax/regulatory law | DPA |
| Microsoft | Graph data is the customer's; we don't store it externally beyond cache above | n/a |

## Backup policy

Backups (R2 daily snapshots of D1) are retained 30 days. Hard-delete is **not** propagated into backups; instead, deletion is enforced on restore: a restore must filter out deleted org IDs. This is documented in the DR runbook.

## Audit log retention exception

Audit log entries that reference the deleted org are themselves deleted last in the cascade above. **Exception**: regulator-related events (e.g. breach notifications) may be retained in a separate compliance archive for the legally required period — flagged at write time and excluded from the cascade by the `compliance_hold = 1` column.

## Verification

After cascade:

```bash
# D1: confirm zero rows in every table for the org
cd apps/api && npx wrangler d1 execute tenantiq-production --remote \
  --command "SELECT 'organizations' tbl, COUNT(*) c FROM organizations WHERE id = ? \
  UNION ALL SELECT 'platform_users', COUNT(*) FROM platform_users WHERE organization_id = ? \
  UNION ALL SELECT 'tenants', COUNT(*) FROM tenants WHERE organization_id = ? \
  UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log WHERE organization_id = ?"
```

All counts MUST be `0`.

```bash
# KV: list keys for org's tenants — expect empty
npx wrangler kv key list --namespace-id=<KV_ID> --prefix=graph:<tid>:
```

```bash
# R2: list objects under org prefix — expect empty
npx wrangler r2 object list tenantiq-exports --prefix=exports/<org_id>/
```

## Implementation status

| Step | Status |
|---|---|
| `DELETE /api/account` endpoint | ✅ `apps/api/src/routes/account.ts` (immediate hard-delete; GDPR Art. 17 compliant) |
| `GET /api/account/export` endpoint | ✅ same file (data portability) |
| Soft-delete column on `organizations` | ✅ migration `0018_org_soft_delete.sql` |
| 30-day cron purge job | ✅ `apps/api/src/cron/account-purge.ts`, runs daily 03:00 UTC |
| KV pattern-delete helper | ✅ `apps/api/src/lib/kv-purge.ts` |
| R2 prefix-delete helper | ✅ inlined in `apps/api/src/lib/account-deletion.ts` |
| LemonSqueezy unsubscribe → set `deleted_at` | ❌ TODO — wire `subscription_cancelled` event to `UPDATE organizations SET deleted_at = ?` |
| Verification runbook in `docs/RUNBOOK.md` | ❌ TODO |

Two paths to delete an org:
1. **Immediate** — `DELETE /api/account` with `{"confirm":"DELETE"}` → cascade now (the right-to-erasure path).
2. **Grace** — `deleted_at` set (e.g. by future LemonSqueezy unsubscribe handler) → cron purges after 30 days. Customer can be reinstated by clearing `deleted_at` within the window.
