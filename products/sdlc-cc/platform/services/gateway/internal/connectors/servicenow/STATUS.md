# servicenow — REAL

Status: **REAL** — needs CLIENT_ID / CLIENT_SECRET at runtime.

The connector code in `connector.go` is a real net/http client against
the ServiceNow REST surface. Authenticate, ListResources, Fetch, Search
and Watch each issue real HTTP requests; the test suite drives every
code path through `httptest.Server`.

## Required env vars

- `SERVICENOW_CLIENT_ID` — OAuth client id from System OAuth → Application Registry
- `SERVICENOW_CLIENT_SECRET` — paired secret
- `SERVICENOW_INSTANCE` — instance name (e.g. `acme` for `acme.service-now.com`)
- `CONNECTOR_OAUTH_SECRET` — HMAC secret for the gateway's state token
- `ADMIN_UI_URL` — where the callback redirects after success

## Endpoints used

- `POST {instance}.service-now.com/oauth_token.do` — token exchange (form-encoded)
- `GET /api/now/table/{table}` — ListResources (default `incident`)
- `GET /api/now/table/{table}/{sys_id}` — Fetch
- `GET /api/now/table/{table}?sysparm_query=` — Search
- Watch: polling-based (`PollInterval`, default 30s) — ServiceNow webhook
  registration requires Studio admin configuration and is not available
  over the public REST API. The polling fallback re-queries the table
  and emits update events for rows whose `sys_updated_on` advanced.
