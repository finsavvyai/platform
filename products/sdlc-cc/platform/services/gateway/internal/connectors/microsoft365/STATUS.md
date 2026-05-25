# microsoft365 — STATUS

Status: **REAL** — needs `CLIENT_ID` / `CLIENT_SECRET` at runtime.

The connector is a real `net/http` client against Microsoft Graph v1.0
+ the Azure AD v2.0 token endpoint. All five `Connector` methods are
implemented; `httptest`-based unit tests cover happy + error paths.

## Required environment

| Variable | Purpose |
|----------|---------|
| `MICROSOFT365_CLIENT_ID`     | Azure AD app registration client id |
| `MICROSOFT365_CLIENT_SECRET` | Azure AD app registration secret |
| `MICROSOFT365_TENANT_ID`     | Tenant GUID (or `common` for multi-tenant) |
| `MICROSOFT365_REDIRECT_URI`  | OAuth redirect, must match Azure config |

## Required Graph delegated permissions

`Files.Read.All`, `Sites.Read.All`, `Chat.Read`, `offline_access`.

`Chat.Read` requires **admin consent** — surface that in the marketplace UI.

## Endpoints used

- `POST {LoginURL}/{tenant}/oauth2/v2.0/token` (Authenticate)
- `GET  /v1.0/sites?search=*` + `@odata.nextLink` (ListResources)
- `GET  /v1.0/me/drive/root/children` + `@odata.nextLink` (ListResources)
- `GET  /v1.0/drives/{drive}/items/{item}` + `/content` (Fetch)
- `POST /v1.0/search/query` (Search)
- `POST /v1.0/subscriptions` (Watch)
