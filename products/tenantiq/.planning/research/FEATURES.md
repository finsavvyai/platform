# Feature Landscape: TenantIQ M365 MSP SaaS

**Domain:** Microsoft 365 governance, security, and compliance SaaS for MSPs
**Researched:** 2026-04-22
**Competitors analyzed:** CoreView, Syskit Point, BetterCloud
**Overall confidence:** MEDIUM-HIGH (competitor sites + G2/Gartner + official docs verified)

---

## Competitor Feature Matrix

What each competitor offers today. Use this as the gap baseline.

| Feature Area | CoreView | Syskit Point | BetterCloud | TenantIQ |
|---|---|---|---|---|
| Multi-tenant MSP view | YES | Partial | YES (60+ SaaS) | YES |
| CIS benchmark / security posture | YES (8000+ settings) | YES (M365 best practices) | Partial | YES (100+ controls) |
| User lifecycle (onboard/offboard) | YES | YES | YES (50+ M365 actions) | YES (10 Graph actions) |
| License optimization + unused detection | YES | YES | YES | Partial |
| Workflow automation (visual builder) | YES | YES (policy automation) | YES (branching logic) | YES (skill marketplace) |
| Reporting (pre-built, bulk export) | YES (hundreds of reports) | YES | YES | Partial |
| SharePoint/Teams/OneDrive governance | Partial | YES (deep) | YES | Partial |
| Oversharing detection | Partial | YES | YES | No |
| Copilot readiness assessment | No | YES (dedicated dashboard) | No | Partial (planned) |
| Configuration snapshot + drift | YES (backup + rollback) | No | No | YES |
| AI-powered analysis / NL interface | YES (Corey agent, GA Mar 2026) | No | No | YES (Claude) |
| Enterprise SSO (SAML/OIDC) | YES | YES | YES | No (planned) |
| SCIM provisioning | YES | Partial | YES | No |
| Delegated admin / tenant segmentation | YES (virtual segments) | No | No | Partial (RBAC) |
| Access reviews (periodic, owner-driven) | YES | YES | No | No |
| Sensitivity label management | Partial | YES | No | No |
| Shadow IT / app discovery | No | No | YES | No |
| Power Platform governance | No | YES (monitoring) | No | No |
| Audit log (platform actions) | YES | YES | YES | YES |
| Anomaly / behavior detection | Partial | No | No | YES |
| Email security analysis | No | No | No | YES |
| Skill marketplace | No | No | No | YES |
| MSP per-skill pricing | No | No | No | YES |
| PDF report export | YES | YES | YES | Partial |
| Storage analytics (OneDrive/SharePoint) | Partial | YES (versioning + quotas) | YES | No (planned) |
| Inactive resource detection | YES | YES | YES | Partial (via anomaly) |
| Entra app governance (secrets, perms) | YES | No | No | No |

---

## Table Stakes

Features an enterprise MSP evaluator will check on day one. Missing any = deal killed before POC.

| Feature | Why Expected | Complexity | TenantIQ Status | Gap Priority |
|---|---|---|---|---|
| Enterprise SSO (SAML + OIDC) | 92% of enterprises use Okta/Entra; 75-80% of enterprise deals blocked without it | High | Missing (planned) | P0 — release blocker |
| Multi-tenant dashboard (all customers in one view) | Core MSP workflow; without it you're a single-tenant tool | Medium | Done | None |
| User lifecycle (onboard / offboard automation) | Every MSP automates this; manual offboarding = security risk | Medium | Done (10 actions) | Expand to full parity |
| License optimization + unused license detection | License waste is #1 cost complaint in M365; every competitor has it | Medium | Partial | P1 |
| Pre-built reports (exportable PDF/CSV) | MSPs need to show customers value monthly; no reports = no retention | Medium | Partial | P1 |
| CIS benchmark / security posture score | Standard compliance requirement; buyers ask "are my tenants CIS-aligned?" | Medium | Done (100+ controls) | None |
| Audit log for platform actions | Compliance and forensics requirement; SOC2 auditors require it | Low | Done | None |
| Role-based access control | MSPs delegate access to engineers/contractors per customer | Medium | Done | None |
| Workflow automation | Core MSP value prop — automate repetitive IT tasks | High | Done (skill marketplace) | Validate coverage vs CoreView |
| Alert notifications (email/Slack/Teams) | On-call engineers need push notifications, not polling | Low | Done | None |

**Verdict on table stakes:** TenantIQ covers 8/10. Enterprise SSO is the single hardest blocker. License optimization depth and PDF reporting are tier-2 gaps.

---

## Differentiators

Features where TenantIQ leads or can lead. These are the reasons a buyer chooses TenantIQ over CoreView.

