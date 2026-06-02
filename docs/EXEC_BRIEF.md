# Executive Brief — FinsavvyAI Platform

*One-page strategy summary · 2026-06-02 · Full detail in [`VISION.md`](VISION.md) and [`docs/MARKET_RESEARCH.md`](docs/MARKET_RESEARCH.md)*

## The thesis in one line

The control plane for autonomous AI software systems: every AI action **authenticated → authorized → policy-checked → logged/replayable → routed → metered** — sold beneath six products and defended by governance and audit, not by the commoditizing gateway.

## Why now

- **Capability is outrunning trust.** AI writes 20–75% of new code at leading orgs; Gartner sees 40% of enterprise apps embedding agents by end-2026 — yet predicts >40% of agentic projects cancelled by 2027 for weak risk controls. The gap *is* the market.
- **Regulation has a hard date.** EU AI Act high-risk + transparency obligations apply **Aug 2, 2026**.
- **Value is migrating to governance.** a16z / Sequoia / Bessemer agree: models commoditize; moats come from owned workflows, audit/governance, and data flywheels.

## The defining market dynamic — squeeze from both sides

| From below | From above |
|---|---|
| Hyperscalers + labs ship **native** routing, prompt caching, observability (Bedrock, Azure Foundry, Vertex, OpenAI, Anthropic) | Security suites + data platforms **acquire** governance/observability (Palo Alto, Check Point, Cisco, ClickHouse, CoreWeave) |

A standalone point tool in this space is now an acquisition target, not an enduring independent. **Surviving the middle = betting only on what's defensible.**

## Where we win

1. **Govern + audit are the moat** — `policy-engine` (AI-code/PR governance) + `telemetry` (replayable AI-execution logs). Rides the EU-AI-Act tailwind; occupies the still-**unowned** "governing AI-generated code" category.
2. **Neutrality is the wedge** — native cloud routing is single-vendor by design; cross-vendor/cross-product control is the structural counter-position. `ai-gateway` = cost/control *surface*; `auth`/`billing` = *enablers*. Not the story.
3. **Deterministic replay is whitespace** — competitors stop at trace inspection.
4. **The six products are the workflow moat** — "build customer-back"; the platform is the shared system of record + data flywheel beneath them.

## GTM in brief

- **Buyers:** CISO-sponsored, jointly owned with platform engineering. Governance budget already allocated at ~70% of orgs.
- **Motion:** platform-centric core with edge interoperability (consolidation is winning, but rigid monoliths are not). Land via one product → expand to platform.
- **Pricing:** hybrid (platform fee + usage); usage-based is the land-and-expand engine. Per-seat is declining.

## Top risks

1. **Middle-squeeze** (hyperscalers below + consolidators above).
2. **Mis-allocation** — over-investing in the commodity layer (gateway/auth/billing) vs. the defensible layer (policy/audit/replay).
3. **Agentic-hype reversal** shrinking near-term budgets (though it raises demand for cost/governance control).
4. **Open-core liabilities** (EU Cyber Resilience Act, maintenance burden) if PipeWarden OSS is the wedge.

## Watch closely

Palo Alto Networks (Portkey + Protect AI), Check Point (Lakera), Cisco (Robust Intelligence), Datadog — most likely future competitors *and* acquirers. See [`docs/COMPETITOR_WATCHLIST.md`](docs/COMPETITOR_WATCHLIST.md).

## Confidence

High on the acquisitions, EU AI Act dates, Gartner adoption forecasts, and VC defensibility consensus. **Soft** (directional only): TAM dollar figures (vary up to ~150×), and vendor-stated ARR/customer/token metrics.
