# Awesome LLM — PR draft

**Target repo:** https://github.com/Hannibal046/Awesome-LLM
**Section heading:** `## LLM Deployment` (under "Useful Resources" → look for "Deployment / Serving" subsection; if missing, add to `## Tools`).
**Maintainer pre-approval required:** No — open a PR with a single line addition. Maintainers prefer alphabetical ordering inside each subsection.

## Line to add

```
- [ClawPipe](https://clawpipe.ai) - The only AI gateway that skips LLM calls entirely. Booster, Packer, Cache, Router across 21 providers. Cut LLM costs 30-50%.
```

## PR description (paste-ready, 2 sentences)

Adds ClawPipe to the LLM deployment/serving tools. ClawPipe is a multi-provider AI gateway with a deterministic Booster stage that resolves trivial prompts (math, dates, JSON, lookups) without any LLM call — measured 57.3% cost reduction on a public 400-prompt benchmark.
