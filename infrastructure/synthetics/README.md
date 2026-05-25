# @finsavvyai/synthetics

Black-box synthetic probes that hit the real deployed services every 5 minutes.
Probes are pure-Node ESM scripts. They do **not** import any internal
`@finsavvyai/*` package — they behave like external customers.

The runner emits results that conform to round-3 cross-agent contract §3
(`{ probe, ok, latency_ms, ts, error? }`), which the ALERTING agent consumes.

## Running locally against staging

```bash
cd infrastructure/synthetics
pnpm install                          # or npm install — vitest only
export FINSAVVY_STAGING_URL="https://finsavvy-ai-gateway-staging.workers.dev"
export FINSAVVY_SYNTHETIC_JWT="$(op read op://finsavvy/synthetic-jwt/token)"
export STRIPE_WEBHOOK_TEST_SECRET="$(op read op://finsavvy/stripe-test/whsec)"
export LEMONSQUEEZY_WEBHOOK_TEST_SECRET="$(op read op://finsavvy/ls-test/whsec)"
node run.mjs --target staging
```

Run a single probe:

```bash
node run.mjs --target staging --probe health
```

Production:

```bash
export FINSAVVY_PROD_URL="https://api.finsavvy.ai"
node run.mjs --target production
```

Output: one JSON line per probe to stdout, plus `results.jsonl` artifact.
Exit code `0` if every probe passed, `1` if any failed, `2` for runner-config
errors (bad target, missing env, no probes matched).

## Required env vars

| Var                                 | Used by                       | Purpose                                  |
|-------------------------------------|-------------------------------|------------------------------------------|
| `FINSAVVY_STAGING_URL`              | runner (target=staging)       | Worker base URL for staging              |
| `FINSAVVY_PROD_URL`                 | runner (target=production)    | Worker base URL for production           |
| `FINSAVVY_SYNTHETIC_JWT`            | gateway-route, gateway-cache-hit, auth-jwt, rate-limit | Bearer token for a synthetic tenant. Must be valid (signed HS256, not expired). |
| `STRIPE_WEBHOOK_TEST_SECRET`        | stripe-webhook                | Webhook signing secret for the synthetic Stripe endpoint. |
| `LEMONSQUEEZY_WEBHOOK_TEST_SECRET`  | lemonsqueezy-webhook          | Webhook signing secret for the synthetic LS endpoint. |
| `FINSAVVY_PROBE_TIMEOUT_MS`         | all probes                    | Optional override of the 10s default per-request timeout. |

The synthetic JWT must belong to a tenant flagged `synthetic=true` so its
quota usage and audit lines can be filtered out of customer dashboards.

## Adding a new probe

1. Create `probes/<name>.mjs`.
2. Export `name: string` and `async function run(ctx): Promise<Result>`.
3. Use only `_lib.mjs` helpers (`fetchWithTimeout`, `result`, `assert`,
   signing helpers, `now`). Do **not** import `@finsavvyai/*`.
4. Return the contract shape via `result(name, ok, startMs, error?)`.
5. Add any new context fields to `buildContext()` in `run.mjs` and document
   the env var in the table above.
6. The runner picks up the file automatically on next invocation — no
   registry to update. Files prefixed `_` and ending in `.test.mjs` are
   skipped.

Skeleton:

```js
import { assert, fetchWithTimeout, now, result } from "./_lib.mjs";
export const name = "my-probe";
export async function run({ baseUrl, timeoutMs = 10_000 }) {
  const start = now();
  try {
    const r = await fetchWithTimeout(`${baseUrl}/...`, {}, timeoutMs);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    return result(name, true, start);
  } catch (err) {
    return result(name, false, start, err?.message ?? String(err));
  }
}
```

## CI integration (synthetic.yml)

CI agent owns `.github/workflows/synthetic.yml`. It runs this runner on a
5-minute cron, separately for staging and production, with the env vars
above injected from GitHub Actions secrets. The workflow:

1. Checks out the repo.
2. Sets up Node 20.
3. `cd infrastructure/synthetics && pnpm install`
4. `node run.mjs --target <env>` (exits non-zero on probe failure).
5. Uploads `results.jsonl` as a workflow artifact.
6. On non-zero exit, opens (or updates) a GitHub Issue titled
   `synthetic failure: <env> <probe>` with the failing JSON line in the body.
   Auto-closes the issue on the next successful run.

ALERTING agent's pipeline parses the same `results.jsonl` artifact (and tails
the workflow run logs in realtime) to route to PagerDuty / Slack per the
contract §3 schema.

## Probes shipped

| Probe                  | What it asserts                                                       |
|------------------------|-----------------------------------------------------------------------|
| `health`               | `GET /health` → 200 + contract §1 shape + `status === "ok"`.          |
| `gateway-route`        | `POST /v1/complete` → 200 + valid response body with token counts.    |
| `gateway-cache-hit`    | Same prompt twice → second response `cached:true`, `tokens.input=0`.  |
| `stripe-webhook`       | Signed synthetic Stripe webhook → 200 + audit correlation echo header. |
| `lemonsqueezy-webhook` | Signed synthetic LS webhook → 200 + audit correlation echo header.    |
| `auth-jwt`             | Expired JWT → 401; valid JWT → 200.                                   |
| `rate-limit`           | 100-request burst → tail contains `429` responses.                    |

## Local test suite

```bash
cd infrastructure/synthetics
pnpm test
```

Tests cover the contract shape produced by `result()` and the Stripe + LS
signing helpers. They do **not** hit the network — probe `run()` functions
are validated end-to-end only against real environments.
