# marketing/

**This directory is intentionally empty.**

Pre-benchmark marketing copy has been archived to [`.archive-pre-benchmark/`](./.archive-pre-benchmark/) on **2026-05-19**.

## Why

Every file in the archive was structured around the headline claim:

> *"57.3% cost reduction measured on 400 real prompts"*

That claim sources from `benchmarks/run-benchmark.ts` whose first comment (`run-benchmark.ts:5`) states it runs against a **mocked gateway**. The "real prompts" framing in the archived files goes beyond what the in-house synthetic benchmark can support — it adds *measured* and *real* in a way that misrepresents the artifact.

A bluff audit (`.luna/clawpipe/no-bluf-report-v2.md`) flagged 16 marketing files as Critical. Per Batch B1, all of them are archived rather than surgically edited.

## What replaces this

When the public measured benchmark lands at <https://github.com/finsavvyai/clawpipe-booster-benchmark>:

1. Pull the measured per-bucket numbers + 95% Wilson CIs.
2. Rewrite from [`docs/promotion/launch-kit/show-hn.md`](../docs/promotion/launch-kit/show-hn.md), which is **already honestly framed** (explicit "synthetic dataset on a mock gateway" disclosure).
3. Use the measured numbers, never the prior synthetic ones, for marketing surfaces.

## Hard rules going forward

- **No Show HN / ProductHunt / Reddit / Dev.to launch** until measured benchmark is published.
- **No prospect outreach** quoting any cost-reduction percentage that isn't traceable to the measured benchmark.
- **No edit to archive** — those files are evidence of a prior framing. Rewrite from `docs/promotion/launch-kit/` instead.

If you find yourself wanting to reuse a snippet from the archive, stop and read the no-bluff report first.
