# Pivot — 2026-05-16 — Legal AI OSS + Commercial

> Supersedes the 2026-05-14 sunset direction (see
> [`PIVOT-2026-05-14.md`](PIVOT-2026-05-14.md)) two days after it was
> written. Same codebase, completely different go-to-market: keep
> the gateway, drop the sunset, focus a vertical, fund eventual
> compliance work from real revenue.

## Decision

Revive the repo with a **vertical OSS + commercial-license play**
aimed at mid-market law firms (50-500 attorneys).

- **License model:** AGPL-3.0 for the OSS release, commercial
  license sold at **$4K/yr/seat** for firms that don't want AGPL
  obligations.
- **Vertical:** Legal AI — attorney-client privilege redaction,
  work-product doctrine audit log, SCIM for paralegals, self-host
  for client-data sovereignty.
- **Brand:** Keep `sdlc.cc` and the `sdlc-platform` repo name.
- **Execution mode:** Full autopilot. All reversible local work
  runs autonomously; external-facing actions queue for batch
  approval.

## Why this works where the prior plays didn't

| Play | 2026-05-14 verdict | Why legal-AI vertical changes it |
|---|---|---|
| Enterprise compliance gateway ($5K-$15K/mo) | Killed — no regulation budget | Vertical bypass: law firms care about *attorney-client privilege*, not SOC 2 certificates. Privilege is a contractual + ethics rule, not an audit deliverable. |
| Path 4 — MCP server | Killed — Helicone owns the funnel | Different positioning: not "PII redaction MCP for any dev," instead "self-host gateway for one specific buyer type." |
| Path 5 — Cost-ops at $19/mo | Killed — OpenRouter free | Pricing 200x higher because the buyer cares about ethical-violation risk, not LLM bill optimization. |
| Path 6 — AMLIQ port | Still on (and still happening — see [`ROADMAP.md`](../ROADMAP.md)) | Unchanged. AMLIQ port runs in parallel. |

The unlock has two parts.

