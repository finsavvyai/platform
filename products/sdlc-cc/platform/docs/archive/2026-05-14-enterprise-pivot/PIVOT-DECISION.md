# sdlc-platform — Pivot Decision

**Date**: 2026-05-02 (revised 2026-05-03, RE-revised 2026-05-04)
**Status**: **Dual-SKU model adopted.** sdlc.cc is alive as a
separate product; code consolidated into the aegis backend.

## Revision history (read this first)

- **2026-05-02**: Original doc proposed three options for what to
  do with sdlc-platform. Recommended Option B (fold into AMLIQ).
- **2026-05-03**: After aegis discovery, executed Option B as a
  pure code consolidation. Shipped 14+ commits.
- **2026-05-04 morning**: SUNSET.md was added declaring sdlc.cc
  retired entirely.
- **2026-05-04 afternoon**: That sunset was **reversed**. The
  user clarified that sdlc.cc is a separate product they intend
  to ship — not retired. Option B was misread as "kill the
  product" when it should have been "share the codebase."

## Current model — dual SKU on shared codebase

| | AMLIQ | sdlc.cc |
|---|---|---|
| Domain | amliq.finance | sdlc.cc |
| Product | AML/sanctions screening for FIs | "Compliance LLM gateway" |
| ICP | Compliance officers | DevOps / CISO at any regulated company |
| Pitch | AI-augmented sanctions screening | DLP + audit + SAML in front of Claude (Cowork, Code, SDK) |
| Backend | aegis `cmd/api` (full AML + AI) | aegis `cmd/sdlc-api` (AI gateway routes only) |
| Default LLM path | Anthropic + Gemma fallback | Anthropic + Gemma fallback |
| Bedrock dependency | None (opt-in) | None (opt-in) |
| Sales motion | AML compliance pilots | Generic FI dev tools |

Both ship from the **same Go module** (aegis repo), via different
binary entrypoints. Migrations are shared. DLP is shared. SAML is
shared. The difference is which routes the binary mounts and what
the marketing site says.

## Why sdlc.cc was almost killed (and why it's back)

The friend-style strategic review (2026-05-02) argued: standalone
"compliance LLM gateway" is dominated by Portkey + LiteLLM + Bedrock
Guardrails + 5 other funded competitors. Solo founder, no SOC2,
$49/mo entry tier — head-on play unwinnable.

The user's reversal (2026-05-04): they're keeping sdlc.cc anyway,
either as cheap optionality or because their conviction on it is
stronger than my analysis. That's a legitimate founder call. My job
is to make the technical and operational substrate ready, not to
re-litigate the market thesis.
**Trigger**: friend-to-friend strategic review concluded that standalone
sdlc.cc has no defensible wedge against Portkey, LiteLLM, Bedrock
Guardrails, and the seven other funded gateway competitors.

## TL;DR

Three options. **Recommendation: Option B (fold into AMLIQ)** based on
the inbound signal we found.

| Option | Wedge | Effort to ship | Defensibility | Verdict |
|---|---|---|---|---|
| A. Sunset standalone, repackage code | none | low (1 sprint) | n/a | safe but wastes the asset |
| **B. Fold into AMLIQ as "AML AI Layer"** | **fintech vertical + AML rules** | **medium (1-2 months)** | **high — Portkey can't copy AML knowledge** | **recommended** |
| C. Israeli/EU regional play | geo + language | high (3-6 months, sales motion) | medium — TAM-limited | viable but slower |

## Inbound signal — the deciding evidence

`amliq-frontend/ai_proxy.py` is a 84-line FastAPI placeholder with a
header that explicitly says:

> "Do NOT deploy as a standalone sidecar in production."

It has three AML-shaped prompt templates (`alert`, `adverse_media`,
`case`) calling Anthropic via `any-llm`. No auth, no DLP, no audit, no
tenant isolation, no spend caps, no Bedrock option.

**This is the gateway sdlc-platform builds, just wearing the wrong logo.**

OpenSyber already routes AI through Claw (per `docs/ARCHITECTURE.md` —
"AI Gateway (Claw): provider fallback Anthropic → OpenAI → Workers AI").
TenantIQ is M365-shaped and orthogonal. So the demand exists in
**exactly one** sibling project, and it's fintech-vertical.

This collapses the strategic choice. We don't need to bet on a new
market — we need to plug a known gap in a sibling that already has a
fintech sales motion.

## Asset inventory — what's actually portable

The sdlc-platform Go gateway has 56 infrastructure packages and 33
migrations. Tagging by reuse value:

### Tier 1 — high-value AMLIQ imports (port directly)

