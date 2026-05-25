# Competitive Moves — Implementation Plan (Q2 2026)

5 moves from `docs/competitive-analysis.md`. Total ~8 wks calendar with 2 streams running parallel; ~6 wks if 3 streams.

## Dependency graph

```
   M1 OSS gateway ─────────────────────┐
            │                          │
            ▼                          │
   M2 Free tier proxy ◄─── (uses OSS gateway as base)
            │                          │
            │                          ▼
            │                   M5 Arena + OSS guard ─── (independent, can start anytime)
            │                          
   M3 Browser extension ── (independent, parallel to M1/M2)
            │
   M4 Langfuse shim ── (independent, can pair with M2)
```

**Critical path:** M1 → M2 (proxy needs the OSS gateway as its base).
**Parallel streams:** {M1, M3, M5} concurrent week 1-3, then {M2, M4} once M1 ships.

## Phase 0 — Setup (day 1)

- [ ] Create new repo `github.com/finsavvyai/sdlc-gateway` (public, empty, Apache-2.0)
- [ ] Create `sdlc.cc/arena` route placeholder + waitlist form
- [ ] Provision HF org `sdlc-ai` for guard model + datasets
- [ ] Open Stripe account, get test mode keys
- [ ] Reserve Chrome Web Store + Edge Add-ons developer accounts ($5 + $19 one-time)
- [ ] Branch `feat/competitive-moves` off main as integration branch

---

## M1 — OSS gateway core (Wk 1)

### Files to create

```
sdlc-gateway/                              # NEW PUBLIC REPO
├── LICENSE                                # Apache-2.0
├── README.md                              # 5-min quickstart
├── COMPARISON.md                          # vs Portkey/Helicone (the kill-shot doc)
├── Makefile                               # build/test/run
├── cmd/server/                            # subset of services/gateway/cmd/server
├── internal/infrastructure/
│   ├── ratelimit/                         # tier_rate_limiter (already polished)
│   ├── redisclient/                       # client (already polished)
│   ├── fingerprint/                       # device fingerprint (already polished)
│   ├── events/                            # publisher (already polished)
│   └── scim/                              # SCIM 2.0 (already polished)
├── deployments/helm/                      # Helm chart with values.yaml
├── deployments/cloudflare-worker/         # Wrangler recipe
└── examples/
    ├── docker-compose.yml                 # Postgres + Redis + gateway
    └── kubernetes/                        # K8s manifests
```

### What stays proprietary

- Full presidio detector stack (services/dlp/) — only stub interface in OSS
- OPA bundles for tenant policies — only example/sdlc.example.rego in OSS
- RAG (services/rag/) — referenced as "use any RAG" in README
- admin-ui — keep private as commercial wedge

### Tasks

1. `git subtree split` services/gateway/internal/infrastructure/{ratelimit,redisclient,fingerprint,events,scim} into staging branch
2. Replace internal types with public-friendly equivalents (no leak of business logic)
3. Write `README.md`: 5-min quickstart, badges, OSS comparison
4. Write `COMPARISON.md`: side-by-side feature matrix vs Portkey/Helicone with citations
5. Helm chart with realistic defaults (Postgres + Redis + replicas: 2)
6. Cloudflare Worker recipe deploying gateway-as-edge-binary
7. CI: GitHub Actions for build + test + container publish to ghcr.io
8. CONTRIBUTING.md + CODE_OF_CONDUCT.md
9. Push v0.1.0 tag → ghcr.io/finsavvyai/sdlc-gateway:v0.1.0

### Acceptance

- `helm install sdlc-gateway ./deployments/helm` → working gateway in <2 min
- `wrangler deploy` from cloudflare-worker/ → live worker
- `curl https://localhost:8080/health` returns 200
- README rendered nicely on github.com
- 1k stars in 60 days post-launch (tracked, not blocking)

### Risks

- Accidentally committing internal IP (DLP detectors, customer logos in tests, Stripe keys). Mitigation: pre-commit secret scan + manual review.
- Star count target depends on launch quality; bad HN post = 50 stars. Mitigation: time HN launch with Show HN format on Tue 8am PT.

---

## M2 — Free tier + OpenAI-compat proxy (Wk 2-3, depends on M1)

### Files to create / edit

```
services/proxy-worker/src/
├── compat-openai.ts                       # /v1/chat/completions, /v1/embeddings, /v1/models
├── compat-anthropic.ts                    # /anthropic/v1/messages
├── tenant-onboarding.ts                   # signup → key → KV write
├── stripe-webhook.ts                      # plan changes
└── rate-limit-tier.ts                     # 5k/mo free, 100k/mo team, etc.

landing-page/pages/
├── pricing.tsx                            # Free/Team/Business/Enterprise
├── signup.tsx                             # email → magic link → key
└── dashboard/                             # usage + key rotation + billing

services/admin-ui/src/                     # add billing tab if not exists
```

### Tasks

