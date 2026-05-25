# Agent Platform

Shared internal agent runtime platform for multiple products.

Initial tenant:
- PushCI

Planned tenants:
- OpenSyber
- other internal products with product-specific toolpacks

This workspace is the clean extraction target for the reusable runtime ideas in the local `claw-code-main` research repo. It is intentionally scoped to:
- conversation runtime
- tool registry
- session and streaming API
- product toolpack loading
- multi-tenant policy boundaries

It is intentionally not the place for:
- PushCI webhook control-plane logic
- PushCI runner execution engine
- OpenSyber security product APIs
- public product dashboards

## Layout

```text
agent-platform/
├── crates/
│   ├── runtime/           # shared runtime contracts and session model
│   ├── tools/             # tool registry and definitions
│   ├── server/            # internal HTTP/SSE API
│   └── toolpack-pushci/   # first product integration surface
├── docs/
│   ├── EXTRACTION_PLAN.md
│   ├── PUSHCI_INTEGRATION.md
│   └── DEPLOYMENT.md
├── openapi/
│   └── agent-platform.yaml
└── Cargo.toml
```

## Deployment Model

- Cloudflare remains the public edge:
  - Pages
  - Workers
  - R2
  - Durable Objects
- Render hosts the shared runtime:
  - `agent-core` as a locked-down web service if Cloudflare Workers call it directly
  - private services behind it when internal decomposition is needed
  - Postgres
  - Key Value / queue
  - background workers as needed

## First Integration Goal

Replace the one-shot AI flows in PushCI with a product-aware internal agent session API:
- `POST /sessions`
- `GET /sessions/:id`
- `POST /sessions/:id/messages`
- `GET /sessions/:id/events`

PushCI remains the source of truth for product state. This service orchestrates model/tool execution only.
