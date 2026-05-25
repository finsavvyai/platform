# SDLC.cc — Competitive Positioning (Q2 2026)

Source: parallel deep-dives on Portkey, Lakera, Helicone, Langfuse, Lasso Security.

## Where everyone sits

| Competitor | Layer | OSS? | Pricing | Funding | Threat to SDLC |
|---|---|---|---|---|---|
| **Portkey** | Gateway + observability | MIT, 11.4k★ | $49/mo Production → custom Enterprise | $18M (Series A Feb 2026) | **High** — closest mirror, mature OSS distribution |
| **Lakera** | Guardrail (sidecar) | Closed (Gandalf data only) | $99–$499/mo + Enterprise | $30M, **acquired by Check Point Nov 2025** | Medium — now Check Point feature, indie window open |
| **Helicone** | Gateway + observability | Apache-2, 5.5k★ | Free 10k → $79 → $799 → custom | YC W23, ~5 ppl, **acquired** | Medium — strong dev DX + free tier |
| **Langfuse** | Observability + eval (post-call) | MIT, 25.2k★ | Free → $29 → $199 → $2,499 | YC W23 | **Complementary** — integrate, don't fight |
| **Lasso** | Browser ext + proxy + shadow-AI | Closed | Demo-only (no public price) | ~$28M | High in CISO sale; weak in dev sale |

## SDLC's structural advantages (cross-cutting)

1. **Full-stack scope** — Portkey/Helicone do gateway+obs but no RAG; Lakera/Lasso do guardrails but no gateway routing/RAG/billing; Langfuse is post-call only. SDLC is the only one that ships **gateway + DLP + multi-LLM routing + RAG + SCIM + on-prem** in one repo.
2. **Real DLP (not last-message regex)** — Portkey's docs admit guardrails only scan the last message. SDLC's presidio + OPA evaluates full payload + RAG context.
3. **Zero-trust multi-tenant by construction** — Postgres RLS at every table; Portkey/Helicone rely on app-layer RBAC.
4. **OPA policy-as-code** — declarative policy across gateway, RAG retrieval, DLP. Nobody else ships this.
5. **First-class on-prem / air-gap** — not a sales-call upsell. Lakera self-hosts only the Guard module; Lasso is SaaS-only.
6. **SCIM 2.0 + SAML in core** — Portkey has no SCIM doc; Lakera no SCIM; Helicone gates SSO behind Enterprise; Langfuse SCIM is Enterprise-only.
7. **Cloudflare Worker edge proxy** — sub-50ms overhead vs Portkey's 20–40ms admitted tax.

## SDLC's gaps (cross-cutting)

1. **Brand / customer logos** — every competitor has 5–10 named enterprise logos. SDLC has none public.
2. **OSS distribution flywheel** — Portkey 11.4k★, Helicone 5.5k★, Langfuse 25.2k★. SDLC repo is private; zero developer pull.
3. **Free tier as wedge** — Helicone hands out 10k req/mo free; Langfuse 50k events. SDLC has no self-serve free entry.
4. **Prompt management UX** — Portkey, Helicone, Langfuse all ship versioned prompts + Playground. SDLC has none.
5. **Eval harness** — Langfuse owns LLM-as-judge + datasets; SDLC has no Ragas/regression-test surface.
6. **Browser extension for shadow-AI** — Lasso's #1 CISO demo moment (13% of GenAI prompts leak sensitive org data). SDLC has nothing on the consumer-tab leakage path.
7. **Latency / FP-rate published numbers** — Lakera publishes <50ms + 0.01% FP. SDLC has no SLO claims on DLP latency or false positives.
8. **Prompt-injection research credibility** — Lakera owns Gandalf (35M attacks) + OWASP co-author seat. SDLC has no research narrative.

## Top 5 moves this quarter (deduped + ranked)

### Move 1 — Open-source the gateway core (Apache-2.0)
**Why:** every competitor with traction (Portkey, Helicone, Langfuse) has 5k+ stars. Closed repo = zero developer pull. Opens the "transparent independent alternative" narrative right after Lakera's Check Point acquisition.

