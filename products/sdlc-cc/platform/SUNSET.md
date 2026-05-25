# Un-Sunset — 2026-05-16

**Updated:** 2026-05-16
**What was sunset:** the enterprise compliance LLM gateway product
**What is sunset now:** nothing — the repo was reactivated on
2026-05-16 with a vertical OSS + commercial-license play

## Headline

Two days after the 2026-05-14 sunset, this repo is active again
under a different go-to-market: **AGPL-3.0 + $4K/yr/seat commercial
license, targeted at mid-market legal-AI buyers**. See
[`docs/PIVOT-2026-05-16-LEGAL-AI.md`](docs/PIVOT-2026-05-16-LEGAL-AI.md)
for the decision record and [`ROADMAP.md`](ROADMAP.md) for the task
list.

This file used to explain why the repo was sunset. It now explains
what changed.

## What changed between 2026-05-14 and 2026-05-16

| Date | State | Reason |
|---|---|---|
| 2026-05-14 morning | Enterprise compliance pivot (Paths 4 + 5 + 6) | First market re-audit |
| 2026-05-14 afternoon | Sunset (Path 6 only) | Second pass: competitor research killed Paths 4 + 5 |
| 2026-05-16 (today) | **Active, vertical OSS + commercial** | User asked specifically about OSS + private-sector revenue paths; new research found mid-market legal AI is wide-open and AGPL+commercial works for solo devs (LiteLLM Enterprise $30K/yr, Sidekiq Pro precedent) |

The vertical-bypass insight: law firms care about *attorney-client
privilege*, not SOC 2 certificates. Privilege is a contractual +
ethics rule, not an audit deliverable. That removes the original
"no regulation budget → no enterprise market" blocker.

## What this repo is now

| Role | State |
|---|---|
| Public OSS gateway (AGPL-3.0) | Active product |
| Commercial license ($4K/yr/seat) | Active product |
| Consulting setup + support contracts | Active service |
| AMLIQ component-port donor | Still happening (Track 6 in ROADMAP.md) |
| Reference architecture for re-opening enterprise tier in yr 3 | Deferred, not killed |

## What's still killed (vs the 2026-05-14 sunset)

- **Path 4 (generic MCP server, free→paid funnel)** — Helicone owns
  this playbook (acquired by Mintlify March 2026)
- **Path 5 (cost-ops microSaaS at $19/mo)** — OpenRouter Guardrails
  ships free per-key budget caps that reject
- **The pre-2026-05-14 enterprise tier as currently described**
  ($5K-$15K/mo, SOC 2 GA Q3 2026 timeline) — funded from yr-1
  revenue, not from current budget; **re-opens in yr 3, not killed**

## What's un-killed

- **`services/gateway/` as a product.** Now sold under AGPL +
  commercial license. Was reduced to "donor codebase" on 2026-05-14;
  back to product on 2026-05-16.
- **The `landing-page/` deployment.** Now hosts the legal-AI
  marketing site, not a placeholder.
- **The `admin-ui/`, `document-processor/`, `realtime/`,
  `proxy-worker/` directories.** All in active use again under AGPL.

## DNS

`sdlc.cc` stays owned. Points at the legal-AI marketing landing
page (Cloudflare Pages). The previous "placeholder until repurposed"
status from the 2026-05-14 sunset is no longer accurate.

## If you came here from a stale link

Active surface at the repo root:

- [`README.md`](README.md) — what the repo is + install
- [`CLAUDE.md`](CLAUDE.md) — how to work in it
- [`STATUS.md`](STATUS.md) — current state
- [`ROADMAP.md`](ROADMAP.md) — what to build next
- [`COMMERCIAL.md`](COMMERCIAL.md) — how to buy the commercial license
- [`docs/PIVOT-2026-05-16-LEGAL-AI.md`](docs/PIVOT-2026-05-16-LEGAL-AI.md) — why