| Feature | Value Proposition | Complexity | TenantIQ Status | Notes |
|---|---|---|---|---|
| AI-native security analysis (Claude) | Natural language anomaly explanations, not just rule alerts; CoreView's Corey is GA Mar 2026 — window is closing | High | Done | Must market this aggressively before CoreView's Corey gains traction |
| Email security / threat detection | None of the three competitors offer email threat analysis — pure blue ocean | Medium | Done | Unique differentiator; double down |
| Config snapshot + drift detection | CoreView has config backup/rollback but no visual diff; BetterCloud/Syskit have nothing | Medium | Done (backend); UI incomplete | Complete the diff viewer — this is a standout feature |
| MSP per-skill pricing (not per-user) | CoreView/BetterCloud/Syskit all charge per-user or per-tenant flat; per-skill pricing is novel and maps to MSP labor cost model | Low (pricing, not engineering) | Done | Validate with 3 MSP interviews before launch |
| Copilot readiness assessment | Syskit Point has this; CoreView and BetterCloud do not; high demand from MSPs selling Copilot licenses | High | Partial (planned) | Differentiate by tying Copilot readiness to actual security posture score, not just a checklist |
| client_credentials daemon access | No per-customer Global Admin session required; MSPs hate re-authenticating per tenant | Medium (already done) | Done | Market this as "zero-friction tenant onboarding" |
| Behavior / anomaly detection | Syskit and BetterCloud don't have this; CoreView is shallow | High | Done | Lean into this for security-conscious MSP buyers |

---

## Gap Analysis: What Competitors Have That TenantIQ Lacks

Ranked by sales impact.

### P0 — Release Blockers (will kill enterprise deals)

**1. Enterprise SSO (SAML + OIDC)**
- All three competitors support it. 92% of enterprises use Okta/Entra. Without it, enterprise procurement checklist fails.
- Specifically needed: per-org IdP config, JIT provisioning, Okta + Entra tested.
- Confidence: HIGH (verified via SSO market research + competitor sites)

### P1 — Competitive Parity Gaps (will lose comparison evals)

**2. Oversharing detection (SharePoint/OneDrive/Teams)**
- Syskit Point's #1 use case for Copilot readiness. BetterCloud also covers this. With Copilot adoption accelerating, "what can Copilot see?" is now MSPs' top question from customers.
- TenantIQ has Graph access to SharePoint permissions; this is an implementation gap not a technical blocker.

**3. Entra app governance (permission visibility, expired secrets)**
- CoreView covers this as part of its application lifecycle module. MSPs managing M365 tenants increasingly need to audit third-party app permissions post-oversharing incidents.
- Not covered by Syskit or BetterCloud, so this is a partial differentiator if built.

**4. Periodic access reviews (owner-driven)**
- CoreView and Syskit both offer scheduled access reviews where resource owners confirm or revoke permissions. This is a compliance requirement (NIST, NIS2, SOC2).
- TenantIQ has no access review workflow today.

**5. Storage analytics and quota management**
- Syskit Point: SharePoint versioning limits, quota recommendations. BetterCloud: OneDrive/SharePoint file metadata reports, inactive file detection.
- TenantIQ: planned but not built.

**6. PDF report export (customer-facing)**
- MSPs live on monthly reports to customers. All three competitors offer PDF export. TenantIQ has partial export capability.
- Low complexity; high retention impact.

**7. SCIM provisioning (inbound user sync)**
- CoreView and BetterCloud support SCIM for identity lifecycle. Relevant when MSP's customers use HR systems (Workday, BambooHR) to drive M365 provisioning.
- Medium-term gap; not launch-blocking but needed for enterprise tier.

### P2 — Nice-to-Have (post-launch)

**8. Sensitivity label management**
- Syskit Point flags workspaces without sensitivity labels, critical for Copilot readiness (Copilot won't respect labels that don't exist).
- Medium complexity via Graph; relevant post-Copilot-readiness feature.

**9. Power Platform governance**
- Syskit Point offers Power Platform monitoring. Relevant for enterprise customers running Power Automate / Power Apps at scale.
- Low MSP demand currently; post-launch.

**10. Shadow IT / app discovery (non-M365 SaaS)**
- BetterCloud differentiator: discovers unauthorized SaaS apps via usage signals.
- Out of scope for M365-focused TenantIQ v1.

---

## Anti-Features

