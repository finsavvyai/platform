# SAML SSO — Per-Tenant Setup Runbook

Last updated: 2026-05-03

## Prerequisites

- Migration `070_tenant_saml_config.up.sql` applied to the target DB.
- `AEGIS_SSO_BASE_URL` set to the public scheme+host of the gateway
  (e.g. `https://api.aegis.cc`).
- The tenant exists in the `tenants` table.

## Provisioning a new tenant

### 1. Generate the SP keypair + INSERT SQL

The SP keypair is per-tenant — a stolen key from one customer cannot
sign AuthnRequests for another. Use the bundled CLI:

```bash
go run ./cmd/saml-keygen \
  --tenant tnt_abc123def456 \
  --base-url https://api.aegis.cc \
  --idp-entity-id "https://customer.okta.com/exk..." \
  --idp-sso-url   "https://customer.okta.com/app/.../sso/saml" \
  --idp-cert-path /path/to/idp.pem \
  > tenant_abc.sql
```

stdout is a pipeable INSERT statement for `tenant_saml_config`;
stderr prints the three values to hand the customer's IdP admin
(ACS URL, Entity ID, required attribute list). That separation lets
you run `aegis-saml-keygen ... | psql "$DATABASE_URL"` from a deploy
script without polluting the SQL stream.

Pass `--pem-only` if you'd rather have the raw key+cert PEM blocks
written to stdout for hand-INSERT.

### 2. Collect IdP details from the customer

The customer's IdP admin supplies four values from their console:

| Field | Where to find it (Okta example) |
|---|---|
| `idp_entity_id` | Settings → SAML → Identity Provider Issuer |
| `idp_sso_url` | Settings → SAML → Identity Provider SSO URL |
| `idp_x509_cert` | Settings → SAML → X.509 Certificate (PEM) |
| Optional: `idp_metadata_xml` | Full metadata XML if the IdP exports it |

Azure AD, Google Workspace, and Ping Identity expose the same four
under different menu paths. The names of the four are stable across
IdPs even when the UI labels differ.

### 3. Apply the INSERT

```bash
psql "$DATABASE_URL" < tenant_abc.sql
```

Or pipe directly from the keygen step:

```bash
go run ./cmd/saml-keygen --tenant ... --base-url ... \
  --idp-entity-id ... --idp-sso-url ... --idp-cert-path ... \
  | psql "$DATABASE_URL"
```

### 4. Hand the customer the SP details for IdP-side config

The customer's IdP admin needs three values from us:

| Field | Value |
|---|---|
| ACS URL | `https://api.aegis.cc/sso/tnt_abc123def456/acs` |
| Entity ID / Audience | `https://api.aegis.cc/sso/tnt_abc123def456/metadata` |
| Required attributes | `email` (or the standard XMLSoap claim URI), optional `role` |

### 5. Test the round-trip

From the customer's authenticated browser session against their IdP:

```
GET https://api.aegis.cc/sso/tnt_abc123def456/login
```

Should 302 to the IdP, IdP authenticates, IdP POSTs back to the ACS
URL, ACS returns 200 with the mapped identity claims.

## Cutting SSO over/back

To temporarily disable SAML for a tenant without losing their keypair:

```sql
UPDATE tenant_saml_config SET enabled = FALSE
 WHERE tenant_id = 'tnt_abc123def456';
```

Disabled rows are treated as absent — `/sso/{tenant}/login` returns
404 SSO_NOT_CONFIGURED until re-enabled.

## Rotating the SP keypair

The SP cert defaults to a 10-year validity (see `keypair.go`). Rotate
proactively, never reactively:

1. Re-run `cmd/saml-keygen --pem-only` for the same tenant (you'll
   need the original IdP values; the new SP keypair is independent).
2. Update both `sp_key_pem` and `sp_cert_pem` on the existing row
   via `UPDATE tenant_saml_config SET sp_key_pem=..., sp_cert_pem=...
   WHERE tenant_id='tnt_...'`.
3. Hand the customer the new SP cert; they paste it into their IdP
   trust store. AuthnRequests signed by the old key continue to be
   trusted only until the customer rotates their end.

There is no zero-downtime rotation today — both ends must rotate in
the same maintenance window. SCIM-based bulk rotation is roadmap.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `404 SSO_NOT_CONFIGURED` on /login | Row missing or `enabled=FALSE` |
| `401 SSO_VALIDATION_FAILED` on /acs | Clock skew, expired AuthnRequest cookie, wrong IdP cert in DB |
| `400 SSO_ATTR_MISSING` on /acs | IdP isn't releasing email; check IdP attribute mapping |
| 500 SSO_REQUEST_FAILED on /login | Bad SP key/cert PEM in DB; regenerate via GenerateSPKeypair |
