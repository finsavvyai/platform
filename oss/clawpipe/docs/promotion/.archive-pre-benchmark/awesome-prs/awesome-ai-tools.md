# Awesome AI Tools — PR draft

**Target repo:** https://github.com/mahseema/awesome-ai-tools
**Section heading:** `## AI Infrastructure` → look for "LLM Gateways" or "API Aggregators". If absent, add under `## Developer Tools`.
**Maintainer pre-approval required:** No — direct PRs accepted; entries should be alphabetized within each section.

## Line to add

```
- [ClawPipe](https://clawpipe.ai) - The only AI gateway that skips LLM calls entirely. Booster, Packer, Cache, Router across 21 providers. Cut LLM costs 30-50%.
```

## PR description (paste-ready, 2 sentences)

Adds ClawPipe to the AI infrastructure / LLM gateways section. Unlike other gateways that only proxy and route, ClawPipe ships a deterministic Booster stage that resolves trivial prompts without a provider call — measured 30% of prompts skipped entirely on a 400-prompt public benchmark.
