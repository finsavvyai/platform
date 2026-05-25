# Portfolio AI Architecture — Full Plan

**Date**: 2026-05-04
**Status**: Strategic plan, awaiting execution sign-off
**Scope**: How AMLIQ, TenantIQ, and sdlc.cc connect technically and commercially

---

## 1. The portfolio map (corrected)

```
┌──────────────────────────────────────────────────────────────────────┐
│                           THE PORTFOLIO                              │
└──────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────┐
                           │     sdlc.cc         │
                           │  Compliance LLM     │
                           │  Gateway            │
                           │                     │
                           │  - DLP (fintech)    │
                           │  - SAML SSO         │
                           │  - Audit (immutable)│
                           │  - Multi-provider   │
                           │  - Quotas + cost    │
                           │  - Transparent proxy│
                           │  - SaaS / VPC / air │
                           └──────────▲──────────┘
                                      │ HTTP /v1/messages
                                      │ (each consumer is a tenant
                                      │  with its own API key)
        ┌─────────────────────────────┼──────────────────────────────┐
        │                             │                              │
┌───────┴──────────┐         ┌────────┴─────────┐         ┌─────────┴───────┐
│  AMLIQ (aegis)   │         │     TenantIQ     │         │  Direct B2B     │
│                  │         │                  │         │  customers      │
│  AML screening   │         │  M365 management │         │                 │
│  for FIs         │         │  for MSPs        │         │  Bank devs      │
│                  │         │                  │         │  using Claude   │
│  Streams in:     │         │  Streams in:     │         │  Code, Cowork,  │
│  - txn data      │         │  - M365 webhooks │         │  SDK, etc.      │
│  - user data     │         │  - graph events  │         │                 │
│  - sanctions hits│         │  - tenant config │         │  via:           │
│                  │         │  - license usage │         │  - /v1/messages │
│  AI use cases:   │         │                  │         │  - transparent  │
│  - summarize     │         │  AI use cases:   │         │    proxy mode   │
│    alert         │         │  - misconfig     │         │  - DNS hijack   │
│  - draft SAR     │         │    analysis      │         │                 │
│  - adverse media │         │  - compliance    │         │                 │
│  - case writeup  │         │    reports       │         │                 │
│                  │         │  - license recs  │         │                 │
└──────────────────┘         └──────────────────┘         └─────────────────┘
        │                             │                              │
        │ Today: direct anthropic.go  │ Today: ai-clawpipe.ts        │ Today: SDK direct
        │ Future: sdlc.cc gateway     │ Future: sdlc.cc OR ClawPipe  │ Future: sdlc.cc
        │                             │   chained for cost+compliance│
        ▼                             ▼                              ▼

                  ┌─────────────────────────────────────┐
                  │     Anthropic / OpenAI / Gemma /    │
                  │     Bedrock / Ollama (local)        │
                  └─────────────────────────────────────┘
```

## 2. What's in each product (verified state, 2026-05-04)

### AMLIQ (`portfolio/aegis`)

- 78 migrations, 30+ Go internal packages
- Transaction ingestion: `api/handler_txn_*.go` (screen, monitor, alerts)
- Streaming endpoints: `api/handler_alerts_stream.go`, `api/handler_batch_stream.go`
- Currently: AI calls go to direct Anthropic via `internal/ai/anthropic.go`
- Has its own `/api/v1/ai/summarize` (alert/case/adverse_media templates)
- Domain: `amliq.finance` (frontend), `api.amliq.finance` (backend)
- ICP: AML compliance officers at FIs

### TenantIQ (`portfolio/tenantiq`)

- TypeScript / Node.js platform
- M365 integration for MSPs
- Has `apps/api/src/lib/ai-clawpipe.ts` — routes through ClawPipe (cost gateway)
- Has `apps/api/src/lib/ai-anthropic.ts` for direct calls
- Has `classifyM365Intent` helper that skips LLM for known patterns
- ICP: MSPs managing M365 tenants for SMB/mid-market

### sdlc.cc (will be `portfolio/sdlc-cc`, currently scaffolded inside aegis)

- The compliance LLM gateway
- All gateway features built this session: `/v1/messages`, fintech DLP,
  SAML SSO, multi-provider chain, observability, cache, quotas, SSE
  streaming, transparent-proxy planning
- Currently lives in aegis as `cmd/sdlc-api` (wrong location — should be
  separate repo per Topology B / dual-SKU decision)
- Domain: `sdlc.cc` (owned, currently parked)

### Sibling products (referenced, not changed)

- **ClawPipe** (`portfolio/clawpipe`) — cost-optimization gateway with
  21 LLM providers, semantic cache, 246 Booster rules, M365 intent
  classifier. Sibling, NOT the same as sdlc.cc.
