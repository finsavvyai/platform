# OpenSyber Boost — Round 3 Quick Wins (<1h each)

**Date**: 2026-04-28

Five items each under one hour. Each ships independently — no blocking dependencies.

## QW1 — Reinstate flaky-detection workflow (30 min)

Round 1 COMPLETED.md claimed this shipped; the `.github/workflows/` directory is missing. Reinstate.

```yaml
# .github/workflows/flaky-detection.yml
name: flaky-detection
on:
  schedule: [{ cron: '0 6 * * *' }]
  workflow_dispatch:
jobs:
  stress:
    strategy:
      matrix:
        package:
          - "@opensyber/tokenforge"
          - "@opensyber/tokenforge-api"
          - "@opensyber/api"
          - "@opensyber/web"
          - "@opensyber/db"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: |
          for i in 1 2 3 4 5; do
            pnpm --filter ${{ matrix.package }} test --run \
              || { echo "::warning::Flake on iteration $i"; exit 1; }
          done
```

## QW2 — Cloudflare Cache API on /.well-known/* (45 min)

Well-known endpoints are immutable until JWKS rotation — cache-edge them.

```ts
// apps/tokenforge-api/src/routes/well-known.ts (extend)
const cache = caches.default;
wellKnownRoutes.get('/jwks', async (c) => {
  const cacheKey = new Request(c.req.url, c.req.raw);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const res = c.json({ keys: await getJwks(c.env) });
  res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});
```

## QW3 — Embedding cache (45 min)

Round 2 P0. Identical queries regenerate embeddings; KV-back with 24h TTL.

```ts
// apps/api/src/services/vector-search.ts (extend)
async function embed(query: string, env: Env): Promise<number[]> {
  const key = `emb:${await sha256(query)}`;
  const cached = await env.KV.get(key, 'json');
  if (cached) return cached as number[];
  const { data } = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [query] });
  await env.KV.put(key, JSON.stringify(data[0]), { expirationTtl: 86400 });
  return data[0];
}
```

## QW4 — Trust-score color legend on /docs/quickstart (20 min)

Sprint 38 quickstart page has no visual showing what trust-score thresholds mean. Add a 3-band legend so devs know what `requireFreshSig({ minTrustScore: 90 })` actually gates.

```tsx
// apps/tokenforge-web/src/app/docs/quickstart/page.tsx (append section)
<section className="mt-10 rounded-2xl border border-border/60 bg-panel p-6">
  <h3 className="text-base font-semibold mb-3">Trust-score thresholds</h3>
  <div className="grid grid-cols-3 gap-3 text-sm">
    <div className="rounded-lg bg-ok/10 p-3">
      <div className="font-mono text-xs text-ok mb-1">90–100 ALLOW</div>
      Default. Bound device, clean signals.
    </div>
    <div className="rounded-lg bg-warn/10 p-3">
      <div className="font-mono text-xs text-warn mb-1">40–89 STEP_UP</div>
      Drift detected. Use requireFreshSig() to gate sensitive routes.
    </div>
    <div className="rounded-lg bg-bad/10 p-3">
      <div className="font-mono text-xs text-bad mb-1">0–39 BLOCK</div>
      Multiple high-confidence anomalies. Reject the request.
    </div>
  </div>
</section>
```

## QW5 — `.gitignore` `tsconfig.tsbuildinfo` (5 min)

`apps/tokenforge-web/tsconfig.tsbuildinfo` is tracked by mistake — regenerated per-build, pollutes diffs. Add to gitignore + remove from index.

```bash
echo "tsconfig.tsbuildinfo" >> .gitignore
git rm --cached apps/tokenforge-web/tsconfig.tsbuildinfo
git rm --cached apps/web/tsconfig.tsbuildinfo 2>/dev/null
```

## Pick-up order

QW5 → QW1 → QW2 → QW3 → QW4. Smallest blast radius first; QW3 needs KV binding verified in `wrangler.toml`.
