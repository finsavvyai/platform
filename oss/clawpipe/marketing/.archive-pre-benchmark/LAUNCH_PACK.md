# ClawPipe Launch Pack

Coordinated launch playbook for the "beat the competitors" push. Run in order.

## T-0 day checklist

- [ ] Gateway deployed, `/health` returns ok
- [ ] Landing page deployed (`clawpipe.ai`, `/benchmarks`, `/vs/cloudflare`, `/vs/portkey`, `/vs/litellm`, `/vs/direct-api`)
- [ ] npm package `clawpipe-ai@3.0.1` published
- [ ] `clawpipe-mcp-server@3.0.0` published
- [ ] MCP `server.json` submitted to registry.modelcontextprotocol.io
- [ ] Smithery submission (https://smithery.ai/new) linking this repo
- [ ] Calculator app at calc.clawpipe.ai live and responsive on mobile
- [ ] GitHub repo topics set: `mcp`, `ai`, `llm`, `openai-alternative`, `cost-optimization`

## Channel-by-channel content

### 1. Hacker News — `marketing/hackernews/show-hn.md`

- Post **Tuesday or Wednesday, 8-10am PT**
- Title: `Show HN: ClawPipe – cut LLM costs 57% (measured on 400 real prompts)`
- First comment: your own, pointing at `/benchmarks` with reproduction command
- Stay in the thread for the first 3 hours answering technical questions

### 2. Dev.to — `marketing/devto/article-57-percent-savings.md`

- Publish 2 hours before the HN post so HN traffic lands on a live post
- Add cover image: dashboard mockup from landing hero
- Crosspost to the `#ai` and `#performance` tags

### 3. Product Hunt — `marketing/producthunt/launch.md`

- Schedule for **Thursday 12:01 AM PT**
- Lead image: benchmark numbers card from `/benchmarks`
- Maker comment: link the Dev.to article + GitHub

### 4. Reddit

- `r/LocalLLaMA`: "We measured a pipeline that cuts LLM cost 57% — open source" — cite benchmark
- `r/MachineLearning`: **avoid launch tone**, lead with the benchmark methodology
- `r/SideProject`: the scrappy framing — "$12K/mo bill → here's what I built"

### 5. Twitter / X thread (paste-ready)

```
1/ Most LLM apps pay 2-3x more than they need to.

Not because models are expensive.
Because every request gets handled the same way: full-price, uncached,
to the most capable model available.

We built a 6-stage pipeline to fix that. Open-sourced it.

57.3% cost reduction on 400 real prompts.

2/ Stage 1 — Booster
96 deterministic rules that resolve prompts WITHOUT an LLM call.
"what is 17% of 240" → regex → done.
"format this JSON" → parse → done.
"sum of 1,2,3" → done.

30% of our benchmark traffic resolved at $0 cost.

3/ Stage 2 — Packer
Strips redundancy from prompts before they leave your app.
4.4% fewer tokens on average. Free speedup.

Stage 3 — Semantic Cache
"explain recursion" and "what is recursion" are the same question.
Hash cache misses both. Embedding cache hits.

35% hit rate on repeat traffic.

4/ Stage 4 — Self-learning Router
Starts with defaults. Updates weights from real outcomes.
(latency, cost, success)
The longer it runs, the smarter it gets.

Stage 5 — Multi-provider Gateway
20+ providers, retries, circuit breakers, budget caps.

5/ Full benchmark breakdown + reproduction command:
https://clawpipe.ai/benchmarks

GitHub: https://github.com/finsavvyai/clawpipe
npm: npm install clawpipe-ai

MIT licensed. Free tier 1K calls/day, no card.

Show me your cost graph next week.
```

### 6. LinkedIn (B2B framing)

- Same numbers, enterprise framing
- CTA: Team plan ($149/mo) and Enterprise contact page

## Social cards

- Hero card: 1200×630, dark BG, white number "57.3%", subtitle "measured cost reduction, 400 prompts, open source"
- `/vs/cloudflare` card: split comparison table screenshot
- `/benchmarks` card: the 4 big number tiles

## Comparison-page SEO push

Every competitor query should find us:

- "Cloudflare AI Gateway alternative" → `/vs/cloudflare`
- "Portkey alternative" / "Portkey cheaper" → `/vs/portkey`
- "LiteLLM gateway" → `/vs/litellm`
- "cheaper OpenAI" → `/vs/direct-api`

Submit each page to:
- Google Search Console (ensure canonical + sitemap includes the URL)
- Bing Webmaster
- AlternativeTo.net (create ClawPipe listing, add as alternative to each competitor)

## Post-launch (T+7 days)

- Response post on HN/Dev.to with one real customer's savings graph
- `marketing/devto/` second article: deep-dive on Booster rule design
- Update benchmark with 800-prompt dataset
- Announce first integration partner (to be coordinated)

## Metrics to watch

| Metric | Target D1 | Target D7 |
|---|---|---|
| GitHub stars | 100 | 500 |
| npm installs | 500 | 3,000 |
| Signups | 50 | 300 |
| Paid conversions | 2 | 15 |
| HN rank | top 20 | —  |
| Dev.to reactions | 50 | 300 |
