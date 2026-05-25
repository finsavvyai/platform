# Status

**Updated:** 2026-05-16

## Where this repo is

**Active.** Public OSS + commercial-license play for mid-market
legal-AI buyers. AGPL-3.0 on the gateway; $4K/yr/seat commercial
buyout. See [`SUNSET.md`](SUNSET.md) for what got un-sunset on
2026-05-16, [`docs/PIVOT-2026-05-16-LEGAL-AI.md`](docs/PIVOT-2026-05-16-LEGAL-AI.md)
for the decision record, and [`ROADMAP.md`](ROADMAP.md) for the
launch sprint + revenue tracks.

## Active tracks

| Track | What it ships | Status |
|---|---|---|
| **A — OSS release (AGPL-3.0)** | Public gateway release + legal-DLP bundle | In progress (Wave 1 — direction docs landing today) |
| **B — Commercial license** | $4K/yr/seat buy-out | In progress (Wave 4 — LemonSqueezy products) |
| **C — Consulting** | $5K setup + $500-2K/mo support | Not started |
| **6 — AMLIQ port** | Move 4 packages into aegis | Not started (parallel) |
| **S — SBIR Phase I (stretch)** | DoD AI compliance proposal | Not started |

## Launch sprint waves

| Wave | Status |
|---|---|
| 1 — Direction docs + LICENSE + COMMERCIAL.md | **In progress now** |
| 2 — Background agents: competitive depth, brand kit, legal-DLP patterns | Queued |
| 3 — Background agents: landing page, Dev.to drafts, AI-discovery files | Queued |
| 4 — Background agents: pricing + LemonSqueezy products, cold-email templates | Queued |
| 5 — Approval batch + ScheduleWakeup loops | Queued |

## CI gates still running

| Workflow | What it gates |
|---|---|
| `.github/workflows/migrations.yml` | Canonical migrations + idempotency check |
| `.github/workflows/e2e.yml` | Gateway ↔ RAG docker-compose roundtrip |
| `.github/workflows/dr-drill.yml` | Weekly DR drill |
| `.github/workflows/load-test.yml` | k6 against api.sdlc.cc (manual trigger) |
| 20+ PipeWarden security-scan workflows | SAST, dependency, secret, license scans |

## Killed (still killed)

- **Path 4 (generic MCP server)** — Helicone owns the funnel.
- **Path 5 (cost-ops at $19/mo)** — OpenRouter Guardrails free.
- **The 2026-05-14 sunset.** Repo is no longer sunset; reactivated
  with vertical positioning.
- **The pre-2026-05-14 enterprise tier ($5K-$15K/mo + SOC 2 GA).**
  Re-opens in yr 3 if yr-1 revenue funds the audit.

## Archive

Everything from the prior 90-day enterprise plan lives at
[`docs/archive/2026-05-14-enterprise-pivot/`](docs/archive/2026-05-14-enterprise-pivot/).
That archive is no longer "abandoned forever" — it's "deferred until
funded." When the SOC 2 audit clears, the contents are working
material again.

## Revenue tracking (yr 1 target)

| Source | Target | Realised |
|---|---|---|
| Commercial licenses ($4K/yr) | $40-80K | $0 |
| Consulting ($5K setup + retainers) | $20-50K | $0 |
| Support contracts ($500-2K/mo) | $10-30K | $0 |
| SBIR Phase I (stretch) | $0-150K | $0 |
| **Total** | **$60-160K** | **$0** |

Status updated weekly by the metrics loop (see ROADMAP.md
"Tracking + cadence").
