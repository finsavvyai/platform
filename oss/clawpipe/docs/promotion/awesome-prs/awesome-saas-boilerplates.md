# Awesome SaaS Boilerplates — PR draft

**Target repo:** https://github.com/smirnov-am/awesome-saas-boilerplates
**Section heading:** `## Add-ons & Integrations` → subsection for billing/payments references. ClawPipe uses LemonSqueezy for billing, so it's a useful reference implementation for SaaS authors evaluating LS.
**Maintainer pre-approval required:** No — direct PRs accepted; use alphabetical order.

## Line to add

```
- [ClawPipe](https://clawpipe.ai) - Production AI gateway with full LemonSqueezy billing integration (5 tiers, monthly/annual toggle, usage-based add-ons). Source: apply Booster + Cache + Router on every call (per-bucket cost-reduction range pending measured benchmark) via Booster + Cache + Router pipeline.
```

## PR description (paste-ready, 2 sentences)

Adds ClawPipe as a real-world reference for SaaS authors evaluating LemonSqueezy billing — production checkout flow with 5 pricing tiers, monthly/annual toggle, and usage-based metering. Useful as a complete, deployed example of LS billing integration in a TypeScript/Cloudflare stack.
