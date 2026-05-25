# atlassian — STATUS

Status: **REAL** — needs `CLIENT_ID` / `CLIENT_SECRET` at runtime (Cloud)
or per-tenant PAT (Server).

The connector is a real `net/http` client against
`auth.atlassian.com` (OAuth) + `api.atlassian.com/ex/{jira|confluence}/{cloudID}`
for Cloud, and the customer's own Jira / Confluence base URL for
Server / Data Center deployments. `httptest`-based unit tests cover
both modes.

## Required environment

### Cloud

| Variable | Purpose |
|----------|---------|
| `ATLASSIAN_CLIENT_ID`     | Connect 3LO app id |
| `ATLASSIAN_CLIENT_SECRET` | Connect 3LO secret |
| `ATLASSIAN_REDIRECT_URI`  | OAuth redirect URI |

### Server / Data Center

| Variable | Purpose |
|----------|---------|
| `ATLASSIAN_SERVER_BASE_URL` | Customer Jira / Confluence root |
| (per-tenant) PAT supplied via the OAuth-callback `code` field |

Set `Config.Mode = "server"` to take the PAT path.

## Endpoints used

- `POST {AuthURL}/oauth/token` (Cloud OAuth)
- `GET  /oauth/token/accessible-resources` (cloud_id lookup)
- `GET  /ex/jira/{cloud}/rest/api/3/search?jql=...` (ListResources)
- `GET  /ex/confluence/{cloud}/wiki/rest/api/content?type=page` (ListResources)
- `GET  /ex/jira/{cloud}/rest/api/3/issue/{key}` (Fetch issue)
- `GET  /ex/confluence/{cloud}/wiki/rest/api/content/{id}?expand=body.storage` (Fetch page)
- `GET  /ex/jira/{cloud}/rest/api/3/search?jql=text~"q"` + Confluence CQL (Search)
- `POST /ex/jira/{cloud}/rest/api/3/webhook` (Watch)
