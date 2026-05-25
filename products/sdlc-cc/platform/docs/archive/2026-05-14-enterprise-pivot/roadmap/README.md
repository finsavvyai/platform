# sdlc.cc — Production-Ready Roadmap

Last updated: 2026-04-25

This roadmap takes sdlc.cc from ~32% readiness to GA with full Claude
Enterprise + ChatGPT Business/Enterprise feature parity in **18 weeks (90
working days)**, structured as five phases. Each phase file contains
numbered daily prompts you can paste into Claude Code (or hand to an
engineer) to execute that day's work.

## Why this roadmap exists

Claude Enterprise + ChatGPT Business/Enterprise advertise a feature set
that sdlc.cc *should* deliver as a self-hosted, multi-provider compliance
layer. Mapping every feature to a roadmap day:

### Claude Enterprise parity

| Feature | Day(s) |
| --- | --- |
| Admin spend limits (user + org) | 28-29 |
| Google Docs cataloging | 40 |
| Fine-grained RBAC | 21-22 |
| SCIM provisioning | 23 (extends existing 438 LOC scaffold) |
| Audit logs (write + query + WORM) | 12-13, 67 |
| Compliance API for monitoring | 32 |
| Custom data retention controls | 33 |
| Network-level access control | 27 |
| IP allowlisting | 26 |
| HIPAA-ready offering | Phase 3 (Days 56-75) |

### ChatGPT Business parity (additional)

| Feature | Day(s) |
| --- | --- |
| 60+ connectors (Slack, M365, GitHub, Atlassian, etc.) | 39-48 |
| SAML SSO + MFA | 24 |
| GDPR/CCPA + CSA STAR + SOC2 Type 2 alignment | 32, Phase 4 |
| Encryption at rest + in transit, no training | 36-37 |
| Code/Codex (reasoning + action across docs+codebases) | 51 |
| Shared projects + custom workspace assistants | 53 |
| Record mode | 54 |
| Volume billing + invoicing | 31 |

### ChatGPT Enterprise parity (additional)

| Feature | Day(s) |
| --- | --- |
| Expanded context window | 52 |
| EKM (Enterprise Key Management) | 57-59 |
| User analytics | 30 |
| Domain verification | 25 |
| Custom data retention | 33 |
| Data residency in 10 regions | 64-66 |
| 24/7 priority support + SLAs | 84 |
| Volume discounts + invoicing | 31 |

These are the gold-mine features — most aren't anywhere in the current
codebase yet. This roadmap closes the gap.

## Phase summary

| Phase | Theme | Duration | Days | Outcome |
| --- | --- | --- | --- | --- |
| 0 | Stabilize the baseline | 1 week | 1-5 | All services green in CI, coverage thresholds enforced, observability online |
| 1 | Close release blockers | 3 weeks | 6-20 | RAG E2E tests pass, rate limiter on Redis, audit logs end-to-end, DR playbook drafted |
| 2 | Enterprise + Business parity | 7 weeks | 21-55 | RBAC, SCIM, SAML/OIDC, spend controls, compliance API, 9 connectors, multi-provider routing |
| 3 | HIPAA + EKM + Data residency | 4 weeks | 56-75 | BAA, EKM across 4 KMS backends, 10-region residency, pen test clean |
| 4 | SOC2 + GA launch | 3 weeks | 76-90 | SOC2 Type II observation, load test passed, launch playbook executed |

## How to use a daily prompt

Each day in the phase files is a self-contained block:

- **Goal** — single-line objective.
- **Why** — which release-blocker or feature-parity item it closes.
- **Files** — paths the work touches (so you can pre-load context).
- **Steps** — ordered actions.
- **Tests** — what to add or verify (unit, integration, or E2E).
- **Verify** — exact commands to run.
- **Done when** — explicit success criteria. If any criterion fails, the day
  carries forward into the next morning before starting the next prompt.
- **Prompt** — quote-block ready to paste into a fresh Claude Code session.
  Each prompt is written to be runnable without prior conversation context.

## Cadence and ownership

- **5 working days/week**, no weekends planned.
- Mornings: pick the next prompt, run it, commit. Afternoons: code review,
  CI babysitting, ad-hoc bugs.
- One engineer can run this solo. Two engineers can pair on Phases 2-3 and
  shave ~3 weeks. The plan does not assume parallelism by default.
- Every day ends with a green CI on `main`. If CI is red at end of day, the
  next day's prompt starts with "Fix the CI break before proceeding."

## Definition of "production ready"

Borrowed from `/Users/shaharsolomon/dev/projects/CLAUDE.md`:

- All CI checks green: lint, unit, integration, smoke, security scans.
- ≥90% line coverage / ≥85% branch coverage; 100% on auth, payments,
  permissions, data writes, security controls.
- Zero unresolved Critical or High vulnerabilities.
- Audit logging on all auth events, admin actions, and sensitive-data
  mutations.
- Apple HIG compliance for the admin UI: contrast, focus, labels, motion.
- DR tested: backup, restore, regional failover, secrets rotation.
- Load tested at the documented capacity targets (1M docs, 10K concurrent).
- Documented: runbooks, customer onboarding, API reference, changelog.

When all rows above are green, sdlc.cc is GA.

## Files in this directory

- [phase-0-stabilize.md](phase-0-stabilize.md) — Days 1-5
- [phase-1-release-blockers.md](phase-1-release-blockers.md) — Days 6-20
- [phase-2-enterprise-parity.md](phase-2-enterprise-parity.md) — Days 21-55
- [phase-3-hipaa-ready.md](phase-3-hipaa-ready.md) — Days 56-75
- [phase-4-soc2-launch.md](phase-4-soc2-launch.md) — Days 76-90