| Asset | Path | Why it ports cleanly |
|---|---|---|
| Audit log immutable trigger | `migrations/009`, `infrastructure/audit/` | AML compliance demands tamper-evident audit; nobody else has this |
| RBAC w/ tenant isolation | `migrations/010`, `infrastructure/rbac/` | AMLIQ's "compliance officer / senior reviewer" roles need this |
| DLP redaction (reversible tokenization) | `infrastructure/middleware/` (DLP code) | Foundation; needs fintech-specific patterns added |
| Bedrock + Vertex adapters | `infrastructure/llm/bedrock.go,vertex` | Israeli banks WILL ask for AWS/GCP residency |
| BYOK per-tenant API keys | `infrastructure/byok/` | Each AMLIQ tenant brings their own Claude key |
| Spend tracking + caps | `infrastructure/spend/`, migrations/012 | Per-tenant cost ceilings — AML platforms care about this |
| Anthropic-compatible `/v1/messages` | `app/handlers/anthropic_compat/` | Lets AMLIQ swap proxy for gateway with zero client changes |
| SAML SP keypair + per-tenant | `infrastructure/sso/`, migrations/026 | Bank IT requires SSO |
| Compliance evidence export | `infrastructure/compliance_export/` | Direct fit for AML regulator submissions |
| Drift detection | `infrastructure/drift/` | Detects prompt-injection / model-behavior drift |

### Tier 2 — generic infrastructure (port if AMLIQ needs them)

| Asset | Notes |
|---|---|
| LemonSqueezy webhook receiver | AMLIQ may need self-serve billing — defer until pricing decided |
| Stripe invoice path | Enterprise AML deals will likely be sales-led; keep optional |
| ClawPipe adapter | Cost optimization layer — orthogonal to vertical |
| OpenAI / Google / Azure adapters | Multi-provider redundancy — port if AMLIQ wants OpenAI fallback |
| OPA policy engine | Generic policy layer — AMLIQ may use simpler rule shape |
| WebSocket realtime | AMLIQ already has its own UI tier; uncertain fit |
| SCIM resources | Bank IT may want this; defer until first ask |

### Tier 3 — sdlc-specific (sunset)

| Asset | Why sunset |
|---|---|
| `services/admin-ui` Next.js dashboard | AMLIQ has its own dashboard with Apple HIG already |
| `services/landing-worker` + `landing-page/` | sdlc.cc marketing surface — fold into amliq.com |
| `services/proxy-worker` Cloudflare Worker | Edge proxy — only needed if standalone |
| `services/document-processor` (Tesseract, Bull) | RAG pipeline orthogonal to AML use case; revisit if AMLIQ ingests documents |
| `services/agents` LAM agents | Generic; may apply, may not |

### What needs to be NEW (the actual moat work)

| Asset | Description | Why it's the wedge |
|---|---|---|
| `@amliq/fintech-dlp` package | Detection patterns: PAN (Luhn), IBAN (mod-97), SWIFT BIC, OFAC/UN/EU sanctions hits, MASAV file fields, ISO 20022 message components, Israeli ID (תעודת זהות), AML red-flag phrases | **No competitor has this** — Portkey ships generic PII; we ship AML-aware DLP |
| `@amliq/regulator-export` package | Bank of Israel / FCA / FinCEN audit-format reports | Regulators want specific shapes; we know them |
| AML-shaped prompts library | The three from ai_proxy.py + 20 more (case dispositions, SAR drafting, KYC narrative, EDD summaries) | Domain-specific, vertical defensibility |
| Sumsub/Onfido/ComplyAdvantage connectors | Already-known fintech vendors | Ecosystem play |

## The three options in detail

### Option A — sunset standalone, repackage code as portfolio infra

**Action**: `sdlc-platform/` becomes `packages/portfolio-gateway/`.
No public product, no marketing, no SOC2 push. Code lives as a shared
library that AMLIQ, OpenSyber, and TenantIQ can import as needed.

**Pros**: clean. Stops the spread-thin. Preserves the asset value.

**Cons**: doesn't capture the AMLIQ inbound signal. Leaves a known
fintech wedge on the table.

**When this wins**: if AMLIQ's roadmap doesn't have AI prominent
enough to justify dedicated engineering for the gateway layer.

### Option B — fold into AMLIQ as "AML AI Layer" *(recommended)*

**Action**:
1. Move sdlc-platform's `services/gateway` to
   `amliq-backend/services/ai-gateway/`. Keep the Go code intact.
2. Replace `amliq-frontend/ai_proxy.py` with a thin client that calls
   the Go gateway's `/v1/messages` endpoint.
