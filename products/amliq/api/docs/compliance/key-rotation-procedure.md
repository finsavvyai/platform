# Encryption key rotation procedure

Last reviewed: 2026-04-29.
Owner: security lead.

## Scope

Three classes of secret material are in use:

1. **JWT signing key** — used to sign API access tokens. Currently a
   single HMAC secret loaded from the `JWT_SECRET` environment
   variable.
2. **Field-level encryption key** — used by
   `internal/crypto/field_encryption.go` to wrap PII columns at rest.
   Currently loaded from `FIELD_ENCRYPTION_KEY`.
3. **API keys** — per-tenant, hashed at rest with bcrypt
   (`api/apikey_hash.go`). Tenants rotate these on demand from the
   dashboard; no platform-wide rotation is required.

## Rotation cadence

| Key class | Cadence | Trigger |
|---|---|---|
| JWT signing | annual, or on suspected compromise | calendar reminder + post-incident |
| Field encryption | every 24 months, or on schema change involving sensitive columns | change-management ticket |
| API keys | per-tenant, on demand | tenant action |

## Manual procedure (until automation lands)

1. Generate a new key with `openssl rand -base64 48`.
2. Add the new value as `<NAME>_NEXT` to the production secret store.
3. Deploy the application; the runtime accepts both `<NAME>` and
   `<NAME>_NEXT` for the overlap window.
4. After the overlap window (24 h for JWT, 30 d for field
   encryption), promote `<NAME>_NEXT` to `<NAME>` and remove the
   previous value.
5. Append an audit row:
   `INSERT INTO audit_entries (tenant_id, action, details, created_at)
   VALUES ('platform', 'key_rotation', 'class=jwt rotated_at=…',
   NOW())`.

## Verification

Auditors can check rotation history with:

```sql
SELECT created_at, details
  FROM audit_entries
 WHERE action = 'key_rotation'
 ORDER BY created_at DESC;
```

## Roadmap

- Replace HMAC JWT with asymmetric (RS256/Ed25519) and store the
  public key in a JWKS endpoint, so consumers can rotate by reading
  `kid`.
- Move both classes of key into a managed KMS (AWS KMS, GCP KMS, or
  HashiCorp Vault Transit) so rotation becomes a single API call.
- Add a `/health/full` subsystem that reports days-since-last-
  rotation and flags overdue entries as `degraded`.

These items are tracked in `docs/compliance/soc2_readiness.md` §1.1.
