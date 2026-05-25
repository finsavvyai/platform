# A1.8 — Okta SCIM Verification Runbook

**Purpose:** End-to-end verification that TenantIQ's SCIM 2.0 endpoint provisions correctly from Okta's free developer sandbox. Performed manually (Okta requires HTTPS endpoint review by Okta staff before automated testing).

**Status:** Manual verification — automated CI replacement deferred until Okta SaaS test harness available.

## Prerequisites

- Free Okta developer org (https://developer.okta.com)
- Production-deployed TenantIQ API (Okta requires public HTTPS endpoint)
- TenantIQ admin account with `admin` or higher role
- Migration `0013_scim_tokens.sql` applied to the target environment

## Step 1 — Apply migration

**Local first** (always):
```bash
npx wrangler d1 execute tenantiq-production --local --file packages/db/migrations/0013_scim_tokens.sql
```

**Remote** (deliberate, after local verification):
```bash
npx wrangler d1 execute tenantiq-production --remote --file packages/db/migrations/0013_scim_tokens.sql
```

Verify three tables exist:
```bash
npx wrangler d1 execute tenantiq-production --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('scim_bearer_tokens', 'platform_groups', 'platform_group_members');"
```
Expected: 3 rows.

## Step 2 — Generate SCIM token in TenantIQ

1. Log in to TenantIQ as org admin
2. Navigate to **Settings → SSO → SCIM Tokens**
3. Click **New Token**
4. Name: `Okta - Sandbox`
5. Click **Generate Token**
6. **Copy the plaintext token immediately** — it is shown ONCE

Save the token; you'll paste it into Okta in step 4.

## Step 3 — Smoke-test the endpoint manually

Before involving Okta, verify the endpoint is reachable + returns valid SCIM:

```bash
TOKEN="<paste-token-here>"
BASE="https://api.tenantiq.app/scim/v2"

# Should return ListResponse with empty Resources []
curl -s "$BASE/Users" -H "Authorization: Bearer $TOKEN" | jq

# Should return 401
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/Users" -H "Authorization: Bearer wrong-token"

# Should return 401 (no Bearer)
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/Users"
```

Expected:
- First call: HTTP 200, ListResponse JSON
- Second call: HTTP 401
- Third call: HTTP 401

## Step 4 — Configure Okta SCIM provisioning

1. In Okta Admin Console: **Applications → Browse App Catalog → SCIM 2.0 Test App** (or create custom SAML/SCIM-enabled app)
2. After creating: open the app → **Provisioning** tab → **Configure API Integration**
3. Enable: **Enable API Integration**
4. **SCIM 2.0 Base URL**: `https://api.tenantiq.app/scim/v2`
5. **OAuth Bearer Token**: paste the token from step 2
6. **Unique identifier field for users**: `userName`
7. **Supported provisioning actions**: check Push New Users, Push Profile Updates, Push Groups, Deactivate Users
8. Click **Test API Credentials**

Expected: green success "App credentials are valid".

If 401: verify token spelling, no leading/trailing whitespace.
If 400: verify Base URL has no trailing slash.
If 500: check `wrangler tail` logs for stack trace.

## Step 5 — Push a test user

1. In Okta: **Applications → SCIM Test App → Provisioning → To App** → enable **Create Users** + **Update User Attributes** + **Deactivate Users**
2. **Directory → People → Add Person**:
   - First name: `SCIM`
   - Last name: `Test`
   - Username: `scim-test@your-okta-domain.com`
3. Assign user to the SCIM Test App: **People** tab → **Assign** → select the new user
4. Watch Okta provisioning log — should show success

Verify in TenantIQ:
```sql
SELECT id, email, display_name, status FROM platform_users WHERE email = 'scim-test@your-okta-domain.com';
```
Expected: 1 row, status='active'.

## Step 6 — Test deactivation

1. In Okta: **Directory → People → SCIM Test** → click **Deactivate**
2. Wait 30s

Verify in TenantIQ:
```sql
SELECT status FROM platform_users WHERE email = 'scim-test@your-okta-domain.com';
```
Expected: status='inactive'.

## Step 7 — Test group push

1. Okta: **Directory → Groups → Add Group** → name `TenantIQ-Engineers`
2. Assign group to SCIM Test App
3. Push group to TenantIQ

Verify in TenantIQ:
```sql
SELECT id, display_name, external_id FROM platform_groups WHERE display_name = 'TenantIQ-Engineers';
```
Expected: 1 row, external_id matches Okta group id.

## Step 8 — Cleanup

1. Okta: unassign user, delete test user
2. Okta: delete test group
3. TenantIQ: revoke the test token via Settings → SSO → SCIM Tokens → Trash icon
4. Verify revoked token now returns 401:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" "$BASE/Users" -H "Authorization: Bearer $TOKEN"
   ```
   Expected: HTTP 401

## Acceptance — green box for engineering

- [ ] All 3 tables present after migration
- [ ] curl returns valid ListResponse on `Users` and `Groups` GET
- [ ] Okta "Test API Credentials" returns green
- [ ] Pushed user appears in `platform_users` within 60s
- [ ] Deactivation flips `status` to `inactive`
- [ ] Pushed group appears in `platform_groups` with correct `external_id`
- [ ] Revoked token returns 401

## Known Issues / Defer to Phase A2

- Filter parser supports only `eq` operator. Okta uses `eq` exclusively for username lookup, so this is fine. If Okta starts using compound filters in a future release, return 400 invalidFilter and they retry with a fallback simpler query.
- PATCH currently supports `replace active`, `replace displayName`, `add/replace/remove members`. Other PATCH ops (e.g., `replace emails`) return 400. Document explicitly in dev portal once published externally.
- No real-time error reporting back to Okta beyond HTTP status. Okta retries on 5xx; honor that in code (return 5xx for transient DB issues, 4xx for permanent errors).

## Logging & Debugging

Live tail logs during provisioning test:
```bash
cd apps/api && npx wrangler tail
```

Look for:
- `[scim-auth] token lookup` rows (none currently emitted — add structured logging in Phase A2 if needed)
- `Unhandled request error` from `app.onError` indicates code bug

## Re-running the runbook

This procedure is manual and should be re-run:
- Before each major SCIM-related release
- When Okta announces SCIM spec updates
- When adding support for additional IdPs (Entra ID, OneLogin) — copy this file as `A1-entra-scim-runbook.md` etc. and adapt
