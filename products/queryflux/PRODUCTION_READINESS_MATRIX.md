# Production readiness matrix (machine-verifiable gates)

Use this table for release promotion. Each gate should be enforced in CI where noted.

| Component | Build | Unit tests | Secret scan | Deploy config | Notes |
|-----------|-------|------------|-------------|---------------|-------|
| `queryflux-backend/` | `go build -o /tmp/qf ./cmd/api` | `go test ./...` | CI `scripts/ci-verify-paths-and-secrets.sh` | Dockerfile, env vars | Postgres-only MVP; `ENCRYPTION_KEY` required in production |
| app root | `npm ci && npm run build:web` | `npm test` | CI script | [`docker-compose.yml`](docker-compose.yml) | Root React/Vite app and Node server |
| `querylens-api/` | `mvn -q -DskipTests package` | `mvn test` | same | Dockerfile, `application.yml` | Optional `QUERYLENS_API_KEY` protects HTTP API |
| `queryflux-mcp-server/` | `npm ci && npm run build` | `npm test` (if present) | same | package scripts | MCP stdio server |
| `querylens-vectorize-worker/` | `npm ci` | — | same | `wrangler.toml` | Optional `VECTORIZE_INGRESS_SECRET` for caller auth |
| `sdlc-ai/` | per-package | workflows in `sdlc-ai/.github/workflows` | fix broken path refs separately | — | Some workflows reference missing paths; gate blocks promotion until fixed |

## Required environment (production)

| Variable | Service | Required when |
|----------|---------|-----------------|
| `DATABASE_URL` | queryflux-backend | always |
| `JWT_SECRET` | queryflux-backend | `ENVIRONMENT=production` |
| `ENCRYPTION_KEY` | queryflux-backend | `ENVIRONMENT=production` (32+ bytes recommended) |
| `QUERYLENS_API_KEY` | querylens-api | recommended in production |
| `VECTORIZE_INGRESS_SECRET` | vectorize worker + QueryLens | optional pair; when set, QueryLens sends `X-Vectorize-Ingress-Secret` |

## CI gates (PushCI)

Pipeline: `pushci.yml`

1. Verify referenced deploy paths exist (`queryflux-backend/cmd/api/main.go`, compose prometheus mount).
2. Block high-risk patterns in tracked files (example: `sk-` OpenAI keys, literal `JWT_SECRET=` assignments in shell deploy scripts — use env-driven secrets).
3. `go test ./...` in `queryflux-backend`.
4. `mvn test` in `querylens-api`.

## Game day (manual, once per major release)

See [docs/PRODUCTION_GAME_DAY.md](docs/PRODUCTION_GAME_DAY.md).
