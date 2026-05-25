# OpenSyber + TokenForge — Full Product Roadmap

## Executive Summary

**10 sprints. 20 weeks. Two products.**

Transform OpenSyber from a beautiful frontend into a real enterprise-grade
AI agent hosting platform, AND launch TokenForge as a standalone session
security product with its own landing page, dashboard, and SaaS billing.

## Two Products, One Monorepo

| Product | What It Does | Target | Revenue |
|---|---|---|---|
| **OpenSyber** | Secure AI agent hosting + monitoring | Dev teams & CISOs | $149-399/mo |
| **TokenForge** | Post-auth session security SDK | SaaS engineers | $49-199/mo |

TokenForge is both a core feature OF OpenSyber AND a standalone product
sold separately. TokenForge leads generate OpenSyber customers and vice versa.

## Current State (What Exists)

| Layer | Status | Details |
|---|---|---|
| Landing page | Done | Marketing copy, Framer Motion animations |
| Authentication | Done | Clerk sign-up/sign-in |
| Dashboard shell | Done | 15+ pages, most now have CRUD |
| Marketplace | Done | 12 seeded skills (display only) |
| Pricing | Done | LemonSqueezy checkout links |
| API endpoints | Done | 36+ routes, all working |
| Database schema | Done | 18+ tables via Drizzle/D1 |
| TokenForge SDK | Done | Client + server + React provider |
| Credential vault | Done | AES-GCM encrypted secrets |
| Rate limiting | Done | KV sliding window on all routes |
| Security score | Done | 7-category real calculation |
| Dashboard CRUD | Mostly done | Modals, actions, notifications |
| Agent compute | Partial | Hetzner provisioning (no Docker yet) |
| **Skill execution** | **Missing** | No install, no sandbox, no runner |
| **Real monitoring** | **Missing** | Agent monitors exist, no real data |
| **TokenForge integration** | **Missing** | Not wired into OpenSyber yet |
| **Teams / RBAC** | **Missing** | No multi-user, no roles |
| **SSO / SAML** | **Missing** | No enterprise identity |
| **Admin panel** | **Missing** | No platform management |

## Sprint Overview

### Phase 1 — Working MVP (Sprints 1-5)

| Sprint | Duration | Goal | Status |
|---|---|---|---|
| 1 | 2 weeks | Agent Runtime (Hetzner containers) | In Progress |
| 2 | 2 weeks | Skill Installation & Real Monitoring | Pending |
| 3 | 2 weeks | Dashboard CRUD & UI Completion | In Progress |
| 4 | 2 weeks | Security Hardening & Credential Vault | In Progress |
| 5 | 2 weeks | Production Launch & E2E Testing | Pending |

### Phase 2 — TokenForge Product (Sprints 6-7)

| Sprint | Duration | Goal | Status |
|---|---|---|---|
| 6 | 2 weeks | TokenForge Standalone (adapters, storage, tests) | Pending |
| 7 | 2 weeks | TokenForge Product (landing, dashboard, billing) | Pending |

### Phase 3 — Enterprise Grade (Sprints 8-10)

| Sprint | Duration | Goal | Status |
|---|---|---|---|
| 8 | 2 weeks | RBAC, Teams & Organizations | Pending |
| 9 | 2 weeks | SSO, Admin Panel & Compliance Export | Pending |
| 10 | 2 weeks | Enterprise Hardening & Scale | Pending |

## Sprint Dependencies

```
Phase 1 — MVP
  Sprint 1 (Runtime) ──────┐
  Sprint 3 (CRUD) ─────────┤ can run in parallel
  Sprint 4 (Vault) ────────┘
       │
  Sprint 2 (Skills + Monitoring) ← needs running containers
       │
  Sprint 5 (Launch) ← needs everything above

Phase 2 — TokenForge
  Sprint 6 (Standalone SDK) ← independent, can start anytime
       │
  Sprint 7 (Product) ← needs Sprint 6 + Sprint 5 (for OpenSyber integration)

Phase 3 — Enterprise
  Sprint 8 (RBAC + Teams) ← needs Sprint 5
       │
  Sprint 9 (SSO + Admin) ← needs Sprint 8
       │
  Sprint 10 (Scale) ← needs Sprint 9
```

