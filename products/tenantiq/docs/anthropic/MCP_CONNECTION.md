# Connecting to TenantIQ from Claude clients

The TenantIQ MCP server lives at `https://api.tenantiq.app/api/mcp`. It speaks JSON-RPC 2.0 over HTTP and follows the Model Context Protocol spec (2025-06-18).

## Capabilities

- **13 tools** — 10 read (posture / drift / alerts / skills) + 3 write (acknowledge alert, acknowledge drift, apply skill template).
- **3 resources** — MSP org overview, compliance frameworks catalog, finding-shape JSON Schema.
- **6 prompts** — `onboard_tenant`, `quarterly_compliance_review`, `license_optimization_audit`, `incident_response_kit`, `explain_posture_gap`, `qbr_summary`. Each maps a natural-language ask to a structured Claude prompt + the right tool calls.
- All requests are scoped to the calling user's organization via the JWT.

## Authentication

The MCP endpoint accepts the same Bearer token the rest of the API uses. Get one by signing into the dashboard, then either:

1. **Cookie-based** (browser-issued sessions) — works directly from web Claude clients that share the `tenantiq.app` cookie domain.
2. **Bearer JWT** (recommended for Claude Desktop / Cowork) — log into [app.tenantiq.app](https://app.tenantiq.app), open DevTools → Application → Cookies → copy the `tenantiq_session` value. Use it as `Bearer <jwt>`.

## Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "tenantiq": {
      "transport": {
        "type": "http",
        "url": "https://api.tenantiq.app/api/mcp",
        "headers": {
          "Authorization": "Bearer <your-tenantiq-jwt>"
        }
      }
    }
  }
}
```

After restart, Claude Desktop will list TenantIQ tools in the tool picker. Try:

- *"List my MSP tenants and their last sync time."* → calls `list_tenants`.
- *"Show CIS posture for tenant `t-acme-prod`."* → calls `get_cis_posture`.
- *"What changed in the Acme tenant in the last 48 hours, and who did it?"* → calls `list_recent_drift` with `sinceHours=48`.
- *"Acknowledge alert `alt-xyz` on Acme."* → calls `acknowledge_alert` (write — requires admin role).

## Cowork integration

Inside a Cowork workspace, register TenantIQ as a custom MCP server with the same URL + Authorization header. Cowork passes the auth header through on every JSON-RPC call.

## Tool reference

### Read tools

| Tool | Args | Returns |
|---|---|---|
| `list_tenants` | — | every Azure tenant the org has connected |
| `get_cis_posture` | `tenantId` | latest CIS scan result (cached) |
| `get_compliance_posture` | `tenantId` | SOC 2 / HIPAA / GDPR / ISO 27001 frameworks |
| `get_intune_posture` | `tenantId` | devices + compliance + MAM policies + findings |
| `get_pim_audit` | `tenantId` | standing/eligible/active role assignments + findings |
| `get_defender_coverage` | `tenantId` | Defender XDR coverage from Secure Score |
| `list_recent_drift` | `tenantId`, `sinceHours?` | config drift events with attribution |
| `get_msp_backup_health` | — | cross-tenant backup rollup for the MSP |
| `list_open_alerts` | `tenantId`, `limit?` | open security alerts |
| `list_active_skills` | `tenantId` | active + trial skills |

### Write tools (require admin / tenant_admin / tenant_engineer)

| Tool | Args | Effect |
|---|---|---|
| `acknowledge_alert` | `tenantId`, `alertId` | marks alert as acknowledged |
| `acknowledge_drift` | `tenantId`, `driftId` | marks drift as acknowledged |
| `apply_skill_template` | `tenantId`, `templateId` | activates the skill bundle for the tenant |

### Resources

| URI | Purpose |
|---|---|
| `tenantiq://org/overview` | live org tenant list |
| `tenantiq://compliance/frameworks` | compliance catalog with control counts |
| `tenantiq://schema/finding` | JSON Schema for grounding Claude on finding shape |

## Rate limits

- Same per-IP / per-org limits as the rest of the API.
- Write tools: hardened against role escalation — verified server-side from JWT, not client-supplied.

## Long-lived MCP API keys

Generate from [/settings/api-keys](https://app.tenantiq.app/settings/api-keys). Format: `tiq_<43 char base64url>`. Plaintext is shown ONCE at creation; only the SHA-256 hash is stored. Auth middleware accepts these as `Authorization: Bearer tiq_*` and looks up the hash. Admin role required to mint or revoke. Last-used timestamp updated on each authenticated call (best-effort, async).

## Server-initiated events (SSE)

Open `GET /api/mcp` with `Accept: text/event-stream`. The server returns a long-lived SSE stream:

- `: connected` — opening comment, sent immediately
- `data: {"jsonrpc":"2.0","method":"notifications/connected","params":{...}}` — connection confirmed
- Every 10s the server polls D1 for new alerts and config drift since the connection started, and pushes each as a `notifications/message` JSON-RPC frame
- `: heartbeat` — every 30s, keeps proxies from killing the connection
- `notifications/closed` — sent before the server closes the stream after ~25 min (Worker request cap), at which point the client should reconnect

Example consumer in Node:

```ts
const res = await fetch('https://api.tenantiq.app/api/mcp', {
  headers: { Authorization: 'Bearer tiq_...', Accept: 'text/event-stream' },
});
for await (const chunk of res.body!) {
  for (const frame of new TextDecoder().decode(chunk).split('\n\n')) {
    if (frame.startsWith('data: ')) {
      const msg = JSON.parse(frame.slice(6));
      if (msg.method === 'notifications/message') console.log(msg.params);
    }
  }
}
```

## Roadmap

- **Pub/sub fan-out via Durable Objects** — replace the 10s D1 poll with sub-second event delivery. Wire format unchanged.
- **Signed-prompt resources** for tenant-specific prompt templates (e.g. "summarize this tenant's last 30d for a QBR").

## Source

Implementation: `apps/api/src/routes/mcp.ts` + `mcp-tools.ts` + `mcp-resources.ts`. 13 unit tests in `mcp.test.ts`. Spec compliance against [modelcontextprotocol.io](https://modelcontextprotocol.io/specification).
