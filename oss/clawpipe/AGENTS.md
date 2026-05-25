# Agent brief · clawpipe

## Mission
Get **clawpipe** (clawpipe.ai) to demo-ready + investment-ready in the 8-week sprint.

## Wedge
LLM gateway / FinOps · cost-reduction figure pending public measured benchmark
(`github.com/finsavvyai/clawpipe-booster-benchmark`)

## Branch convention
- CC #1 agents work on `agent1/sprint-day-N` branches
- CC #2 agents work on `agent2/sprint-day-N` branches
- Always open a PR for review, never push to main

## In scope
- All product code, marketing site, docs, tests
- Open PRs for review with title `[wkN] <short description>` and body describing what + why + tests

## OUT OF SCOPE — do not touch
- Any `.env` or `.env.example` file (Shachar rotates these manually)
- Any "SOC 2" / "ISO 27001" / "HIPAA" / "PCI" copy on the marketing site
  (you may REMOVE these claims, never ADD them, never expand them)
- Production deploys (Shachar hits ship-to-prod)
- Adding new dependencies without justification in PR body

## Demo-pass criteria
- Build passes cleanly from a fresh checkout
- Test suite passes
- Live URL serves the right page with no console errors
- Pricing visible publicly, checkout works
- Real /docs page exists (not SPA fallback)

## When you finish a task
- Update `/Users/shaharsolomon/dev/projects/portfolio/SPRINT.md` with status
- Tag @shacharsol on the PR for review
- Stop and wait for next instruction
