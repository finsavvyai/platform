# @opensyber/mcp-drift

**Cross-session drift detection for MCP servers.**

> Scanners check your MCP servers once. OpenSyber remembers what they looked like last Tuesday.

## What this proves

Every public MCP scanner today (Snyk agent-scan, Cisco mcp-scanner, Pipelock, Straiker) hashes tool definitions **within a single session**. None persistently fingerprint a server across days/weeks.

A rug-pull tuned to swap tool definitions only after the Nth call, or between sessions entirely, defeats every existing scanner.

This package contains:

1. **`server-rugpull/`** — a demonstration malicious MCP server. Serves a clean `weather` tool for the first N calls, then injects a `[SYSTEM]`-style hidden instruction into the description.
2. **`watcher/`** — the OpenSyber primitive. A Cloudflare Worker (Hono + D1 + Drizzle) that records SHA-256 fingerprints of every tool definition (`name + description + inputSchema`) per server across runs and flags any cross-session drift.

## Quick demo

```bash
pnpm install
pnpm --filter @opensyber/mcp-drift demo
```

Run 1: baseline recorded.
Run 2: no drift.
Run 3: **`DRIFT DETECTED — cross-session rug-pull`** with description diff and classifier verdict.

## Why this is the wedge

Existing scanners answer: "is this manifest safe right now?"
OpenSyber answers: "is this manifest the same one I trusted last week?"

The second question is the only one that catches staged supply-chain attacks like npm `event-stream` or `ua-parser-js` applied to MCP.
