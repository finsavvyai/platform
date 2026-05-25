# SDLC Gateway

> **Production-grade multi-tenant gateway in Go.** Tiered Redis rate limiting, device fingerprint enforcement, SCIM 2.0 user provisioning, Redis pub/sub event publishing — Apache-2.0, no telemetry, runs anywhere.

[![Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Go Reference](https://pkg.go.dev/badge/github.com/finsavvyai/sdlc-gateway.svg)](https://pkg.go.dev/github.com/finsavvyai/sdlc-gateway)
[![Go Report Card](https://goreportcard.com/badge/github.com/finsavvyai/sdlc-gateway)](https://goreportcard.com/report/github.com/finsavvyai/sdlc-gateway)

---

## Why this exists

Most "API gateway" projects either lock the multi-tenant pieces behind a paid tier (Kong, Tyk) or punt rate limiting and SCIM entirely (Caddy, Traefik). The OSS layer of [sdlc.cc](https://sdlc.cc) ships the four primitives every B2B SaaS rebuilds from scratch:

1. **Tier rate limiting** — per-minute, per-hour, per-day, concurrent, payload-size, tier-aware (free/starter/pro/enterprise) — Redis-backed, fail-open.
2. **Device fingerprinting** — IP + UA + Accept-* + CH-UA + TLS cipher → SHA-256, with stable-signal validation.
3. **SCIM 2.0** — RFC 7643/7644 Users endpoint (Create, Read, Search, PATCH PatchOp, PUT replace, Delete) for Okta / Azure AD / JumpCloud.
4. **Event publishing** — Redis pub/sub with tenant-scoped channels and back-pressure metrics.

If you're building B2B and you've ever pasted a Lua rate-limit script into nginx config to ship a feature: this is for you.

---

## 5-minute quickstart

### Docker Compose

```bash
git clone https://github.com/finsavvyai/sdlc-gateway && cd sdlc-gateway
docker compose -f examples/docker-compose/docker-compose.yml up
```

Gateway listens on `:8080`, Redis on `:6379`. SCIM Users live at `/scim/v2/Users`.

### Smoke test

```bash
# Healthcheck
curl localhost:8080/healthz

# Provision a user via SCIM
curl -X POST localhost:8080/scim/v2/Users \
  -H "X-Tenant-ID: acme" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "alice@acme.test",
    "active": true
  }'

# Hit a rate-limited endpoint
for i in {1..40}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-Tenant-ID: acme" -H "X-Tenant-Tier: free" \
    localhost:8080/healthz
done
# → first 30 → 200, then 429 with Retry-After header
```

### Run the binary directly

```bash
go install github.com/finsavvyai/sdlc-gateway/cmd/server@latest
REDIS_HOST=localhost server
```

---

## Configuration

All config via environment variables — no config files, no surprises:

| Variable           | Default | Notes                                       |
|--------------------|---------|---------------------------------------------|
| `LISTEN_ADDR`      | `:8080` | HTTP listen address                         |
| `REDIS_HOST`       | _empty_ | Empty disables rate limit + events (no-op)  |
| `REDIS_PORT`       | `6379`  |                                             |
| `REDIS_PASSWORD`   | _empty_ |                                             |
| `REDIS_DB`         | `0`     |                                             |

Tier thresholds are baked in but overridable at runtime via `TierRateLimiter.SetTierConfig`. Defaults:

| Tier         | req/min | req/hour | req/day  | burst | concurrent | payload  |
|--------------|---------|----------|----------|-------|------------|----------|
| free         | 30      | 500      | 5,000    | 10    | 2          | 5 MB     |
| starter      | 120     | 5,000    | 50,000   | 30    | 5          | 25 MB    |
| professional | 600     | 30,000   | 300,000  | 100   | 20         | 100 MB   |
| enterprise   | 3,000   | 150,000  | 1.5M     | 500   | 100        | 500 MB   |

---

## Module reference

| Package | What it does |
|---------|--------------|
| [`internal/ratelimit`](internal/ratelimit) | `TierRateLimiter` — Redis pipeline INCR + EXPIRE per minute/hour/day window, concurrent counter with safety TTL, chi-compatible middleware. |
| [`internal/fingerprint`](internal/fingerprint) | `Signals.Hash()` — SHA-256 over normalized client signals; middleware with optional `Validator` and `RequireStable` enforcement. |
| [`internal/scim`](internal/scim) | RFC 7643/7644 Users handler. PATCH parses the `PatchOp` envelope; PUT does full-replace. Pluggable `Store` interface. |
| [`internal/events`](internal/events) | Redis pub/sub publisher with tenant-scoped channel `sdlc:events:{tenant_id}`, dropped-message counter for SOC2 CC7 monitoring. |
| [`internal/redisclient`](internal/redisclient) | One-line Redis client builder with empty-host no-op. |
| [`internal/memstore`](internal/memstore) | In-memory `scim.Store` for dev. Production uses your DB. |

---

## Production deployment

- **Helm**: `deployments/helm/` — values include Redis sub-chart, NetworkPolicy, PDB, HPA on RPS.
- **Cloudflare Worker recipe**: `deployments/cloudflare-worker/` — front the gateway with Workers for global anycast.
- **Kubernetes**: `examples/kubernetes/` — bare manifests if you don't want Helm.

---

## What's not in this OSS repo

We intentionally separate the OSS gateway from the [sdlc.cc](https://sdlc.cc) hosted enterprise platform:

| In OSS (this repo) | In hosted enterprise |
|--------------------|----------------------|
| Rate limiting, fingerprint, SCIM, events | DLP / PII detection (Presidio) |
| Redis backend | Postgres + RLS + audit logs |
| In-memory dev store | OPA policy engine |
| Helm + Worker recipes | RAG pipeline (pgvector + Qdrant) |
| | LLM gateway (multi-provider routing) |
| | SOC2 Type II compliance reports |
| | Hosted dashboard, support, SLA |

The OSS gateway is a complete, useful tool — not a teaser. See [COMPARISON.md](COMPARISON.md) for how this stacks against Portkey, Helicone, Kong, Tyk.

---

## Contributing

PRs welcome. Conventions:

- 200-line file cap. Split by responsibility.
- Tests use `miniredis` — no live Redis required for `go test ./...`.
- `go vet ./...` and `golangci-lint run` clean before merge.
- Coverage gate: ≥90% line, ≥85% branch.

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

Apache-2.0. Use it commercially, modify it, redistribute it. Keep the LICENSE file.
