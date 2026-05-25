# Qestro vs Competitors — Feature Matrix

> **Date**: 2026-04-17. Legend: ✓ = yes / has it, ✗ = no, ~ = partial / add-on / unclear, n/a = not applicable. All pricing in USD.

## Core feature matrix

| Feature | Qestro | Cypress | Playwright | Testim | Autify | QA Wolf | Checkly | Reflect | Mabl | Cepien AI |
|---|---|---|---|---|---|---|---|---|---|---|
| Browser testing (Chrome) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Browser testing (Firefox) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Browser testing (Safari/WebKit) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Mobile testing (iOS) | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ~ (add-on) | ✓ | ✗ |
| Mobile testing (Android) | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ~ (add-on) | ✓ | ✗ |
| API testing (REST) | ✓ | ~ | ~ | ✗ | ✗ | ~ | ✓ | ✓ | ✓ | ✗ |
| API testing (GraphQL) | ✓ | ~ | ~ | ✗ | ✗ | ✗ | ~ | ~ | ~ | ✗ |
| Desktop/Electron testing | ✗ | ~ | ~ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| AI test generation (English → test) | ✓ | ~ | ✗ | ~ | ✓ | ✓ | ~ | ✓ | ✓ | ✗ |
| Self-healing selectors | ✓ | ~ | ✗ | ✓ | ✓ | ✓ | ✗ | ~ | ✓ | ✗ |
| AI failure analysis | ✓ | ✓ | ✗ | ~ | ✓ | ✓ | ✓ (Rocky AI) | ~ | ✓ (Auto TFA) | ✗ |
| Visual regression | ✓ | ~ | ~ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✗ |
| Load testing | ✓ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ |
| Synthetic monitoring (scheduled) | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ~ | ✗ |
| Record-and-replay UI | ~ | ✓ (Studio) | ✓ (codegen) | ✓ | ✓ | ~ | ~ | ✓ | ✓ | ✗ |
| Playwright-native code output | ✓ | ✗ | ✓ | ✗ | ~ (Nexus) | ~ | ✓ | ✗ | ✗ | ✗ |
| CI/CD integration (GitHub Actions) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| CI/CD integration (GitLab CI) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| MCP server integration | ✓ | ✓ (Cloud MCP) | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| SSO / SAML | ✓ | ✓ (Business) | n/a | ✓ (ent) | ✓ (ent) | ✓ (ent) | ✓ (ent) | ~ | ✓ | ✓ (Scale) |
| On-prem / self-host | ~ | ✗ | ✓ | ✓ (ent) | ✓ (ent) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Free tier | ✓ (5 projects, 100 runs/mo) | ✓ (500 results/mo) | ✓ (MIT) | ✗ | ✓ (Aximo Free) | ✗ | ✓ (Hobby) | ~ (14-day trial) | ~ (trial) | ✗ |
| Public pricing | ✓ | ✓ | n/a | ✗ | ✓ | ✗ | ✓ | ✓ (partial) | ✗ | ✓ |
| Cheapest paid tier | $99/mo | $67/mo | $0 | contact | $120/mo | contact | $24/mo | $225/mo | contact | $519/mo |
| Managed service (human QA) | ✗ | ✗ | ✗ | ~ | ~ | ✓ | ✗ | ✗ | ✗ | ✗ |
| SOC 2 | ~ (planned) | ✓ | n/a | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ |

## Pricing spectrum (cheapest paid tier, monthly, USD)

```
$0 (Playwright, Cypress Free, Mabl trial)
$24 Checkly Starter
$67 Cypress Team
$99 Qestro Starter ← sweet spot for SMB self-serve
$120 Autify Aximo Core
$225 Reflect Team
$519 Cepien Starter (annual rate)
$7.5K/mo QA Wolf (estimated median $90K/yr)
contact-sales: Mabl, Testim
```

## Buyer profile matrix

| Competitor | Primary buyer | Buying motion | Approx deal size |
|---|---|---|---|
| Qestro | Eng manager / senior dev | Self-serve PLG | $99-$499/mo SMB, $10K+ for enterprise |
| Cypress | Engineer / team lead | OSS-led PLG | $67-$267/mo mid, $10K+ enterprise |
| Playwright | Engineer | Free, always | $0 |
| Testim | QA Director | Enterprise sales | $20K-$100K+/yr |
| Autify | QA lead / Eng mgr | Mix self-serve + sales | $99-$3.6K/yr + ent |
| QA Wolf | VP Eng / CTO | Enterprise sales | $90K median, $180K-$250K+ ent |
| Checkly | DevOps / SRE | Self-serve PLG | $24-$64/mo + ent |
| Reflect | QA lead | Mix | $225/mo + ent |
| Mabl | QA Director / VP QA | Enterprise sales | est. $40K-$200K+/yr |
| Cepien AI | Product Manager | Self-serve (no free) | $519-$4.3K/mo |

## Category summary

- **Incumbents targeting developers**: Cypress, Playwright — our direct battle for dev mindshare.
- **Incumbents targeting enterprise QA**: Testim, Autify, Mabl — their home turf; we avoid.
- **Managed services**: QA Wolf — different buyer persona, different budget.
- **Adjacent (monitoring)**: Checkly — complement, not competitor.
- **AI-native SaaS peers**: Reflect, Autify Aximo, Mabl Agentic Tester — fighting for the same narrative; our wedge is dev-native + Playwright code output.
- **Not a competitor**: Cepien AI — product analytics, not QA.
