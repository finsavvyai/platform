# Control Hub Node Facade

Node-based UI facade for:
- channel connection (OpenClaw `/channels/*`)
- service/skills overview (OpenClaw `/services`)
- skill execution (OpenClaw `/tools/run`)
- node inspection and model load/unload actions on workers
- provider/model capability overview

## Run

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm/packages/control-hub-node
npm start
```

Open: `http://localhost:9090`

## Optional env vars

- `PORT` (default `9090`)
- `HOST` (default `127.0.0.1`; use `0.0.0.0` behind reverse proxy)
- `OPENCLAW_BASE_URL`
- `FINSAVVY_GATEWAY_URL` (default `http://localhost:8080`)
- `FINSAVVY_MASTER_URL` (default `http://localhost:8000`)
- `CONTROL_HUB_FETCH_TIMEOUT_MS` (default `15000`)
- `CONTROL_HUB_ENABLE_DOCKER_HELPERS` (default `true`; set `false` in production)
- `CONTROL_HUB_PROXY_ALLOWLIST` (comma-separated `host` or `host:port`; when set, proxy targets outside allowlist are rejected)
- `CONTROL_HUB_TRUST_PROXY` (default `false`; set `true` only when requests arrive through trusted reverse proxy)
- `CONTROL_HUB_RATE_LIMIT_ENABLED` (default `true`)
- `CONTROL_HUB_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `CONTROL_HUB_RATE_LIMIT_MAX` (default `120`)
- `CONTROL_HUB_AUDIT_LOG_ENABLED` (default `true`)
- `CONTROL_HUB_AUDIT_LOG_HEALTHZ` (default `false`; keep probe noise out of audit log)
- `CONTROL_HUB_AUDIT_LOG_FILE` (default `.../.control-hub/control-hub-audit.log`)
- `CONTROL_HUB_STATE_FILE` (default `.../.control-hub/control-hub-state.json`)
- `CONTROL_HUB_BASIC_AUTH` (`user:pass`) or `CONTROL_HUB_BASIC_USER` + `CONTROL_HUB_BASIC_PASS`

## Notes

- No CLI is required for normal operations.
- Auth can be configured from UI:
  - Bearer token
  - `X-API-Key`
  - `X-Service-Key` (+ optional `X-User-Id`)
- Facade endpoints:
  - `GET /api/healthz` (liveness, no auth, minimal payload)
  - `POST /api/facade/bootstrap`
  - `POST /api/facade/skills/list`
  - `POST /api/facade/skills/run`
  - `POST /api/facade/connect-channel`
  - `POST /api/facade/channel/test-webhook`
  - `POST /api/facade/node/inspect`
  - `POST /api/facade/node/model/load`
  - `POST /api/facade/node/model/unload`
- Local Docker helper endpoints:
  - `GET /api/local/docker/stacks`
  - `POST /api/local/docker/up` (stack: `full` or `core`, optional `openclawImage`, optional `openclawContainerPort`)
  - `POST /api/local/docker/down` (stack: `full` or `core`)
  - `POST /api/local/docker/status` (stack: `full` or `core`)
  - `full` starts `openclaw`, `master`, `worker`, `gateway` services.
  - For LunaOS forks, set `openclawContainerPort` to `8000`.
- LunaOS compatibility mode:
  - If OpenClaw endpoints like `/channels/*`, `/services`, or `/tools/*` are unavailable, facade routes automatically fall back to local compatibility behavior:
    - channels are configured against local worker webhook (`/hooks/agent`)
    - agent list/services are synthesized from local cluster capabilities
    - skill runs fall back to cluster chat completions (`gateway` or `worker`)

## Production Checklist

- Run behind HTTPS reverse proxy (Nginx/Caddy/Cloudflare Tunnel).
- Enable Control Hub auth:
  - set `CONTROL_HUB_BASIC_AUTH=<user:pass>`
- Keep direct app bind local-only and expose HTTPS through proxy.
- Enable and tune rate limits:
  - `CONTROL_HUB_RATE_LIMIT_ENABLED=true`
  - `CONTROL_HUB_RATE_LIMIT_WINDOW_MS=60000`
  - `CONTROL_HUB_RATE_LIMIT_MAX=120`
- Enable audit logging:
  - `CONTROL_HUB_AUDIT_LOG_ENABLED=true`
  - `CONTROL_HUB_AUDIT_LOG_HEALTHZ=false`
  - `CONTROL_HUB_AUDIT_LOG_FILE=<persistent-path>`
- Restrict upstream proxy targets:
  - set `CONTROL_HUB_PROXY_ALLOWLIST=localhost,127.0.0.1,localhost:11434,localhost:8080,localhost:8000`
- Disable Docker helper APIs in production:
  - set `CONTROL_HUB_ENABLE_DOCKER_HELPERS=false`
- Set `HOST=0.0.0.0` only if network exposure is required.
- Set `CONTROL_HUB_TRUST_PROXY=true` only if a trusted reverse proxy injects `X-Forwarded-For`.
- Keep state path on persistent storage:
  - set `CONTROL_HUB_STATE_FILE` to a durable path/volume.
- Use process supervision:
  - `systemd`, `pm2`, container restart policy, or Kubernetes Deployment.
- Monitor `/api/health` and alert on non-200 responses.
  - Use `/api/healthz` for unauthenticated liveness probes.

## Example Prod Run

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm/packages/control-hub-node
HOST=0.0.0.0 \
CONTROL_HUB_BASIC_AUTH=admin:change-me \
CONTROL_HUB_FETCH_TIMEOUT_MS=15000 \
CONTROL_HUB_ENABLE_DOCKER_HELPERS=false \
CONTROL_HUB_PROXY_ALLOWLIST=localhost,127.0.0.1,localhost:11434,localhost:8080,localhost:8000 \
node server.js
```

## Docker Compose (Production)

`deploy/docker-compose.yml` includes a `control-hub` service.
Use `/Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm/deploy/control-hub.env.example` as a template.

Run:

```bash
cd /Users/shaharsolomon/dev/projects/02_AI_AGENTS/llm
cp deploy/control-hub.env.example deploy/control-hub.env
## edit deploy/control-hub.env first
set -a; source deploy/control-hub.env; set +a
docker compose -f deploy/docker-compose.yml up -d --no-deps control-hub
```

Default published port: `9091` (`CONTROL_HUB_PORT` override available).

Optional TLS proxy (Caddy, profile `edge`):

```bash
docker compose -f deploy/docker-compose.yml --profile edge up -d control-hub-proxy
```

HTTPS endpoint defaults to `https://localhost:9443` (self-signed cert via Caddy internal CA).