- **OpenSyber** (`portfolio/opensyber`) — security agents.
- **PushCI / PipeWarden** — CI/CD security scanning.

## 3. The integration plan, per consumer

### 3.1 AMLIQ → sdlc.cc

**Today** (post this-session ship):
```
amliq-frontend → POST /api/v1/ai/summarize
  └→ aegis/api/handler_ai_summarize.go
      └→ aegis/internal/ai/AnthropicClient (direct)
          └→ api.anthropic.com
```

**Target** (after Z1 refactor):
```
amliq-frontend → POST /api/v1/ai/summarize
  └→ aegis/api/handler_ai_summarize.go
      └→ HTTP POST https://api.sdlc.cc/v1/messages
         (with AMLIQ's tenant API key in X-API-Key)
          └→ sdlc.cc DLP + audit + quota
              └→ Anthropic / Bedrock / Gemma
```

**Why this matters**:
- AMLIQ's transaction streams contain PANs, account numbers, customer
  IDs. Today aegis DLPs these locally before calling Anthropic. After
  refactor: sdlc.cc owns the DLP, aegis sends raw, sdlc.cc scrubs.
- One DLP implementation across the portfolio (no drift between AMLIQ's
  fintech DLP and TenantIQ's generic PII)
- AMLIQ's AI calls show up in sdlc.cc's observability log — tenant =
  "amliq-prod" — for cost attribution + audit

**Streaming-specific concern**:
- Customer streams 100K txns/min into AMLIQ
- AMLIQ's rules engine flags 0.1% (100/min) for AI review
- Each AI call: aegis → sdlc.cc → Anthropic
- sdlc.cc must handle the rate (per-tenant quota set high for AMLIQ)
- Backpressure: if sdlc.cc rate-limits, AMLIQ queues + retries
- Cost attribution: sdlc.cc bills AMLIQ as a tenant; AMLIQ bills its
  customer for AI usage (markup margin)

### 3.2 TenantIQ → sdlc.cc

**Today**:
```
TenantIQ web → API → ai-clawpipe.ts → ClawPipe → providers
```

**Target** (FI customers only):
```
TenantIQ web → API → router decides:
  - SMB customer: ai-clawpipe.ts → ClawPipe (cost-optimized)
  - FI customer: ai-sdlc.ts (NEW) → sdlc.cc (compliance-graded)
                  or chain: ai-sdlc.ts → sdlc.cc → ClawPipe → providers
                  (compliance scrub THEN cost route)
```

**The chain question**:
ClawPipe handles cost routing across 21 providers. sdlc.cc handles DLP
+ audit. Both add value. For an FI MSP customer who is BOTH cost-
sensitive AND regulated, the chain matters:

- **Option A**: TenantIQ → sdlc.cc → ClawPipe → providers (DLP first,
  cost route after — DLP'd prompts are still routable across providers)
- **Option B**: TenantIQ → ClawPipe → sdlc.cc → providers (cost first,
  DLP last — but ClawPipe might log raw prompts in its observability,
  defeating DLP)
- **Option C**: pick one based on customer config — most regulated
  customers want sdlc.cc only, accepting the cost premium

**Recommendation**: Option C. Add `tenantiq.config.ai_gateway` per
customer: `clawpipe` (default), `sdlc-cc` (FI tier), or `direct`
(internal dev). The TS code switches at request time.

**M365-specific concerns**:
- M365 events contain user emails, file paths, IPs, message subjects
  — generic PII that TenantIQ's existing DLP handles
- BUT for FI customers, M365 events also contain client names,
  account references, deal codenames — fintech-leaning
- sdlc.cc's MaskAML covers more of this than ClawPipe's generic guard

### 3.3 Direct B2B customers → sdlc.cc

This is the standalone product story. Three deployment shapes:

| Shape | Who | How |
|---|---|---|
| **SaaS** | SMB / startup FIs | Point Claude Code at api.sdlc.cc |
| **VPC self-host** | Mid-market banks | Docker image in their VPC, point at their Anthropic key |
| **Transparent proxy** | Tier-1 banks, GovCon, healthcare | DNS hijack + corp CA, all api.anthropic.com traffic flows through |
| **Air-gapped** | Classified, gov | Local Ollama + Gemma, no internet |

All four use the same Go binary; topology is config.

## 4. Streaming data flows — detailed

### 4.1 AMLIQ transaction streaming

```
Customer's bank
    │ (wire transfer / ACH event / card txn / KYC event)
    ▼
AMLIQ /api/v1/txn/stream  (HTTPS POST or webhook or Kafka topic)
    │
    ▼
aegis/internal/pipeline/txn_processor
    │
    ├─► Sanctions screening (synchronous, no AI)
    │     │
    │     ├─► Hit? → alert created
    │     └─► No hit? → recorded, done
    │
    ├─► AI-augmented analysis (when alert created or threshold breached)
    │     │
    │     ▼
    │   aegis/api/handler_ai_summarize_internal (NEW after refactor)
    │     │
    │     ▼
    │   HTTP POST https://api.sdlc.cc/v1/messages
    │   X-API-Key: <amliq-tenant-key>
    │   {
    │     "model": "claude-haiku-4-5",
    │     "messages": [{"role":"user", "content":"<alert+context>"}]
    │   }
    │     │
    │     ▼
    │   sdlc.cc applies:
    │     - MaskAML scrub (PAN/IBAN/BIC/Israeli ID + email/phone)
    │     - Audit row (tenant=amliq-prod, actor=alert-id, type=alert_summary)
    │     - Quota check (per-tenant + per-actor)
    │     - Provider call (Anthropic / Bedrock / fallback)
    │     - Response DLP scrub
    │     │
    │     ▼
    │   Response back to aegis
    │     │
    │     ▼
    │   aegis: alert.ai_summary = response.summary
    │   alert saved + emitted via /api/v1/alerts/stream
    │
    └─► Customer's downstream (their case mgmt, investigator UI)
```

### 4.2 TenantIQ M365 event streaming

```
Customer MSP's M365 tenants
    │ (sign-in events / mailbox config changes / license changes)
    ▼
Microsoft Graph webhook → tenantiq /webhooks/m365
    │
    ▼
tenantiq/apps/api/src/m365/event_processor
    │
    ├─► Local intent classifier (skip LLM if known pattern)
    │
    ├─► AI-augmented analysis (anomaly, recommendation, compliance check)
    │     │
    │     ▼
    │   tenantiq/apps/api/src/lib/ai-router.ts (NEW)
    │     │
    │     │ if customer.tier == "fi":
    │     │   → ai-sdlc.ts → POST https://api.sdlc.cc/v1/messages
    │     │ else:
    │     │   → ai-clawpipe.ts → POST https://api.clawpipe.ai/v1/prompt
    │     │
    │     ▼
    │   provider response
    │     │
    │     ▼
    │   tenantiq stores recommendation, emits to MSP dashboard
    │
    └─► MSP gets alert in their TenantIQ console
```

### 4.3 Direct B2B streaming (transparent proxy)

```
Bank's developer using Claude Code
    │ "explain this code"
    ▼
Claude Code → POST api.anthropic.com/v1/messages
    │
    │ (corp DNS resolves api.anthropic.com → 10.0.0.50 (sdlc.cc gateway))
    │ (corp CA-signed cert is trusted by laptop)
    │
    ▼
sdlc.cc gateway @ 10.0.0.50
    - DLP scrub (catches any PAN/IBAN in code comments)
    - Audit row (tenant identified by source IP CIDR)
    - Forward to real api.anthropic.com via outbound egress
    - DLP scrub response
    │
    ▼
Claude Code receives the response, never knew it didn't talk to
api.anthropic.com directly
```

## 5. The migration plan

### Phase 1: Scaffold sdlc.cc as own repo (Z1)

**Output**: `github.com/finsavvyai/sdlc-cc` exists with:
- Bucket A code copied from aegis (gateway features)
- Own `go.mod`
- Own `cmd/api` (was `cmd/sdlc-api` in aegis)
- Own Dockerfile + GitHub Actions
- Own migrations/ (subset of aegis migrations)
- Own README, LICENSE, CHANGELOG

**Cost**: 1 session (~3 hours)
**Aegis impact**: zero — code stays in aegis as a working copy until phase 2

### Phase 2: AMLIQ → sdlc.cc HTTP integration

**Changes in aegis**:
- New env: `SDLC_CC_BASE_URL`, `SDLC_CC_API_KEY`
- New file `internal/sdlc/client.go` — HTTP client for sdlc.cc/v1/messages
- `handler_ai_summarize.go` switches from `ai.AnthropicClient` to `sdlc.Client`
- Tests updated (mock HTTP instead of mock summarizer)
- Deprecate `internal/ai/anthropic.go` for AMLIQ's own use (still used by sdlc.cc internally)

**Cost**: 1 session
**Risk**: AMLIQ's running pilots see latency increase from one network hop. Mitigation: deploy sdlc.cc in same Render region.

### Phase 3: TenantIQ → sdlc.cc routing

**Changes in tenantiq**:
- New `apps/api/src/lib/ai-sdlc.ts` (TS HTTP client)
- New `apps/api/src/lib/ai-router.ts` (per-tenant tier-based routing)
- Customer config: `ai_gateway` field on tenant
- Tests for both routes

**Cost**: 0.5 session
**Risk**: low — TenantIQ already supports multiple gateways

### Phase 4: sdlc.cc transparent-proxy mode

**Output** (per earlier conversation):
- Host-header-aware routing (api.anthropic.com → /v1/messages)
- Network → tenant identification
- Forward-proxy for non-DLP'd endpoints
- Deploy guide for corp CA + DNS setup

**Cost**: 2-3 sessions
**Risk**: TLS interception is a bigger security claim — needs careful audit.

### Phase 5: Cross-product cost attribution + dashboard

**Output**:
- sdlc.cc tracks `tenant_origin` (amliq-prod, tenantiq-prod, direct-XXX)
- Cost rollup shows per-product spend
- Each consumer pays sdlc.cc "internal pricing" → marks up to its end customer

**Cost**: 1 session
**Risk**: pricing model is a business decision, not pure tech

## 6. Pricing / commercial model

### Internal (within portfolio)

- AMLIQ pays sdlc.cc: cost-plus 10% (it's the same company)
- TenantIQ pays sdlc.cc: cost-plus 10%
- Both products bill their customers for AI usage at their own markup
- One Anthropic enterprise contract — sdlc.cc holds it, splits costs

### External

- sdlc.cc directly to FI customers: tiered SaaS or self-host
  - Free: 100 msg/day, 1 user
  - $99/mo: 10K msg/day, 5 users
  - $499/mo: 100K msg/day, 25 users
  - $999/mo + per-seat: self-hosted, unlimited
  - $25K/yr: FI Pilot (trial), graduates to $250K+/yr Enterprise

## 7. ICP / sales motion overlap

| Buyer | AMLIQ | TenantIQ | sdlc.cc |
|---|---|---|---|
| FI compliance officer | ✅ primary | — | (via AMLIQ) |
| MSP managing M365 | — | ✅ primary | (via TenantIQ for FI MSPs) |
| FI CISO / DevOps | (intro via AMLIQ) | (intro via TenantIQ) | ✅ primary |
| GovCon / healthcare CISO | — | — | ✅ primary |
| Israeli bank | ✅ via AMLIQ + sdlc.cc | — | ✅ primary |

**Cross-sell pattern**:
- Land AMLIQ at a bank → introduce sdlc.cc to their dev team for Claude Code
- Land TenantIQ at an MSP → upsell sdlc.cc when MSP has FI clients
- Land sdlc.cc at a bank → introduce AMLIQ to their compliance dept

This is the "portfolio of compounding wedges" play. Each product
sells an adjacent product after landing.

## 8. Open questions / decisions needed

1. **Pricing tiers** — exact $ for sdlc.cc Free / Pro / Enterprise?
2. **Commercial relationship between products** — is sdlc.cc a separate
   P&L or a cost center to AMLIQ + TenantIQ?
3. **Domain strategy** — sdlc.cc (gateway) vs sdlc.io vs amliq-gateway —
   you own sdlc.cc, that wins
4. **Anthropic enterprise contract** — one for the portfolio or per-product?
5. **SOC2 timeline** — necessary for sdlc.cc? Required by FI buyers in 2026
6. **ClawPipe vs sdlc.cc positioning** — when do customers want which?
   ClawPipe = cost; sdlc.cc = compliance. Some want both chained.
7. **Verify Anthropic Cowork BASE_URL support** — open per CLAUDE_COWORK_INTEGRATION docs

## 9. Concrete next move

**Recommended order**:

1. **Today (1 hour)**: this doc lands as commit. You read + push back.
2. **Phase 1 (3 hours)**: scaffold `sdlc-cc` repo. Bucket A code copy.
3. **Phase 2 (3 hours)**: AMLIQ refactor to call sdlc.cc via HTTP.
4. **Verify**: AMLIQ pilot still works end-to-end.
5. **Phase 3 (2 hours)**: TenantIQ adds sdlc.cc as a router target.
6. **Phase 4 (3 sessions)**: sdlc.cc transparent-proxy mode for the
   bank-deployment story.
7. **Phase 5 (3 hours)**: cost attribution + cross-product dashboard.

Total: ~6 sessions of focused work to get all three products on the
target architecture. Each phase ships independently — pilots keep
working at every step.

---

**Author note**: This doc supersedes earlier sunset/pivot notes that
treated sdlc.cc as folded into AMLIQ. The corrected model is:
**sdlc.cc is its own product; AMLIQ and TenantIQ are two of its
customers; all three sell to overlapping FI / regulated buyers**.
