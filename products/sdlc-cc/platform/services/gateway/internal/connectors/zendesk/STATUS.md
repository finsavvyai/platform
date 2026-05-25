# zendesk — REAL

Status: **REAL** — needs CLIENT_ID / CLIENT_SECRET at runtime.

The connector code in `connector.go` is a real net/http client against the
Zendesk REST API. Authenticate, ListResources, Fetch, Search and Watch
each issue real HTTP requests; the test suite drives every code path
through `httptest.Server` with no network access.

## Required env vars

- `ZENDESK_CLIENT_ID` — OAuth client id from Admin Center → Apps → APIs → OAuth Clients
- `ZENDESK_CLIENT_SECRET` — paired secret
- `ZENDESK_SUBDOMAIN` — tenant subdomain (e.g. `acme` for `acme.zendesk.com`)
- `CONNECTOR_OAUTH_SECRET` — HMAC secret for the gateway's state token (shared across all connectors)
- `ADMIN_UI_URL` — where the callback redirects after success

## Endpoints used

- `POST {subdomain}.zendesk.com/oauth/tokens` — token exchange (JSON body)
- `GET /api/v2/tickets.json` — ListResources
- `GET /api/v2/tickets/{id}.json` — Fetch
- `GET /api/v2/search.json?query=` — Search
- `POST /api/v2/webhooks` — Watch (registers an active webhook)
