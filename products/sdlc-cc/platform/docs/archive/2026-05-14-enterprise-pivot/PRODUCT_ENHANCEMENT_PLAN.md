# Plan: Enhancing SDLC Platform to a Real Product

**Purpose:** Turn the current baseline (landing, auth, dashboard, gateway, LLM gateway) into a shippable, monetizable product.  
**Aligned with:** [VISION.md](./VISION.md), [SPRINTS_PLAN.md](./SPRINTS_PLAN.md)  
**Horizon:** Next 6–12 months (real product = paying users, clear value, production ops).

---

## 1. Current State vs. “Real Product”

| Dimension | Current state | Real product target |
|-----------|----------------|----------------------|
| **Landing & acquisition** | Landing at sdlc.cc, Clerk auth, demo form, pricing UI | Clear value prop, signup → first value in &lt;1 day, optional paid plans |
| **Dashboard** | API keys, getting-started, basic layout | Usage, limits, billing, team/settings, support |
| **Monetization** | Stripe checkout + webhook, plans defined | Working subscriptions, usage-based or seat-based, invoicing path |
| **Core platform** | Gateway (Go), LLM Gateway (Go), some K8s/deploy | Stable APIs, SLOs, multi-tenant isolation, audit trail |
| **Trust & compliance** | Architecture and docs | Health checks, audit log (last N), security/legal pages, SOC2 prep |
| **Operations** | CI, deploy to Cloudflare Pages | Staging/prod parity, observability, alerting, rollback, runbooks |
| **Users** | Alpha / pilot | 10+ active orgs, 20+ paying (per vision), NPS/retention tracked |

---

## 2. Enhancement Phases

### Phase 1 — Stabilize & Ship (0–3 months)

**Goal:** One clear path from “visit site” to “using the product” with no broken promises.

1. **Landing & onboarding**
   - Harden signup/sign-in (Clerk); fix or hide flows that assume keys/env not yet set.
   - Single “first value” path: sign up → create API key → call Gateway or LLM Gateway once (docs + minimal SDK or curl).
   - Demo form → lead in CRM or email; optional waitlist for alpha.

2. **Dashboard**
   - API key CRUD, usage (calls/tokens or equivalent), link to docs.
   - Getting-started checklist (create key, first request, optional billing).
   - Settings: profile, org name, notification preferences (email for limits/downtime).

3. **Payments**
   - Stripe: Free + paid tiers; webhook for subscription lifecycle; sync state to app DB.
   - Billing page: current plan, usage (if usage-based), upgrade/downgrade.
   - Optional: usage-based billing (e.g. per 1K tokens) with Stripe metered billing.

4. **Platform**
   - Gateway + LLM Gateway: stable APIs, auth (API key / JWT), rate limits, CORS.
   - Deploy: production + staging; health checks; no Critical/High vulns in main.

5. **Quality & security**
   - Critical paths (auth, payments, key management): 100% test coverage; 90%+ overall.
   - SAST/dependency/secret scans in CI; audit log for key creation, plan changes, admin actions.

**Outcome:** New user can sign up, get an API key, make a successful call, and (if applicable) subscribe. No merge with failing CI or known Crit/High.

---

### Phase 2 — Monetize & Retain (3–6 months)

**Goal:** Predictable revenue and retention; product feels “real” to buyers.

1. **Pricing & packaging**
   - Clear tiers (e.g. Free, Starter, Pro, Enterprise) with limits (requests, tokens, seats).
   - Optional: annual billing, team/seat add-ons, enterprise quote flow.

2. **Usage & limits**
   - Per-tenant usage tracking; enforce limits; soft then hard (e.g. 429 + upgrade CTA).
   - Dashboard: usage vs. plan, forecasts, “upgrade” when approaching limit.

3. **Trust & compliance**
   - Public security page, privacy policy, terms; DPA template for enterprise.
   - Audit log (last 100–1000 events) in dashboard or export; immutable log later.
   - SOC2 prep: controls, evidence, runbooks (align with S13–S16 in sprints).

4. **Support & feedback**
   - In-app help (docs, status page link); contact/support channel.
   - Optional: in-app feedback widget; track NPS or “would you recommend?”.

5. **Reliability**
   - SLOs (e.g. 99.5% uptime); basic alerting (PagerDuty/Opsgenie/slack); incident runbooks.
   - Post-mortem template; blameless culture.

**Outcome:** Paying users see value and limits; enterprise can evaluate with security/legal artifacts; incidents are detected and handled.

