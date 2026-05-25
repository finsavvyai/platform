# Cloudflare Worker recipe

Front your `sdlc-gateway` origin with a Cloudflare Worker for global anycast, DDoS, and WAF — while preserving the per-tenant rate-limit semantics enforced at origin.

## Deploy

```bash
npm install -g wrangler
cp wrangler.toml.example wrangler.toml  # if needed
wrangler deploy
```

## Configure

Edit `wrangler.toml`:

- `ORIGIN_URL` — internal URL of your `sdlc-gateway` deployment.
- `TIER_BY_KEY` (optional) — Workers KV namespace mapping `apiKey -> {tenantID, tier}`. Bind it with `wrangler kv:namespace create TIER_BY_KEY`.

## How it works

1. Request hits the Worker with `Authorization: Bearer <key>`.
2. Worker resolves the key to `{tenantID, tier}` (KV lookup, or your own store).
3. Worker proxies to `ORIGIN_URL` with `X-Tenant-ID`, `X-Tenant-Tier`, `X-Forwarded-For` headers set.
4. `sdlc-gateway` enforces tier rate limits, fingerprint, etc.

If you want token validation in the Worker itself (no origin round-trip on bad keys), add a JWT verify step before `resolveTenant`.