## Total Code Estimate (All 10 Sprints)

| Category | New Files | Modified Files |
|---|---|---|
| API services | 20 | 12 |
| API routes | 12 | 15 |
| API middleware | 6 | 4 |
| Agent modules | 10 | 4 |
| Web components | 60+ | 25+ |
| Web pages | 20+ | 15+ |
| TokenForge adapters | 6 | 4 |
| TokenForge storage | 5 | 2 |
| Tests | 100+ | — |
| Database migrations | 10 | — |
| Docker/infra | 3 | — |
| Documentation | 15+ | 8+ |
| TokenForge web app | 20+ | — |
| TokenForge API | 10+ | — |
| **Total** | **300+** | **89+** |

## Cost Model

### OpenSyber (Per User)
| Resource | Monthly Cost |
|---|---|
| Hetzner CX22 (2 vCPU, 4GB) | ~$5.00 |
| Cloudflare D1 reads | ~$0.01 |
| Cloudflare KV reads | ~$0.01 |
| Cloudflare R2 storage | ~$0.02 |
| Resend emails | ~$0.01 |
| **Total per user** | **~$5.05/mo** |

At $149/mo (Pro plan): **96.6% gross margin**.

### TokenForge (Per Tenant)
| Resource | Monthly Cost |
|---|---|
| Cloudflare D1 (sessions + events) | ~$0.05 |
| Cloudflare KV (nonces) | ~$0.02 |
| **Total per tenant** | **~$0.07/mo** |

At $49/mo (Pro plan): **99.9% gross margin**. Pure software.

## Success Criteria

### After Phase 1 (Sprint 5)
1. Shahar can deploy an agent by clicking one button
2. Agent runs on Hetzner with Docker + security tools
3. Skills install and execute in sandboxed workers
4. Security events are real — not mock data
5. New user completes full journey in under 5 minutes
6. Tests pass with >80% coverage
7. No fake stats on landing page

### After Phase 2 (Sprint 7)
8. TokenForge has its own landing page and dashboard
9. Developers can sign up, get API key, integrate in 10 min
10. Works with Hono, Express, Next.js, Fastify
11. npm packages published and installable
12. TokenForge wired into OpenSyber itself

### After Phase 3 (Sprint 10)
13. Organizations with 5 roles and granular RBAC
14. SAML and OIDC SSO working
15. Admin panel for platform management
16. Compliance reports exportable as PDF/CSV
17. SLA monitoring with uptime tracking
18. 7 notification channels (email, Slack, PagerDuty, etc.)
19. API versioned at `/api/v1/`
20. Full security audit complete

## Sprint Files

### Phase 1 — MVP
- [Sprint 1: Agent Runtime](./sprint-1-agent-runtime.md)
- [Sprint 2: Skills & Monitoring](./sprint-2-skills-monitoring.md)
- [Sprint 3: Dashboard CRUD](./sprint-3-dashboard-crud.md)
- [Sprint 4: Security Hardening](./sprint-4-security-hardening.md)
- [Sprint 5: Production Launch](./sprint-5-production-launch.md)

### Phase 2 — TokenForge
- [Sprint 6: TokenForge Standalone](./sprint-6-tokenforge-standalone.md)
- [Sprint 7: TokenForge Product](./sprint-7-tokenforge-product.md)

### Phase 3 — Enterprise
- [Sprint 8: RBAC & Teams](./sprint-8-enterprise-rbac-teams.md)
- [Sprint 9: SSO, Admin & Compliance](./sprint-9-enterprise-sso-admin.md)
- [Sprint 10: Enterprise Scale](./sprint-10-enterprise-scale.md)

### Reference
- [Claude Skills Guide](./claude-skills.md)

## How to Use These Plans

Each sprint document contains:
- **Goal**: One-sentence summary of the sprint's purpose
- **Tasks**: Checked off as completed (`- [x]`)
- **Definition of Done**: Acceptance criteria
- **Estimated Effort**: Day-by-day breakdown

Work through sprints sequentially within each phase.
Mark tasks with `[x]` when done.
Run `pnpm typecheck && pnpm test && pnpm build` after each task group.
