# Pilot Customer Onboarding Runbook

Last updated: 2026-05-04

End-to-end procedure to bring a new FI Pilot tenant from contract
signed to first AI-summarized alert. Single-page on purpose; if you
need more than this to onboard, escalate to engineering.

## Pre-flight (one-time per environment)

- [ ] Confirm migration 070 + 071 applied on the target Postgres.
      Verify: `psql "$DATABASE_URL" -c '\d tenant_saml_config'` shows
      14 columns including `role_attribute` + `role_map`.
- [ ] Confirm `AEGIS_AI_DAILY_CAP` set on the API service if you
      want quota enforcement (Pilot default: 1000).
- [ ] Confirm one of `ANTHROPIC_API_KEY` or `AWS_BEDROCK_REGION`
      (+ AWS creds) set so AI endpoints don't 503.
- [ ] Confirm `AEGIS_SSO_BASE_URL` set to the public host of the
      gateway so /sso routes mount.

## Per-tenant onboarding (≈ 30 minutes total)

### 1. Provision the tenant row (5 min)

```sql
INSERT INTO tenants (id, name, display_name)
VALUES ('tnt_<12-char-id>', '<customer-slug>', '<Customer Display Name>');
```

ID format must match `^tnt_[a-z0-9]{12}$` (regex enforced in
`internal/domain/tenant_id.go`).

### 2. Get IdP details from the customer (10 min)

The customer's IdP admin (Okta / Azure AD / Google Workspace /
Ping Identity admin) supplies four values:

| Field | Where they find it (Okta example) |
|---|---|
| Entity ID | Settings → SAML → Identity Provider Issuer |
| SSO URL | Settings → SAML → Identity Provider SSO URL |
| X.509 cert (PEM) | Settings → SAML → X.509 Certificate |
| Optional: role attribute name + LDAP-group → aegis-role map |

### 3. Generate SP keypair + insert SAML config (5 min)

```bash
make build-saml-keygen
./bin/aegis-saml-keygen \
  --tenant tnt_<id> \
  --base-url https://api.amliq.finance \
  --idp-entity-id "<from step 2>" \
  --idp-sso-url   "<from step 2>" \
  --idp-cert-path /path/to/their-idp-cert.pem \
  | psql "$DATABASE_URL"
```

stdout pipes the INSERT to psql; stderr prints the three values you
hand back (ACS URL, Entity ID, required attributes). Copy stderr
into your customer-facing email.

### 4. (Optional) Per-tenant role map (5 min)

If their IdP emits LDAP groups (e.g. `compliance_officer`,
`analyst`) and they want those mapped to aegis roles:

```sql
UPDATE tenant_saml_config
SET role_attribute = 'https://customer.example.com/groups',
    role_map = '{"compliance_officer":"admin","analyst":"viewer"}'::jsonb
WHERE tenant_id = 'tnt_<id>';
```

`role_attribute` is the SAML claim name. `role_map` translates the
IdP value to an aegis role. Skip this step entirely if the customer
is happy with the default `viewer` for everyone.

### 5. Test the SSO round-trip (5 min)

From the customer's authenticated browser session against their IdP:

```
GET https://api.amliq.finance/sso/tnt_<id>/login
```

Expected: 302 to their IdP, IdP authenticates, IdP POSTs back to
ACS URL, ACS returns 200 with `{NameID, Email, Role}`.

If 401: re-check IdP cert PEM + clock skew on customer's IdP.
If 404: row missing or `enabled = FALSE`.
If 400 SSO_ATTR_MISSING: their IdP isn't releasing email — go back
to the IdP admin and add it to the attribute mapping.

### 6. Hand off to amliq-frontend (5 min)

The frontend at https://amliq.finance already calls all the
backend endpoints. Customer logs in via their SSO, opens an alert,
clicks "AI Summary" — the request flows:

```
amliq-frontend
  → POST /api/v1/ai/summarize
  → SanitizeName + MaskAML (PII + PAN + IBAN + BIC + Israeli ID)
  → AnthropicClient or BedrockClient (per env)
  → AuditActionAISummarized row written
  → response back to UI
```

If you set `AEGIS_AI_DAILY_CAP`, calls beyond the cap return 429
with `AI_QUOTA_EXCEEDED`.

## Verification checklist (hand to customer)

After onboarding, the customer should be able to:

- [ ] Log in via their company SSO (no separate password)
- [ ] See themselves in `GET /api/v1/team` with the right role
- [ ] Get an AI summary on an alert that auto-redacts any PII
- [ ] (Manager only) See team usage at `GET /api/v1/team/ai-usage`
- [ ] Pull `GET /api/v1/audit?action=AISummarized` and see one row
      per AI call

## Rollback

Disable a tenant's SSO without losing their keypair:

```sql
UPDATE tenant_saml_config SET enabled = FALSE
 WHERE tenant_id = 'tnt_<id>';
```

Disabled rows = `/sso/{tenant}/login` returns 404 SSO_NOT_CONFIGURED.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| 503 AI_UNAVAILABLE | No provider env set | Set `ANTHROPIC_API_KEY` or `AWS_BEDROCK_REGION` |
| 401 SSO_VALIDATION_FAILED | Wrong IdP cert in DB or clock skew | Re-run keygen with current cert |
| 429 AI_QUOTA_EXCEEDED | Daily cap hit | Raise `AEGIS_AI_DAILY_CAP` or wait 24h |
| 400 STREAM_UNSUPPORTED | Client sent `stream:true` | SSE is roadmap; client must set `stream:false` |
| 500 AUDIT_FAILED on AI call | Audit DB unreachable | Check Postgres connectivity from API pod |
