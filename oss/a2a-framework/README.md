# a2a-framework

A2A (Agent-to-Agent) reference implementation by FinsavvyAI.

## What this is

A working reference implementation of the [A2A protocol](https://github.com/google/A2A) — Google's published agent-interop standard for communication between autonomous AI agents.

Multi-transport: JSON-RPC over HTTP / WebSocket / SSE / stdio. Google ADK handler. Agent-card generation.

## Why it exists

A2A is becoming the lingua franca for agent interop. A working multi-transport reference impl is high-leverage OSS:
- Every developer searching "A2A framework Python" lands on this repo
- Adoption is a leading indicator for the broader FinsavvyAI stack

## Position in the stack

- **OSS** — Apache-protocol, MIT-licensed implementation
- **Intended integration (not yet wired)** — A2A is the planned wire protocol for orchestrated agents in [LunaOS](../../products/lunaos/), with [OpenSyber](../../products/opensyber/) inspecting A2A traffic for runtime security and [SDLC.cc](../../products/sdlc-cc/) recording A2A calls as compliance evidence. As of June 2026 no product imports this framework — these are roadmap targets, not shipped integrations.

## Surface

| Sub-project | Language | Role |
|---|---|---|
| `a2a-server/` | Python | Reference server |
| `a2a-server/` (TS variant) | TypeScript | Reference server (Node) |
| `a2a-cli/` | — | Developer CLI |
| `a2a-agent-record/` | — | Recording + replay for agent conversations |
| `src/` | TS | Core types + client |

## Status

Active development. Last commit 2026-05-13. Readiness 55% (BUILD category) per `CLAUDE.md` — see internal punch list.

## License

MIT — see `LICENSE`. Same license as PipeWarden for OSS-stack consistency.

## Contributing

PRs welcome. CLA TBD.
