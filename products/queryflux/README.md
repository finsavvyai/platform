# QueryFlux

**The AI-native database workspace for builders shipping apps with agents.**

QueryFlux is the data layer of the FinsavvyAI ecosystem. As developers ship more code authored by AI agents, those agents need a safe, observable, governed way to talk to a database. QueryFlux is that surface.

> Upstream README preserved as `README.source.md`.

## Position in the ecosystem

| Layer | Product |
|---|---|
| Code validation | PushCI |
| **Data tier for AI apps** | **QueryFlux** |
| Runtime QA | Qestro |
| Orchestration | LunaOS |
| Runtime AI security | OpenSyber |
| Governance | SDLC.cc |
| AML investigations | AMLIQ |
| M365 governance | TenantIQ |

Sits early in the dev adoption funnel: Cursor → PushCI → **QueryFlux** → Qestro → OpenSyber → SDLC.cc.

## Surface

Web (`web/`), Website (`website/`), Desktop (`desktop/`), Mobile (`mobile/`), MCP server (`mcp-server/`), Editor + AI extensions (`extensions/`: VSCode, OpenAI app, Gemini functions), Cloudflare Workers (`workers/`) + D1, QueryLens (`lens/`), Go backend (`backend/`).

Desktop runtime: Tauri (Electron archived 2026-05-29).

## Status

Actively shipping. Recent: SSO, Subscriptions, Security Hardening (Tasks 11.x, 13.x merged within last week).

## Build / test

Source tree carries its own toolchain. NOT in canonical pnpm workspace yet (dep graph conflicts with vitest 1.6 / vite 5 at root). Run from `products/queryflux/` directly.

## Integration opportunities

`@finsavvyai/auth`, `billing`, `telemetry`, `policy-engine`, `ai-gateway` — deferred; see `CONSOLIDATION_TODO.md`.

## License

See `LICENSE` (preserved from source).
