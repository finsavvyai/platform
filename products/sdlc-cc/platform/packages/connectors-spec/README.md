# connectors-spec

Contract documentation for the SDLC Platform connector framework.

> **Status**: framework REAL, every shipped connector is a SCAFFOLD.
> Last updated: P2-Day39.

## Purpose

Every external data source we index (Google Drive, Slack, GitHub, ...)
implements the same Go interface defined in
`services/gateway/internal/connectors/connector.go`. This package is
the human-readable contract: read it before you write a new connector
or change the framework.

## The interface

```go
type Connector interface {
    Name() string
    Authenticate(ctx context.Context, tenantID uuid.UUID, code string) error
    ListResources(ctx context.Context, tenantID uuid.UUID) ([]Resource, error)
    Fetch(ctx context.Context, tenantID uuid.UUID, resourceID string) (*Document, error)
    Search(ctx context.Context, tenantID uuid.UUID, query string) ([]Resource, error)
    Watch(ctx context.Context, tenantID uuid.UUID) (<-chan ChangeEvent, error)
}
```

### Method-by-method contract

| Method | Required behaviour | Errors | Notes |
|---|---|---|---|
| `Name` | Return the lowercase canonical id (e.g. `"google_workspace"`). Must match the registry key. | none | Stable across versions; renaming breaks tenant tokens. |
| `Authenticate` | Exchange an OAuth callback `code` for a token, persist it keyed by `tenantID`, return nil. The gateway has already validated `state` + PKCE. | `errors.New("not implemented: ...")` while in scaffold; vendor-specific OAuth errors when REAL. | Tokens are stored encrypted via `internal/secrets`. Refresh handled out-of-band. |
| `ListResources` | Page through everything the connected user can see. Stop at the first vendor 4xx that isn't 401 (re-auth case). | propagate vendor error; wrap with connector name. | Must respect tenant RLS — never leak across tenants. |
| `Fetch` | Return body + mime type + author. Body is the raw vendor payload (HTML, PDF, JSON, ...). | `404` style errors when the resource was deleted. | Caller chunks + embeds; this method does not transform. |
| `Search` | Use the vendor's native search; fall back to client-side filter only if the vendor has none. | wrap vendor errors. | Query syntax is opaque — pass through. |
| `Watch` | Return a channel that receives one `ChangeEvent` per vendor webhook / poll tick. Close on `ctx.Done()`. | non-nil only on initial wiring failure. | Long-lived; the indexer fan-ins all connector channels. |

## Registry

`connectors.Registry` (see `registry.go`) is the global map that:

1. Holds one `Connector` instance per name.
2. Stores `Metadata` per connector — `DisplayName`, `Vendor`,
   `Category`, **RBAC `Scopes`**, `DocsURL`.
3. Is consulted by the `/admin/connectors` API for the marketplace UI
   (Day 48) and by the policy layer for scope enforcement.

Use `RegisterWithMeta(c, Metadata{...})` from each connector's
`init()` so the registry is populated by import side-effect.

## RBAC scopes

Each connector declares its required platform scopes — strings of the
form `"<verb>:<resource>"` (e.g. `read:drive`, `read:tickets`). The
gateway's policy middleware checks these before forwarding any call
to `ListResources` / `Fetch` / `Search`. Scopes are connector-side
abstractions; they do **not** map 1:1 to vendor OAuth scopes.

## SCAFFOLD vs REAL

A connector is REAL only when **all four** of these are true:

1. Vendor OAuth app is registered, client id + secret are in the
   tenant's secret store.
2. `Authenticate` performs the real token exchange (no
   `errors.New("not implemented: ...")`).
3. `connector_oauth.go` callback handler routes the vendor redirect
   into `Authenticate`.
4. There is at least one passing integration test against a real
   sandbox tenant.

Anything less is SCAFFOLD. The connector's source file MUST carry a
`// SCAFFOLD(P2-DayNN-<name>):` banner with the residual checklist
until the four conditions above are met.

## Adding a new connector — checklist

- [ ] Create `services/gateway/internal/connectors/<name>/` with
      `connector.go` + `connector_test.go` + `NOT_IMPLEMENTED.md`.
- [ ] Implement the interface; include the SCAFFOLD banner.
- [ ] Register in `init()` via `RegisterWithMeta` with vendor metadata
      and scopes.
- [ ] Test asserts that `Authenticate` returns the not-implemented
      error until the vendor app is wired.
- [ ] Add an entry to the marketplace UI's hardcoded list in
      `services/admin-ui/src/app/dashboard/connectors/page.tsx`.
- [ ] Update this README's status table when promoting to REAL.

## Status table

| Connector | Vendor | Category | Status |
|---|---|---|---|
| `google_workspace` | Google | productivity | SCAFFOLD |
| `microsoft365` | Microsoft | productivity | SCAFFOLD |
| `slack` | Slack | communication | SCAFFOLD |
| `github` | GitHub | devtools | SCAFFOLD |
| `atlassian` | Atlassian | devtools | SCAFFOLD |
| `notion` | Notion | productivity | SCAFFOLD |
| `salesforce` | Salesforce | crm | SCAFFOLD |
| `zendesk` | Zendesk | support | SCAFFOLD |
| `servicenow` | ServiceNow | support | SCAFFOLD |
| `hubspot` | HubSpot | crm | SCAFFOLD |