**What ships:** `github.com/finsavvyai/sdlc-gateway` — Go gateway core, Cloudflare Worker recipe, Helm chart, MIT/Apache license. Keep DLP detectors, OPA bundles, RAG, admin UI as commercial.

**Effort:** 1 week to extract + scrub. Use `/ll-promote` + `/ll-go-viral` for HN/r/LocalLLaMA/awesome-llm push.

**Target:** 1k stars in 60 days.

### Move 2 — Free tier + drop-in OpenAI-compatible proxy
**Why:** Helicone's "change base_url, done" 5-minute install is their wedge. SDLC needs the same on-ramp.

**What ships:** `api.sdlc.cc/v1` OpenAI-compat proxy. 5k req/mo free, **PII redaction always on even on free tier** — the headline Helicone can't match.

**Pricing tiers (transparent, on the public site):**
- Free: 5k req/mo, 7-day retention, DLP on
- Team: $5K/mo (was placeholder; verify market)
- Business: $15K/mo
- Enterprise: BYO-cloud / on-prem SKU

**Effort:** 3 days for the proxy + signup + key issuance UI.

### Move 3 — Browser extension for shadow-AI (Lasso killer)
**Why:** Lasso's #1 CISO demo. SDLC has no consumer-tab story. Manifest V3 ext that proxies ChatGPT/Claude.ai/Gemini/Copilot through `api.sdlc.cc` neutralizes it.

**What ships:** `sdlc-extension/` — Chrome + Edge MV3, presidio + OPA pre-send, logs to existing audit pipeline. 5-minute install.

**Effort:** 2 weeks. Highest-leverage CISO sales asset.

### Move 4 — Native Langfuse-compatible API + integration
**Why:** Langfuse is leverage not threat — for now. They're one release away from a "Langfuse Gateway." Insurance: implement `/api/public/scores`, `/traces`, `/prompts` endpoints that match their OpenAPI. Customers point existing Langfuse SDK at `api.sdlc.cc`.

**Bonus:** ship "Reference architecture" — `App → SDLC Gateway (DLP/Policy/Route) → LLM → Langfuse (Trace/Eval)` — and co-market on `sdlc.cc/integrations/langfuse`.

**Effort:** 1 week for compat shim.

### Move 5 — Public attack arena + OSS guard model
**Why:** Lakera owns Gandalf (35M attacks). SDLC needs research credibility.

**What ships:** `sdlc.cc/arena` — public CTF where users jailbreak `sdlc-guard`. Every attack feeds labeled dataset → public `attacks-v1` release → OWASP LLM Top 10 working group submission.

**Bonus:** wrap presidio + a fine-tuned DeBERTa prompt-injection model, publish weights on HuggingFace. Capture Lakera-defection traffic.

**Effort:** 3-4 weeks.

## 90-day positioning

> **"Helicone shows you what your LLMs did. SDLC stops them from doing the wrong thing — across every LLM, before they did it."**

Tagline tests:
- vs Portkey: *"OPA policy-as-code + true multi-payload DLP, not last-message regex."*
- vs Lakera: *"Independent. Open. Not a Check Point feature."*
- vs Helicone: *"DLP + tenant isolation + on-prem at every tier — even free."*
- vs Langfuse: *"The enforcement plane above your observability layer."*
- vs Lasso: *"Same shadow-AI control. Self-serve. Transparent pricing."*

## What we deliberately do NOT do

- **Don't compete with Langfuse on observability** — integrate them as default, position as the layer above.
- **Don't try to out-research Lakera on prompt injection** — match via OSS arena, but Gandalf has a 4-year head start.
- **Don't chase Portkey on provider count** (250+) — own the "regulated verticals + on-prem + RAG" niche where they can't follow.
- **Don't sell to dev tooling buyers** when Lasso wedges via CISO — segment by buyer; lead with developer free tier, expand to CISO via SCIM/SOC2/audit.

## Funding-round implication

Three competitors raised within 18 months:
- Portkey $15M Series A (Feb 2026)
- Lakera $20M Series A (Jul 2024) → acquired Nov 2025
- Lasso ~$22M+ across rounds

SDLC has no funding signal. Either ship the OSS + named-customer story to make a Seed/Series A defensible, or position for acquisition by Cloudflare / GitLab / Snyk / Wiz / Datadog within 18 months.
