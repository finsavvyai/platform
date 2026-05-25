# @amliq/brain-connectors

MCP connectors for **AMLIQ Brain** — pluggable producers of
`ComplianceDoc` records sourced from internal SaaS systems (Slack,
Confluence, Google Drive). Consumed by the SEARCH-UI service and the
SAR-Draft agent via DI.

This package is intentionally *not* in `pnpm-workspace.yaml`. It
installs with `pnpm install --ignore-workspace` so its vitest 1.6.1
pin does not collide with the root vitest 4.x graph (round-4 rule).

## Scope (M2 W5)

| Connector | API | Status |
|-----------|-----|--------|
| Slack | Web API (`search.messages`, `conversations.history`) | full |
| Confluence | Cloud REST (`content/search`, `pages/{id}`) | full |
| Google Drive | v3 (`files.list`, `files.get`, `files.export`) | text/markdown/Google-Doc full; PDF skeleton (returns `not_implemented`) |

## Cross-agent contract

Brain Month 2 conventions §1 (connector interface) and §2 (tenant
context). Every connector exposes:

```ts
interface McpConnector {
  readonly source: 'slack' | 'confluence' | 'drive';
  list(query: ConnectorQuery, ctx: TenantContext): Promise<ConnectorListResult>;
  fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc>;
  watch?(cb: (doc: ComplianceDoc) => void, ctx: TenantContext): Unsubscribe;
}
```

`ComplianceDoc` is field-for-field identical to
`oss/finsavvy-rag/src/types/compliance-doc.ts`. It is duplicated locally
so `products/*` code never imports `@finsavvyai/*` (round-2 rule).

`TenantContext { tenant_id, actor_id, roles[] }` is the MULTI-TENANT
agent's canonical shape (mirrored here). **Every connector method
validates a non-empty `tenant_id` before any upstream call**; tests
enforce 100 % coverage of this gate per Brain Month 2 §1-2.

## Tenant isolation enforcement

Each connector pushes `tenant_id` into the *upstream* query, not the
post-filter — so an over-broad upstream response cannot leak across
tenants even if a later filter is missed:

| Connector | Isolation mechanism |
|-----------|--------------------|
| Slack | `tenant:<id>` modifier appended to `search.messages` query |
| Confluence | `label = "tenant-<id>"` ANDed into the CQL search |
| Drive | `appProperties has { key='tenant_id' and value='<id>' }` |

Requires upstream-side discipline (Slack messages tagged, Confluence
pages labelled, Drive uploads carrying the appProperty). Tagging is the
responsibility of the upload/import pipeline, not this package.

## Required env vars (consumer-side)

This package itself reads no env vars. Tokens are supplied via
`tokenForTenant(tenantId)` callbacks injected at construction. The
following names are the convention the brain wiring layer SHOULD use
when fetching tokens from the platform secret store:

| Var | Used by | Purpose |
|-----|---------|---------|
| `SLACK_BOT_TOKEN` | Slack connector | `xoxb-…` bot token, scoped to one Slack workspace per tenant |
| `CONFLUENCE_API_TOKEN` | Confluence connector | base64(`email:apiToken`) for HTTP Basic auth |
| `CONFLUENCE_BASE_URL` | Confluence connector | tenant Confluence URL, e.g. `https://acme.atlassian.net` |
| `GOOGLE_OAUTH_TOKEN` | Drive connector | OAuth 2.0 bearer with `drive.readonly` scope |

Real values are NEVER hard-coded here, never in tests, never in source
control. Multi-tenant production pulls them from the platform secret
store keyed by `tenant_id`.

## Usage (sketch)

```ts
import {
  SlackConnector,
  ConfluenceConnector,
  DriveConnector,
} from "@amliq/brain-connectors";

const tenantTokens = /* injected secret-store client */;

const slack = new SlackConnector({
  client: /* SlackClient impl */,
  tokenForTenant: (t) => tenantTokens.get(t, "SLACK_BOT_TOKEN"),
});

const confluence = new ConfluenceConnector({
  baseUrl: tenantTokens.get(tenantId, "CONFLUENCE_BASE_URL"),
  tokenForTenant: (t) => tenantTokens.get(t, "CONFLUENCE_API_TOKEN"),
});

const drive = new DriveConnector({
  tokenForTenant: (t) => tenantTokens.get(t, "GOOGLE_OAUTH_TOKEN"),
});

// All three implement McpConnector — SEARCH-UI fans out by source.
```

