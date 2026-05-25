# Cloudflare deployment — @finsavvyai/ai-gateway

Reproducible deploy of the `finsavvy-ai-gateway` Worker to **staging** and
**production**. Built on Cloudflare Workers + KV + D1 + R2 + Logpush.

## Accounts

Two options, both supported by the same `wrangler.toml`:

1. **Recommended (separate accounts).** One Cloudflare account per env
   (`finsavvy-staging` + `finsavvy-prod`). Hard isolation of billing, secrets,
   and blast radius. Switch via `CLOUDFLARE_ACCOUNT_ID` or `wrangler login`
   per shell.
2. **Single account, named envs.** Use `[env.staging]` / `[env.production]`
   in `wrangler.toml`. Cheaper, weaker isolation. Acceptable for solo dev
   only; **not** acceptable for handling real customer data in production.

Authenticate once per account:
```bash
wrangler login                              # interactive OAuth
# or, for CI:
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
```

The required API token scopes are: `Workers Scripts:Edit`,
`Workers KV Storage:Edit`, `Workers R2 Storage:Edit`, `D1:Edit`,
`Account Logs:Edit`, `Zone:Read` (only if attaching custom routes).

## Provisioning (one-time per env)

Run `./setup.sh` from the repo root. It is idempotent — re-runs are safe and
skip already-created resources. Required env vars:

```bash
CF_ACCOUNT_ID=<account_id>
CF_API_TOKEN=<token_with_scopes_above>
ENV=staging   # or production
./infrastructure/cloudflare/setup.sh
```

The script provisions, then prints the IDs to paste into `wrangler.toml`:

| Resource | Name | Where to paste |
|---|---|---|
| KV namespace | `finsavvy-rate-limit-<env>` | `[[env.<env>.kv_namespaces]]` `id` |
| KV namespace | `finsavvy-response-cache-<env>` | `[[env.<env>.kv_namespaces]]` `id` |
| D1 database | `finsavvy-ai-gateway-<env>` | `[[env.<env>.d1_databases]]` `database_id` |
| R2 bucket | `finsavvy-audit-<env>` | `[[env.<env>.r2_buckets]]` `bucket_name` |

Manual commands (equivalent to what `setup.sh` runs):

```bash
wrangler kv:namespace create RATE_LIMIT_KV --env staging
wrangler kv:namespace create RESPONSE_CACHE_KV --env staging
wrangler d1 create finsavvy-ai-gateway-staging
wrangler r2 bucket create finsavvy-audit-staging
```

## Migrations

The gateway primitive is stateless. `migrations/` is intentionally empty (see
`packages/ai-gateway/migrations/README.md`). When a future feature requires
D1 schema, add forward-only `NNNN_*.sql` and apply with:

```bash
wrangler d1 migrations apply finsavvy-ai-gateway-staging --env staging
```

## Secrets

Never commit secret values. Set them per env:

```bash
wrangler secret put JWT_PUBLIC_KEY              --env staging
wrangler secret put STRIPE_WEBHOOK_SECRET       --env staging
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --env staging
wrangler secret put FINSAVVY_AUDIT_DD_API_KEY   --env staging   # only if AUDIT_SINK=datadog
```

Repeat with `--env production`. The full secret manifest lives in
`secrets.example.env` (names + provenance, no values).

## Deploy

Staging is a single-step deploy. Production uses **gradual rollout** to keep
blast radius small:

```bash
# Staging — full deploy
pnpm --filter @finsavvyai/ai-gateway run deploy:staging

# Production — 5% gradual rollout, then promote after metrics look healthy
pnpm --filter @finsavvyai/ai-gateway run deploy:prod
# Verify health + alerts for >=10 min, then promote to 100%:
wrangler versions deploy --percentage 100 --env production
```

Health check after each deploy:
```bash
curl -fsS https://ai-gateway.staging.finsavvy.ai/health | jq .
# Expect: { status: "ok", version: "<sha>", uptime_s: N, checks: [...] }
```

## Rollback

Cloudflare retains the last 10 deployed versions. To roll back:

```bash
wrangler versions list --env production
wrangler rollback <version-id> --env production
```

If a D1 migration was part of the bad deploy, do **not** roll back code
before evaluating data state — round-2 migration conventions are
forward-only. Open an incident, then ship a corrective migration.

## Local dev

```bash
pnpm --filter @finsavvyai/ai-gateway run dev
# Runs wrangler dev --local with miniflare-backed KV/D1/R2.
# /health responds from the local boot time.
```

## Logpush

Worker logs + Tail Worker output ship to R2 via the job in `logpush.json`.
Create it once per env:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/logpush/jobs" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @infrastructure/cloudflare/logpush.json
```

## Cross-agent contracts honored

- **Health endpoint shape (§1):** `{ status, version, uptime_s, checks: [{name, status}] }`.
  Implemented in `packages/ai-gateway/src/worker.ts`, intercepting `/health`
  before the edge handler.
- **Audit env vars (§2):** `FINSAVVY_AUDIT_SINK`, `FINSAVVY_AUDIT_R2_BUCKET`,
  `FINSAVVY_AUDIT_DD_API_KEY` — wired in `wrangler.toml` per env.
- **Worker name prefix (§5):** `finsavvy-ai-gateway-staging` and
  `finsavvy-ai-gateway-production`.
