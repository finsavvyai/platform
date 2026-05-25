# Secrets — Rotation & Emergency Revocation

**RPO:** zero — secrets in HashiCorp Vault are replicated synchronously
to a Performance Standby; no write is ack'd until both nodes have it.
**RTO:** ≤ 5 minutes — Vault standby promotes automatically; client
services rediscover within one cache TTL.

## Secret categories

| Category | Storage | Rotation cadence | Emergency procedure |
| --- | --- | --- | --- |
| Database passwords | Vault Database Engine | every 24h | revoke lease + re-issue |
| API keys (platform) | Postgres `api_keys` table | per-tenant policy | use api_key_rotation.go (Day 9) |
| HMAC signing keys (audit) | Vault KV v2 | quarterly | dual-write window then promote |
| KMS data keys | AWS/GCP/Azure KMS | per-cloud rotation | platform-managed |
| OAuth client secrets | Vault KV v2 | annually | re-register with the IdP, dual-write |
| TLS certificates | Vault PKI | 90 days | cert-manager auto-rotates; manual `vault write pki/issue/...` for break-glass |

## Standard rotation

### Database password (gateway → postgres)

Vault's database engine handles this; the gateway pulls a fresh
credential on each startup and on credential expiry.

```bash
# Force a rotation without a deploy:
vault write -force database/rotate-role/sdlc-gateway
# The gateway sees the lease invalidated and pulls the new one.
```

### HMAC audit signing key

Audit log signatures (Day 12) MUST verify across the rotation
boundary; we therefore use a **dual-write window**.

1. Write the new key alongside the old:
   ```bash
   vault kv put secret/audit/signing key_v=$(uuidgen) value_old=$OLD value_new=$NEW
   ```
2. Deploy the gateway with `AUDIT_SIGNING_KEY_NEXT=$NEW` in addition to
   `AUDIT_SIGNING_KEY=$OLD`. New writes use NEW; verifies try NEW
   first, then OLD.
3. After 24h, deploy with `AUDIT_SIGNING_KEY=$NEW` and
   `AUDIT_SIGNING_KEY_PREV=$OLD`.
4. After 7 days (audit-log TTL the key was used in), drop
   `AUDIT_SIGNING_KEY_PREV` and remove the OLD value from Vault.

### TLS certificate

cert-manager handles this end-to-end via the `Issuer` resource. To
verify status:

```bash
kubectl get certificate -A
kubectl describe certificate sdlc-gateway-tls
```

## Emergency revocation

Use only when a secret is known compromised.

### Compromised database password

```bash
vault write -force database/rotate-root/postgres-prod
```

This rotates the root password Vault uses to mint user creds. Existing
leases stay valid; rotate them too:

```bash
vault lease revoke -prefix database/creds/sdlc-gateway
```

The gateway sees its lease invalidated and re-issues. Cap the time
between the leak detection and the revoke at 60 seconds.

### Compromised HMAC signing key

`AUDIT_SIGNING_KEY` controls audit-log integrity. If leaked:

1. Generate a new key and deploy as `AUDIT_SIGNING_KEY` immediately
   (skip the dual-write window — integrity matters more than backward
   verification).
2. Run `services/gateway/scripts/audit-resign.sh --since=<leak-time>`
   to re-sign rows written during the compromise window with the new
   key plus a `re_signed_at` annotation, so future verifies pass and
   the audit trail surfaces the incident.
3. File an incident postmortem; the audit log itself becomes evidence.

### Compromised OAuth client secret

1. Re-register the OAuth app with the IdP.
2. `vault kv put secret/oauth/<provider> client_secret=$NEW`.
3. Roll the deployments that consume it.
4. Revoke any sessions issued during the compromise window:
   ```sql
   UPDATE user_sessions SET revoked_at = NOW()
   WHERE created_at BETWEEN $1 AND $2;
   ```

## Quarterly exercise

- [ ] Rotate the audit HMAC signing key end-to-end.
- [ ] Verify `audit-resign.sh` works on a fixture row.
- [ ] Trigger a Vault standby promotion in staging.
- [ ] Time the rotation; record in `rto-rpo-drill-log.md`.

## Drill log

See `docs/runbooks/rto-rpo-drill-log.md`.
