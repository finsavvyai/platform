# docs/promotion/.archive-pre-benchmark/

**Archived 2026-05-19** alongside the `marketing/` archive (see `marketing/README.md`).

These 9 files asserted "measured 57.3% / 30% on a public 400-prompt benchmark" without the honest-disclosure framing that the surviving siblings in `docs/promotion/launch-kit/` carry. The source data is a synthetic in-house benchmark against a mocked gateway (`benchmarks/run-benchmark.ts:5`), not a measured customer or third-party run.

## Files archived

- `articles/devto-routing-math.md`
- `articles/README.md`
- `awesome-prs/awesome-ai-tools.md`
- `awesome-prs/awesome-cloudflare-workers.md`
- `awesome-prs/awesome-llm.md`
- `awesome-prs/awesome-typescript.md`
- `launch-kit/influencer-outreach.md`
- `launch-kit/linkedin.md`
- `launch-kit/twitter-x.md`

## Restoration rule

Rewrite from the surviving honest templates (`launch-kit/show-hn.md`, `launch-kit/product-hunt.md`, `launch-kit/dev-to-hashnode.md`) **only after** the public measured benchmark lands at <https://github.com/finsavvyai/clawpipe-booster-benchmark>. Use measured per-bucket numbers with 95% Wilson CIs; never the prior synthetic 57.3%.
