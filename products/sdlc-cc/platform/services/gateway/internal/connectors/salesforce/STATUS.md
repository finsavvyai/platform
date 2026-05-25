# salesforce — STATUS

Status: **REAL** — needs `CLIENT_ID` / `CLIENT_SECRET` at runtime.

The connector is a real `net/http` client against Salesforce REST
v59.0. OAuth via `/services/oauth2/token` (response includes
`instance_url`, persisted in `Token.Extra`). `httptest`-based unit
tests cover happy + error paths plus the FLS-strip contract.

## Required environment

| Variable | Purpose |
|----------|---------|
| `SALESFORCE_CLIENT_ID`     | Connected App consumer key |
| `SALESFORCE_CLIENT_SECRET` | Connected App consumer secret |
| `SALESFORCE_LOGIN_URL`     | `https://login.salesforce.com` (prod) or `https://test.salesforce.com` (sandbox) |
| `SALESFORCE_REDIRECT_URI`  | OAuth redirect, must match Connected App config |

## FLS enforcement

Salesforce omits any field the connected user cannot view from REST
responses (per-profile FLS). The connector indexes only what the API
returns — never SELECT *, and never re-merges describe metadata. Test
`TestFetch_FLSStrip_FieldOmittedWhenRestricted` documents this contract.

## Endpoints used

- `POST {LoginURL}/services/oauth2/token` (Authenticate)
- `GET  {instance_url}/services/data/v59.0/query?q=SOQL` (ListResources, four core sObjects)
- `GET  {instance_url}/services/data/v59.0/sobjects/{Object}/{Id}` (Fetch)
- `GET  {instance_url}/services/data/v59.0/parameterizedSearch?q=...` (Search)
- `POST {instance_url}/services/data/v59.0/sobjects/PushTopic` (Watch)