1. Implement `/v1/chat/completions` passthrough → OpenAI with DLP scan pre-send
2. Implement `/v1/embeddings` same pattern
3. Implement `/anthropic/v1/messages` → Anthropic with same DLP
4. Tenant signup flow: email → Clerk magic link → tenant created → API key minted → KV writes
5. Stripe Products: Free ($0), Team ($5K/mo, 100k req), Business ($15K/mo, 1M req), Enterprise (contact)
6. Stripe webhook handler updates KV record with current tier
7. Pricing page wired to Stripe Checkout
8. Dashboard: usage chart (last 30d req), copy-to-clipboard key, rotate key, view audit log preview
9. Per-tenant rate limit enforcement (Redis token bucket, tier-aware)
10. Email notifications: 80% quota / over-quota (Resend or Postmark)

### Acceptance

- Sign up at sdlc.cc/signup with throwaway email → get key in <60s
- `curl api.sdlc.cc/v1/chat/completions -H "Authorization: Bearer $KEY" -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"my SSN is 123-45-6789"}]}'` returns response with SSN redacted in upstream
- Hit 5k requests on free → 429 with upgrade link
- Stripe upgrade → next request goes through at new tier
- Dashboard shows usage chart matching actual consumption

### Risks

- Stripe wiring is fiddly; budget extra day for webhook signature verification + idempotency
- Free tier abuse — set per-IP signup rate limit + email verification required
- Upstream LLM costs: 5k/mo at GPT-4o-mini ≈ $5 — manageable; cap output tokens at 1k per request

---

## M3 — Browser extension MV3 (Wk 1-2, parallel)

### Files to create

```
sdlc-extension/                            # new repo or subdir
├── manifest.json                          # MV3
├── src/
│   ├── background.ts                      # service worker
│   ├── content.ts                         # inject into chatgpt.com, claude.ai, gemini.google.com, copilot.microsoft.com
│   ├── proxy-bridge.ts                    # wrap fetch/XHR; route through api.sdlc.cc
│   ├── presidio-wasm.ts                   # local PII scan (presidio compiled to WASM via pyodide or hand-port to TS)
│   ├── popup/                             # toggle on/off, view recent blocked
│   └── options/                           # SDLC API key + tenant settings
├── icons/                                 # 16/48/128
└── store-listing/                         # Chrome + Edge store assets
```

### Tasks

