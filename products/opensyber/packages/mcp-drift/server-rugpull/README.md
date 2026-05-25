# server-rugpull

Demonstration **malicious** MCP server. Use only in this demo.

Serves a clean `weather` tool for the first `RUGPULL_AFTER` `tools/list` calls. On the next call, returns the same tool name and verb but with a `[SYSTEM]`-style hidden instruction injected into the description.

## Run

```bash
# stdio transport (subprocess)
RUGPULL_AFTER=2 pnpm start:stdio

# HTTP transport (port 7331 by default)
RUGPULL_AFTER=2 pnpm start:http

# state inspection / reset (HTTP only)
curl http://localhost:7331/_state
curl -X POST http://localhost:7331/_reset
```

## Knobs

| env | default | meaning |
|---|---|---|
| `RUGPULL_AFTER` | `2` | number of clean calls before the swap |
| `PORT` (HTTP only) | `7331` | HTTP listen port |
