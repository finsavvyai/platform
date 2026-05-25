# Product

## Register

product

## Users

Primary: working developers, SREs, and platform engineers who own CI/CD for a team. Often mid-incident or context-switching between five repos. Frequently on a 27-inch monitor in a dim office, sometimes on a laptop at 2am chasing a flake. They live in the terminal first and reach for the dashboard only when something is on fire or someone needs an audit trail.

Secondary: engineering managers and team leads buying Pro/Team tiers for governance. Skim weekly for run health, cost, and DORA metrics. Need fast answers, not dashboards-as-art.

Tertiary: enterprise security and compliance reviewers (Team/Enterprise). Need SAML, SCIM, audit chain, SIEM, RBAC visibly working. Will reject the product on a single broken access-denied screen.

Job to be done: see what is failing, why, and what to do next — in under three clicks. Approve, retry, or escalate without leaving the surface.

## Product Purpose

PushCI dashboard is the team-coordination surface for a CLI-first CI/CD platform. The CLI is free and runs on user hardware; the dashboard is where teams coordinate, audit, and pay. Success: an SRE glancing at the runs page at 2am can identify the broken job, jump to logs, and retry inside fifteen seconds, with no documentation lookup. A compliance reviewer can answer "who deployed what when" in under a minute.

Compute is never the product. Coordination, governance, and AI-augmented diagnosis are.

## Brand Personality

Expert, technical, no-nonsense. Stripe-restrained confidence: precise language, tight typography, calm color, zero marketing fluff inside the product. The Curb Your Enthusiasm voice lives on landing/marketing surfaces only (ViralShare, CurbShare, landing copy) — never inside the app shell. In-product copy reads like a senior engineer wrote it for another senior engineer: short, specific, no apologies, no exclamation points.

Three words: precise, calm, current.

## Anti-references

- **Jenkins / CircleCI legacy UIs.** Cluttered, dated, info-soup tables, gradient panels, tiny status icons. Reject density without hierarchy.
- **GitHub Actions run view.** Nested tabs, wall-of-log default, ten-level breadcrumbs. Reject log-as-primary-surface and tab nesting beyond one level.
- **GitLab.** Over-featured top nav, secondary menus competing with primary, 15+ nav items. Reject IA that punishes the user for scale.
- **Generic SaaS template.** Purple-gradient hero, identical card grids, gradient text, big-number-small-label hero-metric template. Reject the Linear/Vercel/Supabase clone aesthetic and the "AI made that" reflex palette.

## Design Principles

1. **Status before story.** First pixel a user sees on any page must answer "is it broken?" — color, label, and shape together. Never encode by color alone.
2. **The terminal is the source of truth.** Dashboard mirrors and extends terminal output; never invents a separate mental model. Run IDs, command names, exit codes match the CLI exactly.
3. **Hierarchy carries the weight, not chrome.** Type scale + weight contrast + spacing rhythm do the work cards and borders pretend to do in lesser tools. Cards only when nothing else fits.
4. **No surface lies.** Counts are verified, states are real, errors quote the underlying message. Anti-bluff applies to UI copy the same way it applies to commit messages.
5. **Calm under failure.** When the network drops, the API 500s, or the run pipeline jams, the surface stays legible. Error states are first-class, not afterthoughts.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA** across the dashboard. AAA on critical-path text contrast where it doesn't cost legibility on long pages.

Required accommodations:
- `prefers-reduced-motion` honored everywhere; no animation-as-required-information.
- Status never encoded by color alone — every success/fail/pending pair has a shape or label.
- Full keyboard navigability with visible focus rings; command palette as primary power-user affordance.
- Screen reader support: ARIA labels on icon-only controls, live regions for run-status updates, semantic landmarks.
- High-contrast and forced-colors modes tolerated, not broken.
- Logical CSS properties for forward-compatible RTL.
