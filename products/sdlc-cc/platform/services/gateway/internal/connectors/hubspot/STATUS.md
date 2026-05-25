# hubspot — REAL

Status: **REAL** — needs CLIENT_ID / CLIENT_SECRET at runtime.

The connector code in `connector.go` is a real net/http client against
the HubSpot CRM v3 API. Authenticate, ListResources, Fetch, Search and
Watch each issue real HTTP requests; the test suite drives every code
path through `httptest.Server`.

## Required env vars

- `HUBSPOT_CLIENT_ID` — OAuth client id from a HubSpot public app
- `HUBSPOT_CLIENT_SECRET` — paired secret
- `HUBSPOT_APP_ID` — developer app id (required for Watch — webhook subscriptions are app-scoped)
- `CONNECTOR_OAUTH_SECRET` — HMAC secret for the gateway's state token
- `ADMIN_UI_URL` — where the callback redirects after success

## Endpoints used

- `POST api.hubapi.com/oauth/v1/token` — token exchange (form-encoded)
- `GET /crm/v3/objects/contacts` — ListResources (paging.next.after cursor)
- `GET /crm/v3/objects/contacts/{id}` — Fetch
- `POST /crm/v3/objects/contacts/search` — Search (filterGroups + sorts + properties)
- `POST /webhooks/v3/{appId}/subscriptions` — Watch (subscription is app-scoped, fires on every install)

Required scopes: `crm.objects.contacts.read crm.objects.companies.read`.