---

### Phase 3 — Scale & Differentiate (6–12 months)

**Goal:** Product scales and stands out (SDLP vision).

1. **Multi-tenant & scale**
   - Tenant isolation (data + compute); rate limits and quotas per tenant.
   - Optional: multi-region or edge regions for latency/data residency.

2. **SDLP value**
   - RAG + DLP in pipeline (per S5–S6); LLM Gateway prompt firewall / output sanitization (S6).
   - OPA/policy in Gateway (S7); basic policy UI in Admin (S7).
   - Learning Engine / LAM (S9–S10): start with one agent (e.g. policy or cost); dashboard metrics.

3. **Enterprise**
   - SSO (SAML), SCIM, RBAC, team management (S14).
   - SOC 2 Type I/II in progress; HIPAA BAA if targeting healthcare.

4. **Ecosystem**
   - SDKs (Go, TS, Python) with quickstart and API reference (S8).
   - Certified connectors or partner integrations (later marketplace).

5. **Product metrics**
   - Activation (signed up → first successful API call); retention (D7, D30); revenue (MRR/ARR).
   - Usage (calls, tokens, tenants); support (tickets, NPS).

**Outcome:** Product is clearly “secure data learning platform,” not just an API proxy; enterprise can adopt with SSO and compliance; metrics drive decisions.

---

## 3. Priorities (What to Do First)

| Priority | Area | Next 2–4 weeks |
|----------|------|-----------------|
| P0 | **Stability** | Green CI (lint, test, build); no Crit/High; deploy to staging + prod (e.g. sdlc.cc) |
| P0 | **First value** | Docs: “Get API key → first request” in &lt;10 min; fix onboarding so it matches |
| P1 | **Payments** | Stripe webhook → DB; billing page (plan, usage if applicable); upgrade flow |
| P1 | **Dashboard** | Usage (calls/tokens); limits and upgrade CTA |
| P2 | **Trust** | Security page; audit log (last N events) in UI or export |
| P2 | **Operations** | Health + alerting; runbooks for deploy and incidents |

---

## 4. Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
|--------|--------|--------|--------|
| Signup → first API call | &lt;1 day | &lt;1 hour | &lt;10 min |
| Paying users | 0 → 5 | 5 → 20 | 20+ |
| Uptime (prod) | 99%+ | 99.5%+ | 99.9% |
| Critical path test coverage | 100% | 100% | 100% |
| Security (Crit/High) | 0 | 0 | 0 |
| Audit log | Optional | Last 100+ | Immutable, export |

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|------|-------------|
| Scope creep | Stick to Phase 1 scope until “first value” and payments work; then Phase 2 |
| Compliance delays | Start SOC2 prep early; use DPA/security page as soon as sales need them |
| Single point of failure | Document runbooks; add health checks and alerting before scaling |
| Low activation | Measure signup → first call; improve onboarding and docs iteratively |

---

## 6. Mapping to Sprints (SPRINTS_PLAN)

- **Phase 1** ≈ S1–S4 (Gateway, Auth, Dashboard, Health, Alpha onboarding) + Stripe (S12) brought forward where possible.
- **Phase 2** ≈ S11–S16 (Compliance, Billing, SOC2 prep, Enterprise features, Beta, Certifications).
- **Phase 3** ≈ 2026 Q1–Q2 (multi-tenant, DR, enterprise pilots) + S5–S10 (RAG, LLM Gateway, OPA, LAM).

Use [SPRINTS_PLAN.md](./SPRINTS_PLAN.md) for week-level breakdown; this plan stays at product-level “what makes it a real product.”

---

## 7. Summary

| Phase | Focus | Outcome |
|-------|--------|---------|
| **1 — Stabilize & Ship** | First value, dashboard, payments, platform stability, tests/security | User can sign up, get key, call API, pay |
| **2 — Monetize & Retain** | Tiers, usage/limits, trust (security, audit), reliability | Revenue + retention; enterprise can evaluate |
| **3 — Scale & Differentiate** | Multi-tenant, RAG/LLM/OPA/LAM, SSO, SOC2, metrics | SDLP differentiator; enterprise-ready |

**Next concrete steps:** Execute P0 (green CI, deploy, first-value docs and onboarding), then P1 (Stripe → DB, billing page, dashboard usage).

---

*Last updated: February 2026. Owner: Product/Engineering. Review quarterly and adjust phases to actual traction.*
