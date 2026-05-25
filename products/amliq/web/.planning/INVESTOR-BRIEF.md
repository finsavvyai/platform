# AMLIQ — Investor Brief

_Internal one-pager. Not published to the marketing site. Source-of-truth for investor conversations and DD responses._

**Last updated:** 2026-05-20 · Sprint Day 3 (Wk 1) · maintained by founder.

---

## 1. What AMLIQ Is

B2B sanctions-screening infrastructure for banks, PSPs, neobanks, and crypto-adjacent fintechs.

API-first. Sub-50ms decisions. Multi-layer matching (exact, fuzzy, phonetic, token in production; semantic + graph in rollout). Explainable per-hit scoring. Case-management UI for analysts.

**Wedge:** replace World-Check at ~1/10 the cost (see `/vs/world-check`).

---

## 2. Stage & Capital

- **Stage:** pre-seed, bootstrapped.
- **Capital raised:** $0 outside capital to date.
- **Burn:** founder-funded; no full-time employees yet.
- **Runway:** founder-funded indefinitely; raise contingent on design-partner conversion to paid.
- **Currently raising:** opportunistic conversations; not in a formal round.

## 3. Founder & Team

- **Founder & sole engineer:** Shachar Solomon — payments + platform engineering background. Personal site: https://shacharsolomon.dev.
- No co-founders or full-time hires yet. First commercial hire planned post design-partner paid conversion.
- Named publicly at `/about` ("Who Builds AMLIQ") and in `marketing/TestimonialsSection`.

## 4. Traction (honest version)

- **Public site claims:** none of customer-count, ARR, or "40M+ daily screenings" are on the marketing site. (The `40M+` figure that appears in `pages/v2/DashboardV2.tsx` is fixture data inside the demo dashboard, _not_ a marketing claim.)
- **Real traction today:** small set of design-partner fintechs in onboarding. None are publicly named yet — by their request, not because they are fabricated. Earlier prototype testimonials (Sarah Chen / James Richardson / David Okonkwo / Maria Santos) were fabricated and have been removed; see commits `46d2f58` and `bc22960`.
- **Pipeline:** TBD — populated as design-partner conversations advance.

## 5. Product Status — Shipped vs. In-Progress

| Capability | Status |
|---|---|
| `/v1/screen` real-time API | Shipped |
| Multi-layer matching (exact, fuzzy, phonetic, token) | Shipped |
| Semantic (vector) + network (graph) layers | In rollout |
| Case management UI | Shipped |
| Batch + import (CSV) | Shipped |
| Crypto wallet screening (BTC/ETH/TRX/SOL) | Shipped |
| Webhooks + idempotency | Shipped |
| RBAC + MFA + audit log | Shipped |
| SAML SSO | In development |
| SOC 2 Type II | Audit in progress (not certified) |
| Customer-pinned data regions | Roadmap |

Source: `/changelog`, `/security`, `/compliance`.

## 6. Metrics Methodology

Every accuracy / latency / uptime claim on the site should resolve to one of:

- `/benchmarks` — head-to-head precision / recall / F1 / p50 / p99 methodology.
- `/status` — live uptime (claim alignment: site says 99.9% SLA target; do **not** quote 99.99% anywhere).
- `/changelog` — versioned improvements with dates.

Inconsistent legacy numbers (`92% / 90% / 70% / 68% / 15%` FP-reduction figures across components) are tracked for cleanup in `INVESTOR-GAPS-TRIAGE.md` — preferred remediation is to replace specific percentages with "see `/benchmarks` for reproducible numbers" wherever they are not tied to a published methodology.

## 7. Market & Competition

- **Wedge customers:** sub-bank fintechs and PSPs priced out of World-Check / Accuity / LexisNexis / ComplyAdvantage.
- **Tailwinds:** ISO 20022, FedNow / SEPA Instant, post-2022 sanctions escalation, growing PSP scrutiny.
- **Moat path (12–24mo):** developer experience + transparent matching + watchlist freshness + IL-specific coverage (NBCTF, MoF, Knesset, judiciary, mayors) — see `/vs/world-check`.

## 8. Risk & DD-Reasonable Questions — Honest Answers

| Question | Answer |
|---|---|
| Real ARR? | $0 paid revenue at brief date; design-partners are pre-revenue. |
| Named paying customers? | None publicly. Design partners to be named at their option. |
| Is the founder full-time? | Yes. |
| Regulatory authorization? | AMLIQ is an infrastructure vendor, not a regulated entity. Customers remain the regulated party. |
| Where is customer data processed? | Cloudflare edge + primary-region database. EU / US residency on request. Sub-processors at `/dpa`. |
| What is the long-term moat? | Watchlist freshness + case-data network effects + DX. Not the matching algorithm in isolation. |
| Are the "40M+ daily screenings" claims real? | Not on the marketing site. The figure in the demo dashboard is fixture data. See section 4. |

## 9. Public Surface Map (for DD walkthrough)

- `/` — product narrative
- `/product` — feature deep-dive
- `/vs/world-check` — competitive head-to-head
- `/benchmarks` — accuracy methodology
- `/security` — security posture
- `/compliance` — compliance posture
- `/dpa` — data processing addendum + sub-processors + SCCs
- `/changelog` — versioned product progress
- `/status` — live uptime
- `/about` — mission, founder, stage, data residency
- `/docs` — developer docs
- `/careers` — open roles (currently empty by design)

## 10. Contact

- Founder: founders@amliq.finance · https://shacharsolomon.dev
- Security: security@amliq.finance
- Compliance / DPA: compliance@amliq.finance
- Sales / design partners: sales@amliq.finance