3. Build `@amliq/fintech-dlp` package — port patterns from the
   Israeli/MASAV/ISO 20022 work the user already has.
4. Drop in OFAC/UN/EU sanctions detection (the existing AMLIQ
   sanctions screening data is the source of truth).
5. Reposition: AMLIQ becomes "AML platform with built-in AI layer
   that doesn't leak PII to Anthropic." The gateway is a feature,
   not a product. Pricing is bundled.
6. Sunset sdlc.cc domain or 301 it to amliq.com/ai.

**Pros**:
- Captures known inbound demand.
- Vertical wedge no competitor can copy in a sprint.
- Reuses every Tier 1 asset above.
- Sales motion already exists (AMLIQ is selling AML, this is a feature).
- Stops the spread-thin.

**Cons**:
- 1-2 months of integration work (refactor namespacing, port DLP, ship UI).
- AMLIQ must agree to be the wrapper — if AMLIQ pivots elsewhere,
  this option dies with it.

**When this wins**: if AMLIQ has any near-term roadmap need for AI
beyond the placeholder ai_proxy.py. Given the placeholder exists, it does.

### Option C — Israeli/EU regional play

**Action**: keep sdlc.cc standalone but reposition as the Israeli /
EU compliance gateway. Hebrew-language DLP. Bank of Israel audit
format. Local invoicing. Smaller TAM, real geographic moat.

**Pros**: 
- Geographic defensibility US-centric players won't chase.
- Plays to existing Global Remit / Israel banking relationships.
- AMLIQ can still use it via Option A pattern.

**Cons**:
- Still requires a sales motion this user doesn't currently have.
- 3-6 months to ship + first pilot.
- SOC2 + ISO 27001 + Israeli regulator approvals are real money.
- Fights on the same axis (compliance gateway) where Portkey already
  has international logos.

**When this wins**: if the user wants a standalone product and has
the bandwidth + funding to run a 6-month sales cycle. Given the
self-acknowledged spread-thin risk, probably not now.

## Decision criteria

Pick **Option B** if:
- [ ] AMLIQ roadmap includes AI features in the next 6 months
- [ ] User has bandwidth for a 1-2 month integration sprint
- [ ] User believes fintech-AML is a defensible vertical for them

Pick **Option A** if:
- [ ] AMLIQ doesn't need this in 2026
- [ ] User wants to stop adding products and consolidate
- [ ] No fintech-AI inbound from any sibling

Pick **Option C** if:
- [ ] User has appetite for a standalone fundraise or self-funded sales cycle
- [ ] Israeli/EU customers are explicitly asking for this
- [ ] User can commit 50%+ time to it for 6 months

## What happens to the in-flight queue

The autonomous queue from this session (A1 SAML ACS, D LemonSqueezy
rest, A4 recordings, etc.) is **paused**, not cancelled.

- **If Option B wins**: A1 (SAML) ports directly to AMLIQ. D
  (LemonSqueezy) becomes optional — AMLIQ may consolidate billing
  through Stripe. A4 (recordings) ports.
- **If Option A wins**: A1 + A4 port to `packages/portfolio-gateway/`.
  D becomes generic shared infra. Stop sdlc-specific marketing work.
- **If Option C wins**: queue resumes as-is.

In all three options, **none of the existing code is wasted** —
which is the strongest argument for *not* rushing the decision.

## Open questions for the human

1. **Has anyone from AMLIQ's customer base or pilot list asked for AI
   features?** (Not "we should have AI" — actual customer voice.)
2. **What's AMLIQ's funding/runway state?** Folding sdlc-platform
   into AMLIQ adds load to AMLIQ's roadmap.
3. **Do you have any commercial conversations on sdlc.cc itself
   that justify keeping it standalone?** (LinkedIn DMs, design
   partner asks, etc.)
4. **Is the Global Remit day job's AI strategy something we should
   align with here?** They likely have AML compliance + AI tension
   you've seen firsthand.
5. **AMLIQ backend status** — `amliq-frontend` exists, but where is
   the real backend? If there isn't one yet, Option B is even
   easier (no migration, just build the Go gateway as the backend).

## Next concrete moves (1 hour, regardless of choice)

1. Answer questions 1 + 5 above.
2. Pick option.
3. Update INTEGRATION-DEBT.md to reflect "paused / folding into X."
4. Decide what to do with sdlc.cc DNS + landing page (sunset / 301 / keep parked).

---

**Author note**: this doc was written autonomously after a strategic
pushback from the user that the original "ship a generic LLM compliance
gateway" plan had no defensible wedge. The recommendation is honest;
it costs the standalone-product narrative but preserves the asset
value and aligns with the user's actual moat (fintech depth).
