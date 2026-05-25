<!-- cspell:words tenantiq monkey365 entraid Govcloud -->

# Gap Analysis — Monkey365 vs tenantiq

## What Monkey365 has that tenantiq doesn't

| Monkey365 feature (cited) | tenantiq state | Gap |
|---|---|---|
| 160+ checks (README "Regulatory compliance checks") | tenantiq has `controls-*.ts` files split across 7 categories (apps, audit, cicd, data, device, email, identity) plus `control-definitions.ts`. Total count not enumerated in this scan. | open (need count comparison; if tenantiq has fewer, port the missing ones) |
| CIS M365 Foundations v3.0.0 / v4.0.0 / v5.0.0 simultaneously | tenantiq CIS scanner exists but version coverage not verified in CLAUDE.md or scanner files | open (verify CIS version) |
| **National-cloud awareness** (AzurePublic / AzureChina / AzureUSGovernment) | Not seen in `apps/api/src/lib/graph-client.ts` | **open** (blocker for sovereign-cloud MSPs) |
| Azure subscription review (not just M365) | tenantiq is M365-only per CLAUDE.md mission | open (large; out of charter?) |
| Apache-2.0 license | n/a | green-light |

## What tenantiq has that Monkey365 doesn't

- Web SaaS UX; Monkey365 is PowerShell module.
- Multi-tenant scoping + RBAC (CLAUDE.md "Multi-tenant architecture with RBAC").
- AI-driven recommendations (Claude/DeepSeek).
- Continuous (cron-based) scanning vs Monkey365's on-demand `Invoke-Monkey365`.
- `apps/api/src/lib/cis/federated-identity-auditor.ts` exists — partial overlap with Monkey365's Entra-ID assessments.

## Verdict

Monkey365 is the **breadth of CIS check coverage** reference. The 160+ check count is its differentiator; tenantiq should enumerate its current count, then prioritize porting the gap. National-cloud parameter is a 1-day add for high-value enterprise wins.
