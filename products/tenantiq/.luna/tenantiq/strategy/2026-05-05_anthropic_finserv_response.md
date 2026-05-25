# Response Plan: Anthropic Claude for Financial Services Launch

**Date:** 2026-05-05
**Trigger:** Anthropic announced Claude-as-one-agent-across-M365 (Excel/PowerPoint/Word/Outlook), 8 financial data partners, agent templates deployable via Cowork or Claude Managed Agents. Customer wins: IG Group 70hr/wk, Travelers −30% handle time. Webinar 2026-05-07.

## Risk

The "AI inside M365" framing — central to TenantIQ's CIS explainer, compliance explainer, and AI Agent positioning — is no longer differentiation. A horizontal Claude agent now lives in the same surface. Vertical AI assistants for compliance/security inside M365 will be increasingly common.

## What stays defensible

These are things a horizontal Claude-in-M365 agent **cannot** do for an MSP:

- **Multi-tenant scoping**: querying across N customers' Azure AD/M365 tenants in one view, scoped to the MSP's `org_id`.
- **Per-tenant CIS overrides** with audit-grade justification (ScubaGear-style).
- **Drift attribution** to actor (which admin changed which CA policy at what time).
- **License-tier gating** on remediation actions (402 LICENSE_UPGRADE_REQUIRED).
- **Cross-tenant rollups**: MSP backup health, MSP benchmark, all-tenant alert intelligence.
- **MSP-billing integration**: LemonSqueezy + Microsoft Marketplace co-sell with per-tenant pricing.
- **Account-deletion cascade contract** (33 tables; M365 Cert C7).

## Four-move playbook

### Move 1 — Sharpen the pitch (this week, copy-only)

Update three surfaces to lead with **MSP control-plane** instead of **AI in M365**:

- `apps/web/src/lib/components/landing/Hero.svelte` (or wherever the H1 lives) — add a sub-line: *"For managing other people's tenants — the part Claude in M365 can't do."*
- `apps/web/src/routes/compare/+page.svelte` — add a row group "vs horizontal AI assistants" with explicit checkmarks on multi-tenant scoping, per-tenant overrides, drift attribution.
- `CLAUDE.md` mission line — keep "AI-powered" but qualify with "for MSPs managing OTHER customers' M365 tenants, not your own productivity."

### Move 2 — "TenantIQ MSP stack" press-release moment (this week)

Anthropic's pattern: name the partners, frame as "the stack X work runs on." TenantIQ already has the integrations. Package as a single announcement:

- **PSA**: ConnectWise, Datto, Kaseya
- **Co-sell**: Microsoft Commercial Marketplace, OpenClaw
- **Billing**: LemonSqueezy
- **Security stack**: Microsoft Graph, Defender XDR, Intune, Entra ID PIM, ScubaGear-aligned CIS

Output: `docs/marketing/MSP_STACK_ANNOUNCEMENT.md` + LinkedIn post + landing page badge row.

### Move 3 — Skills marketplace as agent templates (next 2 weeks)

Current skills catalog (~20–30 skills) is a flat list. Re-package as **MSP agent templates** in the Anthropic shape: pre-bundled skills + connectors + guardrails for a recurring workflow.

Initial 4 templates:
1. **New Tenant Onboarding** — admin consent + CIS baseline scan + drift snapshot + welcome report.
2. **Quarterly Compliance Review** — SOC 2 + HIPAA + GDPR + ISO 27001 evaluation + AI explainer per gap + PDF export.
3. **License Optimization Audit** — savings-leaderboard + cost-optimizer + auto-reclamation queue.
4. **Incident Response Kit** — Defender alerts + threat assessment + drift revert + audit log export.

Each template = a single `/api/skills/install` call that activates the bundle. UI: a "Templates" tab in `/skills`.

### Move 4 — Anthropic relationship (this month)

- **Apply for Claude for Startups credits** if not already (you're a Claude-API-first product — the customer-story format Anthropic uses is built for products like TenantIQ).
- **Inquire about MCP server registration** for TenantIQ as a data source: an MCP that exposes tenant security posture / drift events / CIS results to Claude clients (could be a Cowork connector). This puts TenantIQ inside the Claude ecosystem rather than competing with it.
- **Watch the May 7 webinar** — even though it's finserv, the practitioner mechanics (how Cowork wires up agents, how Managed Agents are scoped) inform Move 3.

## What I'd skip

- **Don't pivot toward finserv-specific features.** Anthropic owns that vertical now and TenantIQ's existing ICP (MSPs serving SMB M365 tenants) is more open.
- **Don't try to ship "Claude in Excel" UX.** Anthropic just shipped that. Lean on it from the OUTSIDE — TenantIQ produces the data Claude reasons over, not the chat surface.

## Decision needed

Of the four moves, which to execute first? Move 1 is highest-leverage (copy edits, ship-today), Move 3 is highest-effort (2-week build). Move 2 is press-shaped — depends on whether you have a marketing channel to announce into.
