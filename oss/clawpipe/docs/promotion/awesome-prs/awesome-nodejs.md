# Awesome Node.js — PR draft

**Target repo:** https://github.com/sindresorhus/awesome-nodejs
**Section heading:** `## Packages` → subsection `### Machine Learning` or `### Natural language processing` (whichever exists).
**Maintainer pre-approval required:** **Yes** — sindresorhus's awesome-* lists have strict contribution rules (`contributing.md`). Requirements: package must have ≥30 GitHub stars, README in English, must be the README's primary purpose, no marketing language. Read https://github.com/sindresorhus/awesome-nodejs/blob/main/contributing.md before opening. Maintainer will close PRs that don't meet criteria without discussion.

## Line to add

```
- [clawpipe-ai](https://www.npmjs.com/package/clawpipe-ai) - SDK for the ClawPipe AI gateway. Skips LLM calls, caches semantically, routes across 21 providers.
```

## PR description (paste-ready, 2 sentences)

Adds the clawpipe-ai SDK to the Machine Learning packages list. The SDK runs an optimization pipeline locally before the network hop (deterministic skip for trivial prompts, context compression, semantic cache) and routes the rest across 21 LLM providers via a self-learning router.
