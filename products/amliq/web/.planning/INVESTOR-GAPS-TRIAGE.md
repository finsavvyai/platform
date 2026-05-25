# Investor-Diligence Gap Triage

Source: investor desk-audit of amliq.finance · 2026-05-20.

Each row is an issue-grade unit of work. Status: `done` = shipped in this PR · `open` = sprint candidate · `defer` = intentionally not now.

## Closed in this PR (`agent2/sprint-day-3-investor-gaps`)

- **`done` · Founder named on `/about`** — added "Who Builds AMLIQ" section to `src/pages/trust/aboutData.ts`. Names Shachar Solomon, links to personal site, gives investor email.
- **`done` · Stage + capital posture on `/about`** — added "Stage" section. Pre-seed, bootstrapped, design-partner early access. Investors no longer have to guess.
- **`done` · Data residency on `/about`** — added "Where Your Data Lives" section. Cloudflare edge, EU/US residency on request, retention policy, link to `/dpa`.
- **`done` · Investor one-pager** — `INVESTOR-BRIEF.md` in `.planning/`.

## Open (next sprint candidates)

### Highest leverage

- **`open` · Reconcile FP-reduction numbers across marketing components.**
  Currently the site shows `92%` (`CompetitiveEdge.tsx`), `90%` (`MetricsSection.tsx`), `70%` (`FeaturesGrid.tsx`), `68%` (`FeaturesGrid.tsx` code snippet), and `+15%` (`ChangelogPage.tsx`). None of these point to a methodology. Either pin a single number sourced from `/benchmarks`, or replace specific percentages with "see /benchmarks" wherever not backed by published methodology.
  Files: `src/pages/marketing/CompetitiveEdge.tsx:6-10`, `src/pages/marketing/MetricsSection.tsx`, `src/pages/marketing/FeaturesGrid.tsx:15`.

- **`open` · Reconcile uptime numbers across the site.**
  `HeroSection.tsx:158` says `99.97%`. `MetricsSection.tsx:31` says `99.9%`. Investor brief commits to **99.9% SLA target only** — `99.99%` (or higher) must not appear anywhere until proven on `/status`. Audit and pin to one number.

- **`open` · Move the demo dashboard's `40M+ daily screenings` fixture out of any investor-facing surface.**
  Files: `src/pages/v2/DashboardV2.tsx`, `src/pages/v2/sections.tsx`. Either label the dashboard as "demo / fixture data" at the top, or remove the figure. Today the dashboard is at `/dashboard-v2` and `/` (LandingV2), so it is investor-reachable.

### Medium leverage

- **`open` · Make founder bio more substantive than one line.**
  `/about` "Who Builds AMLIQ" currently lists Shachar by name and link. Add a 3–4 sentence bio (prior payments / platform work, why building AMLIQ now). Source content from `https://shacharsolomon.dev`.

- **`open` · Publish first-design-partner case study (as soon as one consents).**
  `CaseStudy.tsx` and `TestimonialsSection.tsx` are currently honest-but-empty placeholders. They are the right shape; just need real consenting customers.

- **`open` · Add an investor / press contact route.**
  Today everything routes to `founders@`/`sales@`/`compliance@`. Investors typically expect a dedicated `/investors` or a clear CTA. Lightweight: add an "Investor inquiries" line to the footer's Company column linking `mailto:founders@amliq.finance`.

- **`open` · Founder LinkedIn link on `/about`.**
  Personal site is good, but LinkedIn is the investor-DD default. Add when Shachar wants it linked.

### Lower leverage / nice-to-have

- **`open` · Add a "Why now" / market-timing paragraph to `/about` or `/product`.**
  ISO 20022, FedNow, SEPA Instant, post-2022 sanctions escalation. One paragraph. Helps the investor narrative.

- **`open` · Make `aboutData.ts` items support inline anchor tags.**
  Today URLs in items render as plain text (see `TrustSection.tsx:18-20`). Refactor to allow `ReactNode` items or a parser. Low priority until investor friction is reported.

## Defer (intentionally not now)

- **`defer` · Customer logo wall.** Currently `LogoMarquee` shows sanctions lists (OFAC, UN, EU, etc.) and `LogoCloud` shows market segments (Banks, Fintechs, etc.). Both are honest. Real customer logos blocked on design-partner consent — do not synthesize.
- **`defer` · Funding / round announcement copy.** Pre-round. Wait until a round actually closes.
- **`defer` · Adding any SOC 2 / ISO 27001 / HIPAA / PCI claim language.** Per `AGENTS.md` — we may only remove these, never add or expand. `securityData.ts` correctly describes SOC 2 as "in progress."

## Out of scope (per `AGENTS.md`)

- `.env` / `.env.example` files (Shachar rotates).
- Production deploys (Shachar ships).
- Adding net-new dependencies without justification.
