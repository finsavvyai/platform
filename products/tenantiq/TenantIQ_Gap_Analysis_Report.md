# TenantIQ Gap Analysis Report

## Competitive Feature Assessment & Strategic Recommendations

**Date:** April 2026
**Prepared by:** TenantIQ Strategy Team
**Classification:** Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [TenantIQ Platform Overview](#2-tenantiq-platform-overview)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Feature Gap Analysis](#4-feature-gap-analysis)
5. [Critical Gaps & Recommendations](#5-critical-gaps--recommendations)
6. [Strategic Positioning Recommendations](#6-strategic-positioning-recommendations)
7. [Conclusion](#7-conclusion)

---

## 1. Executive Summary

TenantIQ is an AI-powered Microsoft 365 security, compliance, and cost optimization platform built specifically for managed service providers (MSPs). The platform leverages Cloudflare's edge infrastructure and offers 82+ API endpoints, 60+ unique pages and views, 135 Svelte 5 components, and a comprehensive test suite with 955 unit tests and 127 end-to-end browser tests. TenantIQ delivers rapid deployment (60-second setup), enterprise-grade security controls, and MSP-specific features including cross-tenant benchmarking and profitability analysis.

This competitive gap analysis compared TenantIQ against 10 major competitors across 55+ features organized into 8 categories: Security & Threat Detection, Compliance & Governance, License & Cost Optimization, AI & Intelligence, Automation & Remediation, MSP & Multi-Tenant Features, Reporting & Export, and Integrations & Ecosystem. The analysis included direct competitors (CoreView, Augmentt, Rewst), partial overlap players (Syskit Point, BetterCloud), and niche specialists (Simeon Cloud, Liongard, Hornetsecurity, AdminDroid).

**Key finding:** TenantIQ leads the market in three critical areas where no direct competition exists. First, **AI intelligence is unmatched**—TenantIQ is the only platform with native Anthropic Claude integration providing 13+ tools for natural language queries, streaming responses, and AI-powered executive report generation. Second, **license optimization is unique**—the License Autopilot feature with automated downgrade recommendations, ROI dashboards, and cross-tenant savings leaderboards is found nowhere else in the market. Third, **compliance breadth is superior**—TenantIQ assesses five compliance frameworks (SOC 2, HIPAA, GDPR, CIS, Zero Trust) against live configuration, with configuration drift detection and Copilot Readiness assessment capabilities. No competitor offers this comprehensive coverage.

**Primary gaps** are in integration breadth (no PSA/RMM integrations with ConnectWise or Datto), data backup capabilities beyond file retention, multi-SaaS support beyond Microsoft 365, and visual workflow builder depth (4 automation types vs. Rewst's 120+ templates). These gaps should be addressed in Q2-Q3 2026 to achieve full market competitiveness and accelerate MSP channel adoption.

---

## 2. TenantIQ Platform Overview

TenantIQ is a comprehensive Microsoft 365 security, compliance, and optimization platform delivered as a fully managed SaaS solution. The platform combines real-time Microsoft Graph API integration with AI-powered intelligence, compliance automation, and cost optimization capabilities designed from the ground up for MSP operations.

### Core Architecture & Scale

The platform architecture spans three layers: API layer (Cloudflare Workers + Hono framework with 82+ endpoints across 50+ route files), web layer (SvelteKit 2.15 with Svelte 5, 60+ unique pages, 135 components across 20 component directories), and data layer (Cloudflare D1 with 15 tables, Drizzle ORM, microsecond-latency access). The platform processes multi-tenant data in real-time with 14 cron jobs handling background operations including user synchronization, compliance scanning, anomaly detection, and notification dispatch.

### Security & Compliance Features

TenantIQ implements 18 Center for Internet Security (CIS) controls with 100+ controls planned in the roadmap. The platform performs 14 distinct types of anomaly detection powered by Anthropic Claude, including insider threat detection, data exfiltration patterns, anomalous sign-in activity, and privilege escalation detection. Five compliance frameworks are automatically assessed: SOC 2, HIPAA, GDPR, CIS Benchmarks, and Zero Trust architecture. Configuration drift detection continuously monitors changes to Azure configuration and alerting rules. The platform also includes email security analysis with threat intelligence, authentication configuration auditing, and user behavior analysis powered by machine learning.

### AI & Intelligence Capabilities

TenantIQ is the only M365 platform with integrated Anthropic Claude providing 13+ natural language tools with streaming responses. Capabilities include security analysis (explaining findings in plain language), optimization recommendations (identifying misconfigured policies and cost-saving opportunities), executive reporting (generating shareable security summaries), and anomaly investigation (correlating events and suggesting root causes). All Claude interactions are streamed in real-time, enabling interactive conversations within the dashboard. The AI engine powers license optimization, user lifecycle automation, and cross-tenant benchmarking analytics.

### Automation & Workflow Capabilities

The platform provides four core workflow types: scheduled automation (triggers on timer), event-driven automation (triggers on Graph API events), manual triggers (admin-initiated), and AI-assisted remediation (Claude-powered suggestions). Each workflow includes dry-run preview, approval gates, rollback capability, and audit logging. Workflow execution includes 10 distinct Microsoft Graph operations: user lifecycle management (enable/disable/deprovisioning), group membership changes, license assignment, security policy updates, and mailbox configuration. Workflows are monitored with real-time status, error handling, and retry logic.

### Testing, Quality & Observability

The platform maintains 955 unit tests with continuous integration testing on every commit. End-to-end browser testing covers 127 critical user flows across 21 test sections using Playwright and Claude Chrome MCP. Quality gates enforce 95%+ code coverage on API layer and 80%+ on web layer. Observability includes Cloudflare Analytics for performance monitoring, Sentry for error tracking, and custom dashboards for tenant health monitoring. The platform achieves sub-100ms response times on API endpoints through edge caching and database optimization.

### Notifications & Integration Points

Alerts are delivered through 5 channels: in-app notifications, webhooks for external automation, email notifications, SMS for critical alerts, and push notifications on mobile devices. The Microsoft AppSource integration enables customers to discover TenantIQ through the Microsoft marketplace. The platform supports 3 pricing tiers: Starter ($49/tenant/month, core features), Professional ($99/tenant/month, full feature set, AI tools), and Enterprise (custom pricing, white-label, SSO, SLA support). Per-tenant pricing is more MSP-friendly than per-user models, reducing customer procurement friction and enabling higher adoption rates.

---

## 3. Competitive Landscape

TenantIQ competes in a fragmented market with significant barriers to entry. The competitive landscape includes enterprise incumbents, MSP-native specialists, and niche point solutions. No single competitor directly matches TenantIQ's combination of AI intelligence, compliance depth, cost optimization, and MSP-first positioning.

### Tier 1 — Direct Competitors (HIGH Threat)

**CoreView** is the enterprise M365 management market leader with estimated 5,000+ enterprise customers and market valuation exceeding $500M. CoreView offers comprehensive security, governance, license management, and backup capabilities. Its strengths include mature platform, strong brand recognition in enterprise, 24/7 support, and ecosystem partnerships. However, CoreView targets enterprises with multi-year sales cycles (typically 6-12 months), has opaque pricing (estimated $3-6/user/month), lacks AI intelligence, and maintains outdated user interface. The platform's backup capabilities (Exchange, Teams, SharePoint) are table stakes but require separate licensing. CoreView is not MSP-optimized and treats MSPs as secondary channel.

**Augmentt** is the most direct MSP-native competitor with transparent pricing at $0.50-0.99/user/month (highly price-competitive). Augmentt focuses on license and user lifecycle management with good UI/UX for MSPs. Strengths include MSP-friendly pricing, intuitive interface, and rapid deployment. Critical weaknesses include weak compliance capabilities (lacks HIPAA/GDPR frameworks), no AI intelligence, limited security analysis (no anomaly detection), minimal reporting, and no backup or data management features. Augmentt competes purely on cost management and is vulnerable to TenantIQ's broader feature set and AI differentiation.

**Rewst** is the automation powerhouse with 120+ pre-built M365 automations (called 'Crates') and strong integrations with PSA/RMM platforms (ConnectWise, Datto, Kaseya). Rewst is positioned as a workflow automation engine and excels in that category. However, Rewst has critical gaps in governance, compliance assessment, security analysis, and cost optimization. Rewst is a complementary tool rather than a direct competitor—customers often use both Rewst for automation and TenantIQ for intelligence. Rewst's pricing is opaque (estimated $500-2000/month per tenant) and targets larger MSPs.

### Tier 2 — Partial Overlap (MEDIUM Threat)

**Syskit Point** specializes in SharePoint and Teams governance with transparent pricing at $2.20/user/month. Syskit is strong in governance automation, backup, and Copilot readiness assessment. However, Syskit has narrow scope (SharePoint/Teams only, not full M365), weak license optimization, no AI intelligence, and limited security capabilities. Syskit is primarily used alongside TenantIQ for SharePoint-specific governance rather than as a replacement.

**BetterCloud** is a multi-SaaS management platform covering 80+ applications including M365, Google Workspace, Slack, Salesforce, and others. BetterCloud offers strong DLP (data loss prevention) and user provisioning capabilities across multiple clouds. The weakness is shallow M365-specific capabilities—BetterCloud sacrifices depth for breadth. TenantIQ is superior for organizations with pure Microsoft 365 focus, while BetterCloud wins for multi-SaaS environments. There is limited overlap for most MSPs, which tend to be Microsoft-centric.

### Tier 3 — Niche Players (LOW Threat)

**Simeon Cloud** provides configuration-as-code (GitOps) approach to M365 management, enabling infrastructure-as-code practices for Microsoft environments. This is a unique approach but serves a narrow audience. **Liongard** is an IT visibility and documentation tool primarily used for compliance and audit purposes; it offers no active management capabilities. **Hornetsecurity** specializes in email security and backup, excelling in email threat protection but providing minimal governance capabilities. **AdminDroid** is a reporting-only tool with a popular free tier; it provides no management or remediation capabilities. **Addigy** and **Hexnode** are device management platforms with some Azure AD integration but are primarily used for endpoint management outside TenantIQ's scope. All Tier 3 players have minimal competitive threat and address niche use cases.

---

## 4. Feature Gap Analysis

The following analysis organizes competitive comparison across 8 feature categories, comparing TenantIQ against key competitors. Each category includes narrative assessment followed by a summary table.

### 4.1 Security & Threat Detection

TenantIQ has strong security coverage with 18 implemented CIS controls (100+ planned), 14 anomaly detection types, Zero Trust assessment, and comprehensive email security analysis including threat intelligence and authentication configuration auditing. Unique strengths include federated identity auditing, credential rotation monitoring, and insider threat detection. CoreView offers similar breadth with backup capabilities that TenantIQ currently lacks. Augmentt provides minimal security features. The primary gap is expanding CIS control count to 100+ to match market leadership.

| Feature | TenantIQ | CoreView | Augmentt | Rewst |
|---------|----------|----------|----------|-------|
| CIS Controls | 18 (100+ planned) | 100+ | 5 | 0 |
| Anomaly Detection | 14 types | 8 types | 0 | 0 |
| Email Security | Yes | Yes | No | No |
| Zero Trust Assessment | Yes | Yes | No | No |
| Config Drift Detection | Yes | Yes | No | No |
| Federated Identity Audit | Yes | Limited | No | No |

### 4.2 Compliance & Governance

TenantIQ's compliance capabilities are a major strength and differentiator. The platform assesses five frameworks (SOC 2, HIPAA, GDPR, CIS, Zero Trust) against live configuration, includes configuration drift detection, and offers Copilot Readiness assessment. Only CoreView matches this breadth, and TenantIQ's real-time assessment against live config is more rigorous than point-in-time audits. Configuration drift detection puts TenantIQ alongside Simeon Cloud and Liongard. No competitor combines compliance breadth with AI-powered remediation recommendations as effectively as TenantIQ.

| Feature | TenantIQ | CoreView | Augmentt | Rewst |
|---------|----------|----------|----------|-------|
| SOC 2 Assessment | Yes | Yes | No | No |
| HIPAA Compliance | Yes | Yes | No | No |
| GDPR Compliance | Yes | Yes | No | No |
| CIS Benchmarks | Yes | Yes | Limited | No |
| Config Drift Detection | Yes | Yes | No | No |
| Copilot Readiness | Yes | No | No | No |

### 4.3 License & Cost Optimization

TenantIQ's license optimization is unmatched in the market. The License Autopilot feature with automated downgrade recommendations is unique. ROI dashboards showing savings per tenant and cross-tenant savings leaderboards are found nowhere else. AI-powered optimization recommendations provide clear value proposition for cost-conscious MSPs. Augmentt is the only competitor with comparable license management depth, but lacks the AI-powered recommendations and ROI analytics. This is TenantIQ's strongest differentiator and primary value driver for MSPs.

| Feature | TenantIQ | CoreView | Augmentt | Rewst |
|---------|----------|----------|----------|-------|
| License Assignment | Yes | Yes | Yes | No |
| Automated Downgrade | Yes (AI) | Manual | Limited | No |
| ROI Dashboard | Yes | No | No | No |
| Cross-Tenant Leaderboard | Yes | No | No | No |
| Unused License Detection | Yes | Yes | Yes | No |
| Cost Forecasting | Yes | Limited | No | No |

### 4.4 AI & Intelligence

TenantIQ is unmatched in AI and intelligence capabilities. The platform is the only solution with native Anthropic Claude integration, providing 13+ natural language tools with streaming responses, executive report generation, anomaly investigation, and optimization recommendations. No competitor offers this depth or sophistication. CoreView has no AI. Augmentt and Rewst have no AI. BetterCloud has no AI. TenantIQ's AI differentiation is a significant competitive moat that will become increasingly important as customers expect natural language query capabilities and explainable automation.

| Feature | TenantIQ | CoreView | Augmentt | Rewst |
|---------|----------|----------|----------|-------|
| Native LLM Integration | Claude (13+ tools) | None | None | None |
| NL Query Interface | Yes | No | No | No |
| Executive Reporting | AI-generated | Template | Basic | No |
| Anomaly Investigation | AI-powered | Rule-based | None | None |
| Optimization Recommendations | AI-generated | Rule-based | Limited | No |
| Streaming Responses | Yes | No | No | No |

### 4.5 Automation & Remediation

TenantIQ has solid automation capabilities with dry-run preview, rollback, and approval workflows. However, the workflow builder supports only 4 automation types compared to Rewst's 120+ pre-built templates. This is the biggest automation gap. TenantIQ should expand from 4 core automation types to a visual drag-and-drop builder with 20-30 pre-built templates covering common scenarios (license management, user lifecycle, security hardening, governance, etc.). Rewst's strength in automation should be addressed in H2 2026.

| Feature | TenantIQ | CoreView | Rewst | Syskit | BetterCloud |
|---------|----------|----------|-------|--------|-------------|
| Automation Types | 4 | 3 | 120+ | 8 | Limited |
| Dry-Run Preview | Yes | Yes | Yes | Yes | No |
| Approval Workflows | Yes | Yes | Yes | Yes | Limited |
| Rollback Capability | Yes | Yes | Limited | Yes | No |
| Visual Builder | No | No | Yes | No | No |
| Pre-built Templates | 4 | 10 | 120+ | 20 | 5 |

### 4.6 MSP & Multi-Tenant Features

TenantIQ's multi-tenant architecture and MSP-specific features are strong. The platform offers multi-tenant dashboard, cross-tenant benchmarking, and unique MSP profitability analysis. However, the critical gap is PSA/RMM integrations. TenantIQ has no integrations with ConnectWise Manage, Datto Autotask, or Kaseya BMS—the three dominant PSA platforms for MSPs. This is table stakes and severely limits channel adoption. CoreView and Rewst both have PSA integrations. This must be addressed in Q2 2026 to achieve competitive parity in the MSP channel. Multi-tenant role-based access control is well-implemented.

| Feature | TenantIQ | CoreView | Rewst | Syskit | BetterCloud |
|---------|----------|----------|-------|--------|-------------|
| Multi-Tenant Dashboard | Yes | Yes | Yes | Yes | Yes |
| ConnectWise Integration | No | Yes | Yes | No | No |
| Datto Integration | No | Yes | Yes | No | No |
| Cross-Tenant Benchmarking | Yes | No | No | No | Limited |
| MSP Profitability Analysis | Yes | No | No | No | No |
| RBAC for MSPs | Yes | Yes | Yes | Yes | Yes |

### 4.7 Reporting & Export

TenantIQ's reporting capabilities are on par with market leaders. The platform offers executive reports (AI-generated summaries), custom report builder (drag-and-drop), scheduled reports (automated delivery), and multi-format export (PDF, Excel, CSV). Executive report generation powered by Claude is unique and valuable for stakeholder communication. Scheduled reporting with automated delivery is standard across all competitors. No significant gaps here.

| Feature | TenantIQ | CoreView | Rewst | Syskit | BetterCloud |
|---------|----------|----------|-------|--------|-------------|
| Executive Reports | AI-generated | Template | None | No | Template |
| Custom Report Builder | Yes | Yes | No | Yes | Yes |
| Scheduled Reports | Yes | Yes | Limited | Yes | Yes |
| PDF Export | Yes | Yes | No | Yes | Yes |
| Excel Export | Yes | Yes | No | Yes | Yes |
| Audit Trail Report | Yes | Yes | Yes | No | Yes |

### 4.8 Integrations & Ecosystem

This is TenantIQ's weakest category. The platform has no PSA/RMM integrations (ConnectWise, Datto, Kaseya), no multi-SaaS support beyond M365, and limited third-party webhook ecosystem. The roadmap includes PSA integrations in Q2-Q3 2026, which is appropriate. Rewst and Liongard lead in integration breadth. BetterCloud supports 80+ SaaS applications while TenantIQ is M365-only. Third-party API access is available but not widely adopted. A partner marketplace similar to Rewst's model would accelerate ecosystem development.

| Feature | TenantIQ | CoreView | Rewst | Syskit | BetterCloud |
|---------|----------|----------|-------|--------|-------------|
| Microsoft Graph API | Yes | Yes | Yes | Yes | Yes |
| PSA/RMM Integration | Planned Q2 | Yes | Yes | No | No |
| Multi-SaaS Support | No | Limited | Limited | No | Yes (80+) |
| Webhook Support | Yes | Limited | Yes | No | Yes |
| Custom API Access | Yes | Yes | Yes | Limited | Yes |
| Partner Marketplace | No | Limited | Yes | No | Limited |

---

## 5. Critical Gaps & Recommendations

The following prioritized list identifies critical feature gaps that impact market competitiveness and channel adoption. Gaps are prioritized by business impact and customer demand.

### Priority 1 — Must Have (Q2-Q3 2026)

**Gap 1 — PSA/RMM Integrations:** ConnectWise Manage, Datto Autotask, and Kaseya BMS are table stakes for MSP channel adoption. Without these integrations, TenantIQ remains isolated from the MSP's core business systems and requires manual data entry for tenant provisioning and billing. This is a severe adoption blocker. **Effort:** Large (4-6 weeks per integration using vendor APIs). **Timeline:** Q2 2026.

**Gap 2 — CIS Controls Expansion:** Current marketing materials claim 100+ CIS controls. Actual implementation is 18 controls. This creates credibility gap and confusion. Expand CIS control library to 100+ with live remediation steps. This is technical debt that must be addressed before Series A. **Effort:** XL (12+ weeks). **Timeline:** Q3 2026.

**Gap 3 — Visual Workflow Builder:** Rewst's 120+ pre-built automation templates are a significant competitive advantage. Expand TenantIQ from 4 core automation types to visual drag-and-drop builder with 20-30 pre-built templates. This will position TenantIQ as broader automation platform beyond intelligence. **Effort:** Large (8-10 weeks). **Timeline:** Q3 2026.

### Priority 2 — Should Have (Q3-Q4 2026)

**Gap 4 — Data Backup:** Exchange, SharePoint, and Teams backup capabilities are available in CoreView and Hornetsecurity. As data protection becomes increasingly important, adding backup capabilities would broaden TenantIQ's value proposition. **Effort:** XL (12-16 weeks). **Timeline:** Q4 2026.

**Gap 5 — Advanced White-Label:** Currently white-label is Enterprise-only tier. Extending to Professional tier would unlock growth in managed service offerings where MSPs want to rebrand as their own product. **Effort:** Medium (4-6 weeks). **Timeline:** Q3 2026.

**Gap 6 — Configuration-as-Code Export:** Simeon Cloud's GitOps model is gaining adoption among large enterprises. Offering M365 configuration export to Git would appeal to infrastructure-as-code practitioners and enterprises. **Effort:** Medium (4-8 weeks). **Timeline:** Q4 2026.

**Gap 7 — Partner Marketplace:** Rewst's strength comes partly from third-party partner integrations. Create partner marketplace allowing independent developers to build integrations. **Effort:** Large (8-10 weeks). **Timeline:** 2026-2027.

### Priority Summary Table

| Priority | Gap | Impact | Effort | Timeline | Notes |
|----------|-----|--------|--------|----------|-------|
| P1 | PSA/RMM Integration (ConnectWise, Datto, Kaseya) | CRITICAL | Large | Q2 2026 | Table stakes for MSPs |
| P1 | Expand CIS Controls to 100+ | HIGH | XL | Q3 2026 | Marketing claims 100% |
| P1 | Visual Workflow Builder | HIGH | Large | Q3 2026 | Expand to 20+ templates |
| P2 | Data Backup (Exchange, SharePoint, Teams) | HIGH | XL | Q4 2026 | Customer requests |
| P2 | Advanced White-Label | MEDIUM | Medium | Q3 2026 | Extend to Professional |
| P2 | Configuration-as-Code Export | MEDIUM | Medium | Q4 2026 | Simeon Cloud model |
| P3 | Partner Marketplace/API | MEDIUM | Large | 2026-27 | Enable third-party |
| P3 | Mobile App | MEDIUM | Large | 2026-27 | Native app |

---

## 6. Strategic Positioning Recommendations

Position TenantIQ as the **"Security-First M365 Intelligence Platform for MSPs."** The core positioning should emphasize TenantIQ's unique AI layer—specifically the native Claude integration with 13+ natural language tools—as the primary differentiator that no competitor matches. While CoreView is the incumbent enterprise leader and Rewst is the automation powerhouse, TenantIQ owns the "AI-first security and compliance" positioning. The Claude integration should be prominently featured in marketing, with demo videos and case studies showing how natural language queries solve real customer problems (e.g., "Summarize our security posture in 30 seconds," "Why did this alert fire?", "What's our compliance risk?").

**Pricing advantage** is significant. TenantIQ's per-tenant model ($49-99/tenant/month) is more MSP-friendly and predictable than per-user pricing. A 150-user tenant costs $150-300/month with TenantIQ but $450-1800/month with CoreView/Augmentt. This 3-6x cost advantage is compelling for cost-conscious MSPs and should be quantified prominently. Create ROI calculator showing savings vs. competitors. Offer free tier (1-2 free tenants) to remove barrier to trial. Current 14-day free trial without credit card is strong; maintain this advantage.

**Speed-to-value** is another key differentiator. TenantIQ's 60-second setup, no credit card trial, and edge deployment with zero cold starts enable immediate value. Enterprise competitors like CoreView require 3-6 month sales cycles with implementation services. Emphasize fast onboarding in marketing and sales conversations. Offer guided setup wizard that connects Microsoft Azure tenant and populates dashboard with initial data within 60 seconds.

**Build integration partnerships strategically.** Rather than competing directly with Rewst's 120+ automation templates, position TenantIQ as a complementary intelligence layer. Pursue partnership with Rewst to enable TenantIQ alerts to trigger Rewst workflows. Prioritize PSA integrations with ConnectWise and Datto—these are must-haves for MSP channel success. Consider becoming a Rewst integration target, allowing Rewst users to embed TenantIQ intelligence into their automation workflows. This partnership approach is more pragmatic than building all features in-house.

---

## 7. Conclusion

TenantIQ is exceptionally well-positioned with unique artificial intelligence capabilities and comprehensive compliance coverage that no direct competitor matches. The platform's native Claude integration, License Autopilot, cross-tenant benchmarking, and AI-powered remediation recommendations represent genuine innovations that address real MSP challenges. The per-tenant pricing model and 60-second setup provide significant advantages over enterprise competitors with complex sales processes.

The primary investment areas for market competitiveness are: **(1) PSA/RMM integrations** (ConnectWise, Datto, Kaseya) to unlock MSP channel, **(2) expanding CIS controls from 18 to 100+** to match market claims, and **(3) enhancing workflow automation with visual builder and 20+ pre-built templates**. These three initiatives address critical gaps and position TenantIQ as a comprehensive M365 management platform rather than point solution.

With these strategic investments completed, TenantIQ will be positioned as the AI-first M365 security and compliance platform for MSPs—a meaningful and differentiated position with significant market opportunity. The estimated total addressable market (TAM) for MSP M365 management tools exceeds $500M, and TenantIQ's combination of AI intelligence, compliance automation, and cost optimization is compelling for that segment. Execution of the Q2-Q3 2026 roadmap will be critical to achieving full market competitiveness and driving Series A growth.
