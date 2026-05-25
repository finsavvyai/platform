# AppSource Listing Copy — TenantIQ

Copy-paste sources for the Partner Center → Marketplace → Offer listing form.
Tested for length against Partner Center field limits (last verified 2026-05-08).

## Offer setup

| Field | Value |
|---|---|
| Offer alias (internal) | `tenantiq` |
| Offer ID | `tenantiq` |
| Setup details | Yes — sell through Microsoft (transactable) |
| Test drive | No |

## Properties

| Field | Value |
|---|---|
| Categories (max 3) | Security; IT & management tools; Productivity |
| Industries (max 3) | IT services; Communications & media; Professional services |
| App version | 1.0.0 |
| Standard contract | Yes — use Microsoft's Standard Contract for Microsoft's Commercial Marketplace |

## Offer listing — copy

### Name (50 chars max)
```
TenantIQ — M365 Control Plane for MSPs
```
*38 chars*

### Search results summary (100 chars max)
```
AI-powered M365 management for MSPs. CIS audit + drift detection across all your customer tenants.
```
*99 chars*

### Short description (256 chars max)
```
TenantIQ is the Microsoft 365 control plane built for MSPs managing many customer tenants. Run CIS Benchmark audits across every tenant, detect configuration drift attributed to specific actors, and gate remediation by license tier. AI-narrated.
```
*256 chars*

### Description (3000 chars max — markdown allowed)

```markdown
**TenantIQ is the Microsoft 365 management plane MSPs deserve.**

While horizontal AI assistants (Copilot, Claude in M365) help inside one tenant, MSPs operate across 9–250+ tenants concurrently. TenantIQ is purpose-built for that surface.

### What's inside

- **CIS Benchmark v3.1** — 31+ controls wired to live Microsoft Graph data, scored per tenant, with per-tenant overrides (audit-grade justification trail). L1 + L2 tagged.
- **Drift detection** — Configuration snapshots + drift attribution to the specific user who made each change, sourced from `directoryAudits`.
- **Source-pinned auto-fix** — Remediation recipes that revert specific drifts (legacy auth conditional access policies, MFA method removals). Per-tenant dry-run + 60s anomaly watch + auto-rollback on alert spike.
- **Microsoft 365 Certification preparation** — 33-table account-deletion cascade with contract test (M365 Cert C7 / GDPR Art. 17), audit logger, sub-processor drift detection in CI.
- **Compliance scorecards** — SOC 2, HIPAA, GDPR, ISO 27001:2022 Annex A (25 telemetry-evaluable + 68 organisational), each with AI-generated per-control explainers.
- **Mailbox rule auditor** — 6 BEC indicator types (forwarding to external, hidden delete rules, etc.) across all monitored tenants.
- **Federated identity auditor** — Workload identities with risky permissions, expired SAML certs, AuthnRequest signing gaps.
- **MCP server** — TenantIQ exposes Model Context Protocol so Claude Desktop, Anthropic Cowork, and Claude Managed Agents can read CIS posture and drift events directly. 13 tools (10 read, 3 write).
- **Cross-tenant rollups** — One MSP-wide dashboard for backup health, benchmark scores, alert volumes, and license utilisation.
- **License-tier upsell on remediation block** — When a customer's tier doesn't include a remediation skill, the API returns a 402 with the named cost — no silent failures.

### Why MSPs choose TenantIQ over Optimize365 / CoreView / Syskit Point

- **Per-skill pricing** — pay only for what you use, not per-user
- **AI-native** — Anthropic Claude API with multi-provider smart-router fallback
- **Honest comparison** — public `/compare` page maps 38 features across 9 frames with cited research
- **Self-verifiable** — public changelog driven by `git log`, no marketing hype
- **MSP-first auth** — multi-tenant Entra app, GDAP via Microsoft Partner Center, SCIM 2.0 provisioning

### What's not included

We don't pretend to have features we don't ship. See `app.tenantiq.app/compare/horizontal-ai` for an honest read on where Microsoft's own Copilot beats TenantIQ (productivity inside one tenant) and where TenantIQ wins (managing many).

### Get started

1. Click "Get it now" above
2. Pick a plan (Core / Professional / Enterprise)
3. Land on TenantIQ's activation page
4. Connect your first M365 tenant — 10-minute walkthrough
5. First CIS scan completes in under 2 minutes

Free 14-day trial. Cancel anytime. Microsoft handles billing.

**Try the public scan without signup:** `app.tenantiq.app/scan/<your-domain>`
**Try the MCP server in Claude Desktop:** see setup at `app.tenantiq.app/settings/api-keys` (login required) or use the public demo key `tiq_demo_visitor_2026`.
```

*~2750 chars (under 3000)*

### Search keywords (3 max, 50 chars each)
```
microsoft 365 management
msp m365 security
cis benchmark m365
```

### Privacy policy URL
```
https://app.tenantiq.app/privacy
```

### Terms of use URL (or use Microsoft Standard Contract)
```
Use Microsoft Standard Contract — checked in form.
```

