# Shared Product Contract

The shared QueryFlux product contract lives in `src/contracts/`.

It defines the first stable API and data model boundary for the vibecoding-era product:

- Workspaces and members.
- Database connection references.
- Environment-aware schema snapshots.
- Natural-language query intents.
- Safe query execution requests.
- Generated backend artifacts.
- Agent profiles and permissions.
- Human and agent audit events.
- Route definitions for web, desktop, mobile, and MCP.

## Client Responsibilities

### Web

The web app consumes the full contract:

- Workspace onboarding.
- Team and account management.
- Cloud connection management.
- Schema explorer.
- QueryLens natural-language query flow.
- Generated backend artifacts.
- Agent permission profiles.
- Audit logs.

### Desktop

The desktop app consumes the same workspace, schema, query, and artifact contracts, but can provide local/private execution through Tauri IPC:

- Local/private database connection references.
- OS credential storage.
- SSH tunnel support.
- Safe query execution.
- Generated backend artifacts.

### Mobile

The mobile app intentionally consumes a constrained subset:

- Workspaces.
- Connection health.
- Read-only query execution.
- Alerts and approvals.
- Audit visibility where needed.

Mobile should not generate SQL or backend artifacts in the first product slice.

### MCP

The MCP server consumes the agent contract:

- Agent profiles.
- Scoped permissions.
- Schema inspection.
- Query generation.
- Read-only query execution.
- Artifact generation.
- Safety checks.
- Audit events for every tool call.

## Safety Defaults

The contract encodes the product safety model:

- Query execution mode is either `readonly` or `approved-write`.
- Operation risk is `safe`, `review`, or `dangerous`.
- Agent permissions are explicit enum values.
- Agent tool calls use `agent` auth, not normal user auth.
- Mobile can execute through the shared query endpoint, but does not generate SQL or artifacts.

## Implementation Notes

The contract is currently TypeScript/Zod-first because the React web app, Tauri renderer, mobile client, and MCP server all need TypeScript-compatible shapes.

Backend handlers should map these objects to Go domain models as endpoints are implemented. Once the backend route set stabilizes, generate OpenAPI from this contract or mirror it with an OpenAPI file used by Go and TypeScript clients.
