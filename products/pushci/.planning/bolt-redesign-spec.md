# PushCI.dev — Bolt Redesign Spec

Saved: 2026-04-22
Status: approved scope, execution pending

## Source

User-provided Bolt.new prompt for premium AI CI/CD SaaS redesign.
Reference tone: Vercel (DX), Datadog (observability), Linear (clean UX),
Stripe (clarity + trust), GitHub (dev credibility).

Anti-goals: generic DevOps landing, Jenkins-style clutter, AI buzzword soup.

## Positioning

Taglines to rotate:
- "AI-powered CI/CD for fast-moving teams"
- "Deploy faster. Break less. Fix instantly."
- "Predict failures before they hit production"
- "From commit to production — optimized in real time"

Competitors: GitHub Actions, GitLab CI, CircleCI, Jenkins, Harness, Vercel (DX), Render (simplicity).

## Site structure

Core pages (target):
- `/` Homepage
- `/product` Product overview
- `/how-it-works`
- `/developers`
- `/pricing` (exists)
- `/docs` (exists)
- `/security` (exists)
- `/enterprise` (exists)
- `/blog` (new)
- `/contact` or `/demo` (new)

## Homepage section order (mandatory)

1. Hero — DevOps-focused headline, CTAs (Start building / View docs), pipeline graph visual
2. Trust / social proof — logos, deploys/day, pipelines optimized, failures prevented
3. Core value prop — faster builds, safer deploys, smarter pipelines, less downtime
4. Features grid — AI pipeline optimization, caching + acceleration, orchestration, risk detection, failure prediction, auto-rollback, observability, multi-env, preview envs, git integration
5. How it works — 5 steps: connect repo → push → AI analyzes → optimize + execute → deploy with safety
6. Product UI section — pipeline graph, build logs, deployment status, error insights, rollback suggestions
7. Integrations — GitHub, GitLab, Bitbucket, Docker, K8s, AWS/GCP/Azure, Slack, PagerDuty
8. Developer experience — CLI, YAML, API, webhooks
9. Security — RBAC, SSO, secrets, env isolation
10. Pricing — Free / Pro / Enterprise
11. Final CTA — "Deploy your first pipeline in minutes"

## Developers page

Stripe/Vercel-docs feel:
- Quickstart
- Install CLI
- Example pipeline (YAML)
- API reference
- Webhooks
- SDKs

## Design system

- Dark mode first — deep gray/black base
- Accent colors: blue (primary), green (success/deploy), red (failures)
- Typography: Inter / system UI, strong hierarchy
- Mobile-first, responsive grid, pipeline visuals adapt
- Sticky CTA, fast load

## Dashboard (in-app UX)

Real CI/CD dashboard:
- Pipelines list
- Build durations chart
- Success/failure rates
- Logs viewer
- Deployment history
- Environments (dev/staging/prod)
- Alerts

## Conversion

- "Start in 60 seconds"
- GitHub login CTA
- CLI install CTA
- Docs CTA everywhere

## Current state delta (2026-04-22)

Already built in `web/landing/`:
- Hero with "Zero-config AI CI/CD" — keep, sharpen
- CurbTicker, CurbProblem, CurbComparison — brand voice (Curb Your Enthusiasm) per CLAUDE.md. Keep one Curb section, demote others.
- YAMLKiller, Benchmarks, HowItWorks, InstallMethods, Features, Integrations, ReleaseFeature, Pricing, HomeFAQ, FinalCTA — all present
- 7 `/vs/*` competitor pages, EnterprisePage, CompliancePage, SecurityPage, StatusPage, Docs, PricingPage

Gaps vs Bolt spec:
- No `/product` dedicated page
- No `/developers` page (Docs covers some of it)
- No `/blog`
- No `/contact` or `/demo`
- No real pipeline UI screenshot / live product visual on homepage
- Hero headline leans humor ("CI/CD... without the bill stalking you") — Bolt wants sharper DevOps positioning
- No AI prediction / risk / rollback messaging on homepage (features exist but not prominent)
- Trust bar metrics are placeholder-ish

## Phase plan (revised)

- **P1** (done) Save spec
- **P2** Hero + trust bar + value prop sharpen (edit `Hero.tsx`, add metrics to `TrustBar.tsx`)
- **P3** Product UI section — add pipeline visual component
- **P4** New `/product`, `/developers`, `/contact` pages
- **P5** Dashboard polish per Bolt spec (pages list matches real dashboard)
- **P6** Repo split (4 repos: cli / api / landing / dashboard)

## Repo split (Phase 6)

Target layout:
- `finsavvyai/pushci` (private) — Go CLI, release tooling
- `finsavvyai/pushci-api` (private, new) — `api/` Cloudflare Workers
- `finsavvyai/pushci-landing` (private, new) — `web/landing/`
- `finsavvyai/pushci-dashboard` (private, new) — `web/dashboard/`
- `finsavvyai/pushci-cli` (public, existing) — release tarballs

Method: `git subtree split` per dir → preserve history.

Breaks: `deploy-cloudflare.sh`, `wrangler.toml` paths, CI workflows,
`scripts/submit-registries.sh`, goreleaser config, shared types between
api ↔ dashboard (extract to `@pushci/types` npm package).

Cutover: DNS + wrangler routes unchanged.

## Open questions

- Dashboard redesign scope — full Bolt UI rewrite or targeted polish only?
- Blog — CMS (Contentful / Sanity) or markdown in repo?
- Contact page — form (CF Worker) or email link?
- Does the redesign keep Curb Your Enthusiasm brand voice? CLAUDE.md says yes for viral share copy specifically.
