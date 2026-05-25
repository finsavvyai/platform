# Awesome Cloudflare Workers — PR draft

**Target repo:** https://github.com/lukeed/awesome-cloudflare
**Section heading:** `## Apps & Sites` (or `## Tools` if a deployment-tools subsection exists). Apps section uses bullet entries with a one-line description.
**Maintainer pre-approval required:** No — Luke Edwards (`lukeed`) accepts straight PRs. Keep description ≤ 90 chars.

## Line to add

```
- [ClawPipe](https://clawpipe.ai) - AI gateway on Cloudflare Workers. Skips LLM calls, caches, routes across 21 providers. Cuts LLM costs 30-50%.
```

## PR description (paste-ready, 2 sentences)

Adds ClawPipe — an AI gateway built on Cloudflare Workers (Hono + D1 + KV) — to the apps list. The gateway runs at api.clawpipe.ai and ships a deterministic Booster stage that skips LLM calls entirely, with measured 57.3% cost reduction on a public benchmark.
