# Long-form articles

Long-form drafts targeting Medium, Dev.to, Hashnode. Each carries
front matter with `canonical_url` pointing back to `clawpipe.ai/blog`
so SEO weight consolidates on the owned domain.

| File | Target | Word count | Tone |
|---|---|---|---|
| [`medium-the-llm-bill.md`](./medium-the-llm-bill.md) | Medium | ~1,400 | Founder narrative — why we built it |
| [`devto-routing-math.md`](./devto-routing-math.md) | Dev.to | ~1,800 | Engineering deep-dive — router scoring |
| [`devto-mcp-server.md`](./devto-mcp-server.md) | Dev.to | ~1,200 | Tutorial — MCP setup in Claude/Cursor |

The Dev.to / Hashnode shorter-form drafts (Booster architecture,
21-provider ranking, Stripe→LemonSqueezy migration) are in
[`../launch-kit/dev-to-hashnode.md`](../launch-kit/dev-to-hashnode.md).

## Publish order

1. `medium-the-llm-bill.md` — week of launch (Tuesday). Founder
   narrative pulls a different audience than HN. Shouldn't compete
   with Show HN.
2. `devto-routing-math.md` — Day +3. Engineering audience that didn't
   show up on HN/PH will show up on Dev.to. Detailed code commentary.
3. `devto-mcp-server.md` — Day +7. Tutorial format converts MCP-curious
   developers into trial users. Posted after the launch noise so it
   has a clear funnel.

## Cross-posting rules

- **Always** set `canonical_url` to the post on `clawpipe.ai/blog`
  before syndicating.
- Wait at least 24 hours after publishing on Dev.to before
  cross-posting to Hashnode (Google needs time to attribute the
  canonical correctly).
- Medium articles can re-post 3-7 days after the original — set
  `Story Settings → Add canonical link`.
- Don't post the same body to two competing platforms simultaneously
  (Dev.to + Hashnode is fine because they cooperate; Dev.to + Medium
  triggers Medium's "originality" demote).

## What's missing

The benchmarks article ("400 prompts, 21 providers, 57.3% savings")
should be its own piece eventually. We're holding it for week 3 of
the launch — by then the public benchmark page will have updates,
and a long-form companion gives readers somewhere to land.