## Tests

`pnpm install --ignore-workspace && pnpm test` — vitest 1.6.1 pinned.

Coverage thresholds (`vitest.config.ts`):

- portfolio baseline: 90 % lines, 85 % branches, 90 % functions.
- per-connector module (`slack-connector.ts`, `confluence-connector.ts`,
  `drive-connector.ts`): **100 % line + branch + function**.

The per-file 100 % gate is what enforces the cross-agent contract that
tenant isolation cannot regress silently.

## File layout

```
src/
  types.ts                       cross-agent contracts
  _lib.ts                        sha256, normalizeText, formatDocId, fetch helpers
  _lib.test.ts
  slack/slack-connector.ts
  slack/slack-connector.test.ts
  confluence/confluence-connector.ts
  confluence/confluence-connector.test.ts
  drive/drive-connector.ts
  drive/drive-connector.test.ts
  index.ts                       barrel
```

200-line cap (portfolio rule) is enforced on every source file in `src/`.

## Scope addendum (M3 W11) — Jira + Teams

Brain Month 3 mesh §8 ("connector parity") extends this package with two
more `McpConnector` implementations. Behaviour is identical to the M2
trio (DI-only tokens, tenant-scoped upstream queries, `ComplianceDoc`
output, `ConnectorError` mapping).

| Connector | API | Tenant isolation mechanism |
|-----------|-----|----------------------------|
| Jira | Cloud REST v3 (`search`, `issue/{key}`) | JQL `labels in (tenant-<id>)` ANDed into every search |
| Teams | Microsoft Graph v1.0 (`search/query`, `teams/.../messages/...`) | KQL `channelIdentity/teamId:<teamIdForTenant(id)>` ANDed into every search |

Both connectors share the M2 error-code surface and additionally throw a
local `JiraRateLimitedError` / `TeamsRateLimitedError` (subclasses of
`ConnectorError` with `code === 'rate_limited'`) on HTTP 429. When the
upstream returns a numeric `Retry-After`, it is surfaced as
`meta.retry_after_seconds`. These subclasses live in the per-connector
folder so the shared `types.ts` surface remains untouched (round-2 rule).

### Jira env var convention (consumer-side)

| Var | Used by | Purpose |
|-----|---------|---------|
| `JIRA_BASE_URL` | Jira connector | tenant base URL, e.g. `https://acme.atlassian.net` |
| `JIRA_API_TOKEN` | Jira connector (`authMode: 'basic'`) | base64(`email:apiToken`) for HTTP Basic auth |
| `JIRA_OAUTH_TOKEN` | Jira connector (`authMode: 'bearer'`) | Atlassian Cloud OAuth 2.0 bearer |
| `JIRA_AUTH_MODE` | Jira connector | `'basic'` or `'bearer'` — selects the `Authorization` header scheme |

### Teams env var convention (consumer-side)

| Var | Used by | Purpose |
|-----|---------|---------|
| `MS_GRAPH_BASE_URL` | Teams connector | Graph base URL, defaults to `https://graph.microsoft.com` |
| `MS_TEAMS_OAUTH_TOKEN` | Teams connector | OAuth 2.0 bearer with `ChatMessage.Read.All` / search scopes |

As with the M2 connectors, this package never reads `process.env`
itself. The brain wiring layer resolves these names against the platform
secret store keyed by `tenant_id`. The tenant→`teamId` map for the Teams
connector is supplied via DI (`teamIdForTenant(tenantId)`) — the
connector throws `unauthorized` if the resolver returns an empty string.

### Usage (sketch)

```ts
import { JiraConnector, TeamsConnector } from "@amliq/brain-connectors";

const jira = new JiraConnector({
  baseUrl: tenantTokens.get(tenantId, "JIRA_BASE_URL"),
  tokenForTenant: (t) => tenantTokens.get(t, "JIRA_API_TOKEN"),
  authMode: "basic",
});

const teams = new TeamsConnector({
  tokenForTenant: (t) => tenantTokens.get(t, "MS_TEAMS_OAUTH_TOKEN"),
  teamIdForTenant: (t) => tenantTeamMap.get(t),
});
```

## License

Apache-2.0 (same as the rest of the AMLIQ Brain workspace).
