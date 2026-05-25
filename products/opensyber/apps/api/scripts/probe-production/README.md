# Production probe

Anonymous HTTPS smoke test for OpenSyber's live endpoints. Runs 5 requests
per endpoint (cold + 4 warm), captures latency percentiles, verifies each
response body contains a session-specific marker, and renders a markdown
dashboard.

## Usage

```sh
# from repo root
./apps/api/scripts/probe-production/run.sh
```

Output is written under `$OUT_DIR` (defaults to `/tmp/opensyber-probe/`):

```
probe.sh       — 5-run latency probe, writes results.tsv (75 rows)
assert.sh      — 14 content assertions, writes assertions.tsv
dashboard.sh   — aggregates into dashboard.md (p50/p95 + verdicts)
run.sh         — orchestrator, runs all three in order
```

## What it tests

| Layer | Endpoints | What we verify |
|---|---|---|
| Marketing | `/`, `/docs/connect-agent`, `/pricing` | Session-specific copy is live (new hero, connect docs, pricing components) |
| Web proxy | `/api/proxy/badges/*`, `/api/proxy/instances/*` | Next.js proxy routes resolve and forward correctly |
| API public | `/health`, `/api/badges/*` | D1/KV/R2 subsystems healthy, SVG badge renders |
| API ingestion | `POST /api/instances/:id/events` | Route deployed, gateway-token auth path correct |
| API owner-only | `GET /api/instances/:id/gateway-token` | Auth.js gate reachable |
| API semantic search | `/api/search/skills`, `/api/search/findings` | Vectorize routes registered |
| API attack paths | `/api/attack-paths/graph/:id` | Sprint 25 graph endpoint deployed |
| API admin traces | `/api/admin/traces/:id` | Perfetto trace endpoint reachable |

## How it works without auth

Every auth-gated route is designed to return a **distinctive error string**
when it rejects an anonymous caller. The probe greps for that string in the
response body to confirm the route is deployed. For example:

- `POST /api/instances/:id/events` → `"Missing X-Gateway-Token or X-Instance-Id header"` (from `instance-events.ts`)
- Anonymous Auth.js routes → `"Missing or invalid authorization header"` (from `middleware/auth.ts`)
- Non-existent route → `{"error":"Not found"}` (Hono default)

That three-way distinction turns an anonymous curl into a reliable "is this
route deployed" probe — the 401 body is the signature.

## Interpreting the dashboard

The dashboard surfaces four kinds of anomalies:

1. **⚠ after status code** — 5 runs did not all return the same code
   (transient errors, rate-limit tripping, or partial deploys)
2. **Content assertion FAIL** — response body doesn't contain the expected
   marker (deployment is stale or the route was removed)
3. **Warm p95 ≫ p50** — flagged as potential cold-path issues. Look for
   KV propagation, uncached external fetches, or missing `waitUntil`
4. **5xx counts** — anything non-zero is a latent production issue

## Follow-ups

- Wire `run.sh` into the pushci.yml deploy stage as a post-deploy
  verification step. If any assertion fails the deploy rolls back.
- Add a `--fail-on-regression` mode that diffs today's dashboard.md
  against a committed baseline and exits non-zero on worse numbers.
- Export results as JSON so they can be fed into a Grafana dashboard.
