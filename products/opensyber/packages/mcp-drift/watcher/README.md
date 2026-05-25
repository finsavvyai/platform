# mcp-drift-watcher

Cross-session drift watcher for MCP servers. Hono on Cloudflare Workers, Drizzle ORM over D1.

## Endpoints

| method | path | body | returns |
|---|---|---|---|
| GET | `/health` | – | `{ ok: true, service, env }` |
| POST | `/scan` | `{ serverUrl: string }` | `{ serverUrl, alerts: DriftAlert[] }` |

`DriftAlert.verdict` is one of `unchanged`, `first-seen`, `version-bump`, `suspicious-injection`.

## Persistence

`tool_fingerprints` (latest per `(server_url, tool_name)`) + `fingerprint_history` (append-only). Survives across runs, restarts, and process boundaries — that is the entire point.

## Demo (HTTP)

```bash
pnpm install
pnpm --filter @opensyber/mcp-drift-watcher db:migrate:local
pnpm --filter @opensyber/mcp-drift-watcher demo
```

Boots the HTTP rugpull server, boots `wrangler dev --local` with a real D1 (miniflare-backed), runs `/scan` 3 times against it. Run 3 returns `verdict: "suspicious-injection"` with a description diff.

## Demo (stdio, no wrangler)

```bash
pnpm install
pnpm --filter @opensyber/mcp-drift-watcher demo:stdio
```

Same engine, stdio transport, in-memory store. Proves the differ + classifier work identically whether the MCP server is local-subprocess or remote-HTTP.

## Deploy

```bash
wrangler d1 create mcp-drift                      # capture the returned id
# edit wrangler.toml database_id with the real value
pnpm --filter @opensyber/mcp-drift-watcher db:migrate
pnpm --filter @opensyber/mcp-drift-watcher deploy
```