Deliberately do not build these.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| Native mobile app | Competitors don't have it; MSPs work from desktop; adds 3-month delay | Responsive web; PWA if needed post-launch |
| Google Workspace integration | Dilutes M365 focus; triples support surface; none of the three competitors crossed this boundary in v1 | M365 only for v1; roadmap item for v2 |
| Real-time Teams/Slack bot | Bot platforms require App Store approval, compliance review, separate auth flow | Webhook-triggered notifications suffice; Teams bot post-launch |
| Self-hosted / on-premises deployment | 100% of MSP competitors are cloud-SaaS; adds infrastructure complexity and kills Cloudflare cost advantage | Cloud-only SaaS; data residency via Cloudflare regional hints if needed |
| Per-user licensing model | Undifferentiated; TenantIQ's per-skill model is the only market positioning angle | Keep per-skill pricing; validate before changing |
| Full Purview / DLP policy management | Microsoft owns this; competing with native tooling on Purview is a losing bet | Surface Purview compliance status; link to native Purview admin for actions |

---

## MVP Recommendation for Q2 2026 Launch

Prioritize in this order based on sales impact and build complexity:

1. **Enterprise SSO (SAML + OIDC, Okta + Entra tested)** — blocks every enterprise deal; build first
2. **Copilot Readiness Assessment** — hot market (Copilot Wave 3 announced Mar 2026); Syskit has it, CoreView doesn't; TenantIQ can match Syskit and add AI scoring on top
3. **Config snapshot diff viewer** — backend done; UI completion is low-effort, high-demo value
4. **Storage analytics** — completes the license + cost story alongside existing anomaly detection
5. **PDF report export** — retention driver; MSPs need monthly customer deliverables
6. **Oversharing detection** — ties Copilot readiness to permissions hygiene; Graph data is already available

Defer post-launch:
- Access reviews (correct, but complex approval workflow)
- SCIM provisioning (enterprise-tier only, not needed at launch)
- Entra app governance (useful but not in competitor evaluation checklist)
- Power Platform governance (low MSP demand in 2026)
- Sensitivity label management (Copilot phase 2)

---

## Enterprise Sales Blockers (Summary)

The list of things that will cause an enterprise MSP to reject TenantIQ in procurement:

| Blocker | Severity | Status |
|---|---|---|
| No SAML/OIDC SSO | P0 — hard no from IT procurement | Not built |
| No SCIM provisioning | P1 — required for enterprise IdP integration | Not built |
| No PDF customer reports | P1 — MSPs need deliverables | Partial |
| No oversharing detection | P1 — Copilot readiness is table stakes in 2026 | Not built |
| No access review workflows | P2 — compliance requirement | Not built |
| AI model dependency (Anthropic) | P2 — some enterprises ban third-party AI in security tools | Mitigate with on-prem Claude or opt-out mode |

---

## Feature Dependencies

```
Enterprise SSO
  └── JIT provisioning → RBAC (existing)

Copilot Readiness Assessment
  └── Oversharing detection (SharePoint Graph)
  └── Sensitivity label inventory
  └── Secure Score (existing)

Storage Analytics
  └── Graph SharePoint/OneDrive usage API
  └── License inventory (existing)

PDF Report Export
  └── Existing dashboard data
  └── Report template engine (new)

Config Snapshot Diff Viewer
  └── Drift detection backend (existing — done)
  └── Visual diff UI (new — low effort)
```

---

## Sources

- [CoreView — M365 Governance & Lifecycle Management](https://www.coreview.com/microsoft-365-governance-lifecycle-management) — HIGH confidence
- [CoreView — Corey AI Agent announcement](https://www.coreview.com/news/coreview-corey-ai-agent-for-microsoft-365) — HIGH confidence
- [Syskit Point — Features overview](https://www.syskit.com/features/office-365-governance/) — HIGH confidence
- [Syskit Point — Copilot Readiness](https://www.syskit.com/use-cases/copilot-readiness/) — HIGH confidence
- [BetterCloud — M365 integration](https://www.bettercloud.com/integrations/microsoft365/) — HIGH confidence
- [Expert Insights — Top M365 management tools](https://expertinsights.com/it-management/the-top-microsoft-365-management-tools) — MEDIUM confidence
- [G2 — CoreView vs BetterCloud comparison](https://www.g2.com/compare/bettercloud-vs-coreview) — MEDIUM confidence
- [Security Boulevard — Enterprise SSO must-haves 2026](https://securityboulevard.com/2026/04/10-must-have-features-in-an-enterprise-sso-solution-for-b2b-saas-in-2026/) — MEDIUM confidence
- [Microsoft Copilot readiness report docs](https://learn.microsoft.com/en-us/microsoft-365/admin/activity-reports/microsoft-365-copilot-readiness?view=o365-worldwide) — HIGH confidence
- [Inforcer — How to assess Copilot readiness as an MSP](https://www.inforcer.com/insights/how-to-assess-copilot-readiness) — MEDIUM confidence
- [SSO as enterprise sales blocker research](https://guptadeepak.com/the-enterprise-ready-dilemma-navigating-authentication-challenges-in-b2b-saas/) — MEDIUM confidence
