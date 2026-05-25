# Pivot 2026-05-20 — Privacy Gateway + 3-Product Trust Bundle

> **Supersedes** [`PIVOT-2026-05-16-LEGAL-AI.md`](PIVOT-2026-05-16-LEGAL-AI.md).
> Legal-AI is now a **preset inside the privacy gateway**, not the
> headline product. The headline is the privacy gateway itself.

## The pivot in one paragraph

Reposition `services/gateway` as a **privacy gateway** that scrubs
PII and secrets out of prompts **before** they hit any LLM (Anthropic,
OpenAI, Bedrock, Vertex, Azure, local). Sell it on the back of a hot,
just-priced market category (Lakera → Check Point, ~$300M, 2025) with
a real Go backend and **multi-surface distribution**: browser
extensions for ChatGPT/Claude/Gemini web UIs, IDE addins (VS Code,
JetBrains, Cursor), and Office addins (Word, Outlook). Bundle this
gateway with the two sibling portfolio products — **AMLIQ** (AML
compliance) and **OpenSyber/Claw** (provider-fallback AI gateway) —
under **one Trust Center and one MSA**, so an enterprise buyer signs
once and gets three integrated trust-grade products.

## Why now

| Signal | What it means |
|---|---|
| Lakera Guard → Cisco / Check Point category exit ~$300M (May 2025) | Buyers know the category, have budget, want a non-acquired-by-bigco alternative |
| EU AI Act GPAI enforcement starts Aug 2026 | Every EU-touching app needs a documentable pre-prompt redaction story |
| Anthropic FSI push (Blackstone JV, FIS partnership) May 2026 | FSI buyers actively shortlisting Claude wrappers; Trust posture decides shortlist |
| US v. Heppner (SDNY 2026-02-17) | Same legal-privilege hook — still applies, just as one preset |
| Lakera acquired = gap in independent OSS option | Self-hosted AGPL privacy gateway has a clean wedge |

## The three products in the bundle

| Product | What it is | Role in the Trust story |
|---|---|---|
| **sdlc-platform** (`services/gateway`) | Privacy gateway — DLP, redaction, audit, RBAC, SSO, SCIM, spend caps | The **front door**: nothing leaves the customer to an LLM without being scrubbed |
| **AMLIQ** | AML compliance dashboard with AI summarisation | The **vertical proof point**: a regulated-industry product already using the gateway primitives in production |
| **OpenSyber / Claw** | Multi-provider AI gateway with provider fallback | The **routing layer**: once the prompt is scrubbed, route it to the cheapest/most-compliant provider; audit and replay end-to-end |

**One Trust Center** at `trust.<brand>.com` surfaces:
- Shared SOC 2 scope (yr 2)
- Single sub-processor list
- Single DPA / data-residency matrix
- Cross-product audit-log architecture
- Privacy-gateway redaction guarantees

**One MSA** covers all three. Customer signs once → can adopt any
combination of the three without re-procurement.

## Distribution surfaces (sdlc-platform)

| Surface | Why | Who owns |
|---|---|---|
| **Self-hosted Docker** | OSS / AGPL anchor; signals "real backend" | gateway repo |
| **Browser extension** (Chrome, Edge, Firefox, Safari) | Intercept prompts to ChatGPT / Claude / Gemini / Copilot web UIs | new `extensions/browser/` |
| **VS Code + JetBrains + Cursor addin** | Intercept Copilot / Codeium / Cursor prompt + completion traffic | new `extensions/ide/` |
| **Word + Outlook addin** | Intercept Microsoft 365 Copilot prompts at compose time | new `extensions/office/` |
| **CLI proxy** (`gateway proxy`) | Localhost transparent proxy for any HTTP LLM call | already in gateway |

All surfaces talk to the same Go backend (self-hosted or cloud
tenant). No surface holds policy state — they're thin shims.

## What changes vs. 2026-05-16

| Area | 2026-05-16 (Legal-AI) | 2026-05-20 (Privacy Gateway) |
|---|---|---|
| Headline pitch | "Self-host legal AI, protect privilege" | "Scrub PII and secrets before any LLM call" |
| Target ICP | Mid-market law firms (50-500 attorneys) | (1) Any team using consumer LLM web UIs at work, (2) Regulated verticals — law, AML, healthcare |
| Lead doc | `US v. Heppner` privilege case | Lakera category exit + EU AI Act + Heppner (now one of several) |
| Pricing | $4K/yr/seat commercial license | Tiered: Free (self-host), Team $39/seat/mo, Business $79/seat/mo, Enterprise contact (still $4K+/yr) |
| Distribution | Single Docker self-host | Docker + browser ext + IDE addin + Office addin |
| Trust posture | Per-product | Shared Trust Center + single MSA across three products |
| Yr-1 ARR target | $60-160K | $90-220K (wider TAM via browser ext free→Team conversion) |

## What carries over

- AGPL-3.0 + commercial license (CLA required).
- 200-line file cap, SPDX headers, no `Co-Authored-By` trailer, no false-completion claims.
- Migrations canonical at `database/migrations/`; CI applies via `migrations.yml`.
- Track 6 (AMLIQ port) is **more** important now — it's how AMLIQ joins the bundle technically.
- Legal-DLP preset still ships in `internal/infrastructure/middleware/dlp_*` as one named preset alongside `pii_default`, `finance`, `healthcare`.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| "Yet another DLP" perception | Lead with the LLM-specific guarantees: prompt-template injection scrub, secret-in-prompt detection, replay-with-redaction audit |
| Three products = three things to break | Trust Center documents the boundary; gateway is the only one in the data path of the others — AMLIQ + Claw are loosely coupled |
| Browser extension review delays (Chrome Web Store, Firefox AMO, Apple) | Start submissions in parallel; ship Chrome first as the workhorse |
| AGPL scares enterprises | Same answer as 2026-05-16: $4K+/yr/seat commercial license lifts the obligation |
| Single MSA across 3 products = legal complexity | Use a master + product-specific exhibits; one signature, separable scope |

## Decision

Adopt. Rewrite `ROADMAP.md` to lead with the privacy-gateway framing,
add the three distribution-surface tracks, and add the cross-product
Trust Bundle track. Keep the legal-AI work as Track A2 (now "legal
DLP preset") instead of the headline.

## Done-when (for the pivot itself, not the launch sprint)

- [ ] `ROADMAP.md` rewritten to privacy-gateway framing
- [ ] `AGENTS.md` workspace facts reflect the three-product bundle
- [ ] `CLAUDE.md` status banner updated to point at this doc
- [ ] First browser-extension scaffold (`extensions/browser/`) compiles
- [ ] Trust Center page exists (can be a stub at `trust.sdlc.cc`)