1. Manifest V3 with host_permissions for chatgpt.com / claude.ai / gemini.google.com / copilot.microsoft.com
2. Content script intercepts form submission on each chat surface
3. Run local PII scan (TS port of presidio's regex tier — full presidio is too heavy for browser)
4. If PII found: show inline warning + auto-redact + log event to api.sdlc.cc/v1/audit
5. Popup UI: ON/OFF toggle, count of blocks today, link to dashboard
6. Options page: paste SDLC tenant key, choose policy (strict / balanced / permissive)
7. Submit to Chrome Web Store + Edge Add-ons (review takes 3-7 days)
8. Landing page: sdlc.cc/extension with install buttons

### Acceptance

- Install from Chrome Web Store → enter SDLC key → visit chatgpt.com
- Type "my email is alice@acme.com please summarize" → email auto-redacted before send
- Audit log entry visible in admin dashboard
- Approval from Chrome Web Store within 2 weeks

### Risks

- Chrome Web Store review may flag privacy concerns (it intercepts user input). Mitigation: clear privacy policy, opt-in toggle, all processing local-first
- Sites change DOM; need MutationObserver fallbacks
- presidio WASM is ~30MB; may need to ship lite version

---

## M4 — Langfuse-compat shim (Wk 3, parallel with M2)

### Files to create / edit

```
services/gateway/internal/interfaces/http/handlers/langfuse_compat.go
services/gateway/internal/infrastructure/langfuse/
├── ingest.go                              # accept Langfuse trace shape, emit to internal events bus
├── scores.go                              # /api/public/scores endpoint
├── traces.go                              # /api/public/traces endpoint
└── prompts.go                             # /api/public/prompts endpoint

docs/integrations/langfuse.md              # reference architecture
landing-page/pages/integrations/langfuse.tsx
```

### Tasks

1. Read Langfuse OpenAPI spec, generate Go types
2. Implement POST /api/public/traces → forward to gateway events publisher with langfuse.* event type
3. Implement POST /api/public/scores → store in dedicated Postgres table + emit event
4. Implement GET/POST /api/public/prompts → backed by tenant prompt store (new table)
5. Auth: accept Langfuse-style basic auth (`pk_xxx:sk_xxx`) AND SDLC bearer tokens
6. Reference architecture diagram (mermaid) showing `App → SDLC (DLP/policy/route) → LLM → Langfuse (trace)` AND `App → Langfuse SDK → SDLC compat endpoint (acts as Langfuse + adds DLP)`
7. Co-marketing: blog post `Using Langfuse with SDLC: defense in depth`
8. Tutorial: drop-in replace LANGFUSE_HOST=https://api.sdlc.cc

### Acceptance

- `pip install langfuse && langfuse.init(host="https://api.sdlc.cc", public_key=$KEY, secret_key=$SECRET)` works
- Trace + score + prompt SDK calls all return 200
- Langfuse SDK's prompt fetch returns the tenant's prompt
- Audit log records the API call

### Risks

- Langfuse API surface is large; cover only the 80% (traces/scores/prompts) and document gap

---

## M5 — Public attack arena + OSS guard model (Wk 4-7)

### Files to create

```
sdlc-arena/                                # new repo
├── README.md
├── apps/
│   ├── web/                               # Next.js app on sdlc.cc/arena
│   │   ├── pages/index.tsx                # leaderboard + active challenges
│   │   ├── pages/play/[challenge].tsx     # CTF interface
│   │   └── pages/api/                     # submit attempt, score
│   └── worker/                            # Cloudflare Worker that runs sdlc-guard against submissions
└── data/
    └── attacks-v1.jsonl                   # public dataset

models/sdlc-guard/                         # new HF repo
├── README.md (model card)
├── config.json                            # DeBERTa-v3-base fine-tune
├── pytorch_model.bin
├── tokenizer.json
└── examples/
    ├── infer.py
    └── eval.py
```

### Tasks

1. Pick base: microsoft/deberta-v3-base. Fine-tune on:
   - Lakera Gandalf public attack samples (35M)
   - awesome-llm-security dataset
   - JailbreakBench benchmark
2. Train on Modal/Lambda Labs or local GPU (~$50)
3. Eval: target ROC-AUC > 0.95 on held-out
4. Publish weights to HF: `sdlc-ai/sdlc-guard-v1`
5. Build arena Next.js app with 5 starter challenges:
   - Direct prompt injection
   - Indirect (RAG context poisoning)
   - PII leakage
   - System prompt extraction
   - Jailbreak via roleplay
6. Submission flow: user types attack → guard scores → if score > threshold = blocked = 0 pts; if bypassed = points = leaderboard
7. Daily snapshot of new bypasses → labeled dataset → biweekly retrain
8. Public dataset on HF Datasets: `sdlc-ai/attacks-v1`
9. OWASP LLM Top 10 working group submission with arena results
10. Launch post on HN + Twitter when first 100 attacks landed

### Acceptance

- sdlc.cc/arena live with 5 challenges + leaderboard
- HF model downloadable + scores reasonably on test set
- 100+ unique attacks in dataset within 30 days of launch
- 1+ research mention or OWASP citation within 90 days

### Risks

- Training cost / time: budget 2 weeks for first decent model
- Arena could get flooded by bots; require auth (GitHub OAuth)
- Bypasses become public 0-days; rate-limit + responsible disclosure window

---

## Cross-cutting

### Marketing schedule

| Wk | Asset | Channel |
|---|---|---|
| 1 | OSS gateway repo public | Show HN, r/LocalLLaMA, awesome-llm PRs |
| 2 | Free tier + signup | dev.to article, Twitter, ProductHunt teaser |
| 3 | Browser ext beta | LinkedIn (CISO audience), security newsletters |
| 4 | Langfuse integration post | Co-publish with Langfuse, dev.to, X |
| 5 | Pricing transparency post | "Why we publish prices unlike Lasso" |
| 6 | sdlc-guard model launch | HF community, ML Twitter, OWASP working group |
| 7 | Arena public launch | Show HN, security CTF channels, university partnerships |
| 8 | Quarter wrap: case study + customer logo #1 | All channels |

### Hiring needs

- 1 frontend dev (M2 dashboard + M5 arena UI)
- 1 ML eng for M5 model (or contract for 4 wks)
- 0.5 DevRel for OSS launch + content

### Budget

- HF inference: $50/mo
- Modal/Lambda training: $200 one-time + $100/mo
- Stripe fees: 2.9% + 30¢ per transaction
- Chrome/Edge store: $24 one-time
- Marketing: $2K/mo (PostHog + Resend + LinkedIn ads for CISO ABM)

### Success metrics (90 days)

| Metric | Target |
|---|---|
| OSS gateway stars | 1,000 |
| Free tier signups | 500 |
| Paid Team plans | 5 |
| Browser ext installs | 1,000 |
| Arena unique attackers | 200 |
| HF model downloads | 5,000 |
| Named customer logo | 1 |
| Inbound press | 2 mentions |

### Kill criteria (when to abandon a move)

- M1: <100 stars after 30 days → restart with better launch + influencer push
- M2: <20 signups in week 1 → audit funnel, free-tier UX, signup friction
- M3: Chrome Web Store rejection → pivot to Brave + Firefox first
- M4: Langfuse releases their own gateway in same window → reposition as "Langfuse policy add-on"
- M5: <50 attacks in 30 days → drop arena, keep model as a download