**(1) The pricing gap is concrete.** Harvey is **$1,200-$2,000/seat/mo
with a 25-seat minimum = $288K floor** — mathematically excludes
~99% of US firms ([AI Vortex pricing analysis](https://www.aivortex.io/legal/ai-tools/harvey-ai-pricing-2026/)).
Hebbia is $3K-$10K/user/yr M&A-only ([Sacra](https://sacra.com/c/hebbia/)).
Legora (formerly Leya) is $3K/user/yr with a 10-seat minimum. Of 16
commercial legal-AI vendors reviewed, **zero offer self-host with
privilege controls**. Mid-market price anchor is $50-$350/attorney/mo;
our $4K/yr = $333/seat/mo lands at the top of that band — credibly
priced, not a discount play.

**(2) The regulatory trigger is now urgent.** *United States v. Heppner*
(SDNY, 2026-02-17, Judge Rakoff) held that prompts to consumer Claude
**destroyed attorney-client privilege AND work-product protection**,
and that sending privileged content to a third-party AI **may waive
privilege over the underlying communications**
([Harvard Law Review note](https://harvardlawreview.org/blog/2026/03/united-states-v-heppner/),
[Gibson Dunn analysis](https://www.gibsondunn.com/ai-privilege-waivers-sdny-rules-against-privilege-protection-for-consumer-ai-outputs/)).
Combined with ABA Formal Opinion 512 (Jul 2024), Florida Bar Opinion
24-1, and NYSBA RPC 1.6 guidance, every mid-market firm now has a
concrete malpractice-insurance reason to self-host or restrict AI
prompts at the network boundary. That's the wedge.

## Why AGPL + commercial (not Apache, not BUSL)

- **AGPL alone gates competitors.** Any firm or vendor embedding the
  gateway in a non-OSS product must release source. They pay for the
  commercial license to avoid that obligation.
- **Apache-2.0** gives the same code away with zero leverage to
  convert free users to paid.
- **BUSL-1.1** (Sentry-style) is rejected by some open-source
  communities and confuses the "is it open source?" question; AGPL
  is unambiguously OSI-approved.
- **Real precedents:** MongoDB pre-2018, Sentry, LiteLLM Enterprise
  ($30K/yr), Sidekiq Pro ($179/mo solo dev → ~$10M ARR).

## What we ship

### OSS (AGPL-3.0)

- The full Go gateway (`services/gateway/`) with DLP, RBAC, audit
  chain, OPA validation, SCIM, SAML SSO, spend tracker, webhook
  dispatcher, IP allowlist, CMEK envelope encryption.
- The RAG service (`services/rag/`) with pgvector.
- The doc processor (`services/document-processor/`).
- The migrations + CI gates already running on this repo.
- New **legal-DLP pattern bundle** (privileged-comm markers,
  work-product flags, client-data markers).

### Commercial license ($4K/yr/seat)

Buys the right to embed the gateway in a closed-source product
without AGPL source-disclosure obligations. That's the entire
commercial product — no separate "Enterprise Edition" code.

Optional add-ons (separate SKUs, not bundled):
- **Setup engagement** — $5K one-time, deploy in a firm's
  infrastructure (Path D from the OSS-private-sector menu)
- **Support contract** — $500-2K/month per firm, prioritised
  bug fixes + upgrade path

### Roadmap on the OSS side

| Quarter | OSS Feature |
|---|---|
| Q3 2026 | Legal-DLP pattern bundle; example deployment guides for mid-market firms |
| Q4 2026 | Document-processor presets for legal file formats (.docx, .eml, PDF with OCR for scanned docs) |
| Q1 2027 | Integrations: NetDocuments, iManage, Clio, MyCase |
| Q2 2027 | SOC 2 Type II evidence pack (funded by yr-1 revenue) |

## Revenue model and timeline

| Year | Revenue source | Realistic target |
|---|---|---|
| Yr 1 | Consulting setup ($5K) + commercial license ($4K/yr) | $40-80K |
| Yr 1 | Support contracts ($500-2K/mo) | $10-30K |
| Yr 1 (stretch) | SBIR Phase I if any DoD topic fits | $50-150K |
| **Yr 1 total** | | **$60-160K** |
| Yr 2 | Above + first SOC 2 Type II audit funded from yr-1 revenue | $150-400K |
| Yr 3 | Re-open enterprise tier (now with SOC 2) | $400K-$1M |

The yr-3 number is "if everything works," not a base case. The base
case is yr-1 revenue covers a solo dev + a SOC 2 audit, which is
what unlocks the original enterprise direction.

## What this kills (vs the 2026-05-14 sunset version)

- **The sunset itself.** Repo stops being sunset.
- The "Path 6 only" framing — Path 6 still runs but is no longer the
  only thing on the roadmap.
- Treating `services/gateway/` as a donor codebase only — it's now
  the product again, just sold differently.

## What survives unchanged

- The AMLIQ component port (Path 6) — runs in parallel.
- The 2026-05-14 enterprise-pivot archive — stays at
  [`archive/2026-05-14-enterprise-pivot/`](archive/2026-05-14-enterprise-pivot/);
  becomes useful again once funded.
- The 200-line file cap, coverage targets, HIG rules, no false
  completion rule from CLAUDE.md.
- The aegis-has-no-sdlc-api-binary correction.

## Execution outline

Full plan in [`../ROADMAP.md`](../ROADMAP.md). Five waves:

1. **Wave 1 (today, autonomous):** rewrite direction docs (this
   doc, ROADMAP, CLAUDE, STATUS, SUNSET), swap LICENSE to AGPL-3.0,
   write COMMERCIAL.md.
2. **Wave 2 (background agents, ~30 min):** legal-AI competitive
   research depth, brand kit, legal-DLP pattern draft.
3. **Wave 3 (background agents, ~30 min):** landing page draft,
   Dev.to article drafts, AI-discovery files.
4. **Wave 4 (background agents, ~15 min):** pricing draft +
   LemonSqueezy product config, cold-email + outreach templates.
5. **Wave 5 (synthesis):** approval batch document listing every
   external action queued for human review; schedule weekly metrics
   + monthly cohort loops.

## Positioning anchors from the competitive research

Three concrete positioning moves came out of the 2026-05-16
competitive-depth research
([docs/research/2026-05-16-legal-ai-competitive-depth.md](research/2026-05-16-legal-ai-competitive-depth.md)):

1. **Lead the pitch with *Heppner*, not features.** The landing page
   and Dev.to articles should anchor on the 2026-02-17 SDNY ruling
   and the malpractice exposure it creates, not on AGPL or
   self-host as abstract benefits.
2. **Reposition as "Clio Duo replacement when firms outgrow it."**
   We are additive to the existing practice-management stack, not a
   Harvey competitor. Mid-market firms running Clio already accept a
   $50-$350/attorney/mo price band; we sit at the top of it.
3. **DLP pattern names cite the rules.** Each pattern's docstring
   names the specific rule it protects: ABA Op. 512, Florida Bar Op.
   24-1, NYSBA RPC 1.6, *US v. Heppner*. Compliance officers buy on
   language they already know.

## Risks (honest)

- **Privilege liability:** mishandled prompts could expose client
  data. The DLP chain reduces this but doesn't eliminate it. First
  customer contract needs a clear limitation-of-liability clause —
  ~$500 lawyer cost (one-time).
- **AGPL adoption resistance:** some firms refuse AGPL outright.
  Conversion to commercial license must be frictionless (under 24h
  turnaround, self-serve via LemonSqueezy).
- **Competitor entry:** Harvey or Casetext could ship a mid-market
  product. Solo speed advantage is real but finite.
- **Solo bandwidth:** sales conversations, support, on-call all fall
  on one person. First customer slows other work to a crawl.