### Support contact info
```
Name:    TenantIQ Support
Email:   support@tenantiq.app
Phone:   +972-XX-XXX-XXXX  (TODO: confirm public number)
URL:     https://app.tenantiq.app/support
```

### Engineering contact
```
Name:    Shahar Solomon
Email:   info@finsavvyai.com
Phone:   (private — set in Partner Center directly)
```

## Plans

For each plan, fill the Plan listing tab.

### Plan 1 — Core
- Plan ID: `tenantiq-core`
- Plan name: `Core`
- Plan description (500 chars):
  ```
  Single-tenant CIS scanning with anomaly detection and email security analysis. For MSPs running TenantIQ on one customer tenant — typically the MSP's own tenant for self-audit. Includes 100+ CIS controls, login + activity anomaly detection, mailbox rule auditor, and AI explainers per control.
  ```
- Pricing: $79 USD per tenant per month, monthly recurring
- Included quota: 1 tenant
- Free trial: 14 days

### Plan 2 — Professional
- Plan ID: `tenantiq-professional`
- Plan name: `Professional`
- Plan description (500 chars):
  ```
  For MSPs managing up to 10 customer tenants. Includes everything in Core plus: AI-powered insights across all tenants, user lifecycle workflows, skill marketplace, MSP cross-tenant rollups, and drift attribution to specific actors. Most popular tier.
  ```
- Pricing: $79 USD per tenant per month, monthly recurring
- Included quota: 10 tenants
- Free trial: 14 days

### Plan 3 — Enterprise
- Plan ID: `tenantiq-enterprise`
- Plan name: `Enterprise`
- Plan description (500 chars):
  ```
  For MSPs at scale — unlimited tenants, SSO/SAML, SCIM 2.0 provisioning, custom compliance frameworks beyond CIS+SOC 2+HIPAA+GDPR+ISO 27001 (out of the box), priority support, dedicated onboarding, custom domains via DNS verification, and audit log export. Microsoft 365 Cert C7 cascade compliant.
  ```
- Pricing: $149 USD per tenant per month, monthly recurring
- Included quota: Unlimited tenants
- Free trial: 14 days

## Technical configuration

| Field | Value |
|---|---|
| Landing page URL | `https://app.tenantiq.app/marketplace/landing` |
| Connection webhook | `https://api.tenantiq.app/api/marketplace/webhook` |
| Microsoft Entra tenant ID | `<set from Azure AD overview>` |
| AAD app ID | `<set from app registration>` |
| Authentication mode | OAuth 2.0 client credentials with Microsoft Marketplace SaaS API |

## Co-sell

| Field | Value |
|---|---|
| Solution overview | docs/sales/HOW_IT_WORKS.md (also at app.tenantiq.app/ciso-demo) |
| Customer 1-pager | docs/sales/CISO_DEMO_SCRIPT.md |
| Pricing sheet | (to write) |
| Customer reference 1 | (to obtain — first 3 pilot MSPs get a permanent /compare row by name) |
| Solution video | (to record — /scan/microsoft.com walkthrough) |

## Marketplace asset checklist

- [ ] **Logo, large**: 216×216 PNG, transparent, on white. Source: `apps/web/static/favicon.svg` rendered at 216px.
- [ ] **Logo, small**: 48×48 PNG. Same source.
- [ ] **Logo, hero (optional)**: 815×290 PNG. Hero banner with TenantIQ wordmark + "M365 Control Plane for MSPs" tagline.
- [ ] **Screenshots, 5 of**: 1280×720 PNG each
  1. CIS Benchmark dashboard (`/security/cis`)
  2. Drift Detection (`/audit/history`)
  3. MSP cross-tenant rollup (`/msp`)
  4. Compliance scorecard (`/security/purview`)
  5. AI explainer modal on a CIS control
- [ ] **Demo video, 3 min**: end-to-end walkthrough of `/scan/microsoft.com`. Upload to YouTube unlisted. Embed URL in listing.
- [ ] **Documentation link**: `https://app.tenantiq.app/changelog` (rotating release notes)
- [ ] **Useful link 1**: `https://app.tenantiq.app/compare` (vs every competitor)
- [ ] **Useful link 2**: `https://app.tenantiq.app/ciso-demo` (15-min talk track)

## Validation links to include

These prove the technical claims for the marketplace certification reviewer.

| URL | Purpose |
|---|---|
| https://app.tenantiq.app/scan/microsoft.com | Public scan, no signup |
| https://app.tenantiq.app/changelog | Verifiable shipping cadence |
| https://app.tenantiq.app/leaderboard | Anonymized aggregate counters |
| https://api.tenantiq.app/api/mcp-public | MCP public namespace (no auth) |
| https://api.tenantiq.app/api/.well-known/jwks.json | JWT verification keys |
| https://api.tenantiq.app/health | API health |
| https://github.com/finsavvyai/tenantiq | Public source (read-only access on request) |
