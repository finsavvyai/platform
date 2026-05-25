# AMLIQ MCP for Claude Cowork — Operator Runbook

## What this gives you

Claude Cowork agents (financial-services analysts, compliance reviewers) can call AMLIQ as an **MCP tool** — sanctions screening, PEP checks, SAR generation, case creation — without leaving the Cowork workspace.

## What this does NOT give you

**This is not a transparent compliance gateway for Cowork.** Cowork's own LLM reasoning runs on Anthropic infrastructure and cannot be intercepted from your network. What this _does_ is make AMLIQ data + actions callable as tools the Cowork agent invokes explicitly.

| Surface | Covered? |
|---|---|
| Cowork agent calls AMLIQ tool → tool uses AMLIQ DB + screening | **Yes** — full DLP through sdlc.cc on the tool side |
| Cowork agent's general reasoning (no tool call) | **No** — flows direct to Anthropic, not scrubbed |
| Tool input arguments leaving Cowork | **No** — Anthropic sees the raw `arguments` object before it reaches your MCP server |

For full DLP coverage of Cowork-bound prompts, see `BROWSER_EXTENSION.md` (planned) or restrict regulated workflows to Claude Code + `ANTHROPIC_BASE_URL=https://api.sdlc.cc`.

## Prereqs

- AMLIQ deployed; `cmd/mcp-server` binary available
- Inbound HTTPS reachable from Cowork (Anthropic's egress, not your corp net)
- A long-lived bearer token, generated however you generate secrets
- DNS/certificate pointing at the MCP endpoint

## Deploy

### 1. Generate a bearer

```bash
openssl rand -base64 32
# → store as MCP_BEARER in your secret manager
```

### 2. Run the MCP server in HTTP mode

```bash
MCP_HTTP_PORT=8443 \
MCP_BEARER=$MCP_BEARER \
./mcp-server
```

The server logs `AMLIQ MCP Server starting (HTTP transport :8443)` on success. Stdio mode (the Claude Code/Desktop default) is still available when `MCP_HTTP_PORT` is unset.

### 3. Front it with TLS

Cowork requires `https://`. Behind nginx / Cloudflare / ALB:

```nginx
server {
  listen 443 ssl http2;
  server_name mcp-amliq.your-domain.com;
  location / {
    proxy_pass http://127.0.0.1:8443;
    proxy_set_header Host $host;
    proxy_read_timeout 60s;
  }
}
```

### 4. Verify directly

```bash
curl -X POST https://mcp-amliq.your-domain.com/mcp \
  -H "Authorization: Bearer $MCP_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expect 8 tools: `screen_entity`, `screen_fast`, `check_pep`, `search_enforcement`, `get_adverse_media`, `create_case`, `generate_sar`, `batch_screen`.

A bad/missing bearer returns `401`. `GET` returns `405`. Both verified by `transport_http_test.go`.

## Register with Cowork

In the Cowork admin console (or per the current Anthropic admin docs):

1. **Settings → MCP servers → Add server**
2. Endpoint: `https://mcp-amliq.your-domain.com/mcp`
3. Auth: Bearer token = your `MCP_BEARER`
4. Name: `AMLIQ Compliance`
5. Scope: workspace-wide (or limit to specific agent personas)

Cowork issues an MCP `initialize` handshake; success means tools become visible in agent prompts.

## Sample agent prompts

```
You are a financial crimes analyst. Use the AMLIQ tools when you need
to verify counterparties, escalate suspicious activity, or file reports.
Always start a workflow by screening the counterparty:

  screen_entity(name: "Acme Holdings BV", entity_type: "company", country: "NL")

If a hit returns confidence > 0.7, create a case:

  create_case(entity_name: "Acme Holdings BV", matched_name: "<from screen_entity>",
              list_id: "<source>", confidence: <number>, priority: "high")

For confirmed sanctions matches, generate a SAR:

  generate_sar(case_id: "<from create_case>", format: "fincen",
               institution: "<your institution>")
```

## Auth + audit

- `MCP_BEARER` is constant-time compared (no timing oracle)
- Every tool call is logged on the AMLIQ side via the existing `task_log` table — surface in your AML console
- Rotate the bearer by setting a new value and bouncing the pod; old token invalidates immediately

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Cowork shows MCP server "unavailable" | TLS cert chain | check upstream cert reaches a CA Anthropic trusts |
| `401` on every call from Cowork | Bearer mismatch | re-paste; trim trailing whitespace |
| `405 Method Not Allowed` | GET against `/mcp` | only POST is accepted (per MCP spec) |
| Tools list comes back empty | Auth bypass with no `MCP_BEARER` set + endpoint open to internet | always set the bearer in any environment Cowork can reach |
| Tool calls succeed but no row in `task_log` | DB connection issue inside AMLIQ | check `cmd/mcp-server` env for AMLIQ DB credentials |

## What ships with this

- `cmd/mcp-server/transport_http.go` — HTTP transport (commit `436168d`)
- `cmd/mcp-server/transport_http_test.go` — bearer + method tests
- 8 tools in `tools.go` — schemas already MCP-compliant
- This document

## Limitations to set with stakeholders

- **Cowork's underlying reasoning isn't scrubbed by this integration.** State this explicitly in your compliance attestation.
- Tool arguments + results pass through Anthropic's infrastructure on their way back to the Cowork user. Treat them like outbound API traffic.
- For PII-bearing prompts that must never reach Anthropic, use Claude Code with `ANTHROPIC_BASE_URL=https://api.sdlc.cc` instead.
