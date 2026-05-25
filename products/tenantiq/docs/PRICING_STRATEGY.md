# TenantIQ Pricing Strategy

> Last updated: March 2026

---

## Pricing Philosophy

Per-tenant pricing aligns with how MSPs think and bill. MSPs measure margin per tenant, not per user. TenantIQ pricing should mirror that mental model and make ROI obvious at every tier.

---

## Current Pricing

| Plan | Price | Notes |
|---|---|---|
| Starter | $49/tenant/mo | Basic monitoring and alerts |
| Professional | $99/tenant/mo | Security + compliance + AI |
| Enterprise | Custom | Full platform + support |

**Assessment**: Current pricing is too high for entry, too low for enterprise. The gap between Starter and Professional creates friction. No modular upsell path.

---

## Recommended Pricing

### Starter -- $29/tenant/mo

The on-ramp. Low friction, immediate value.

| Included | Details |
|---|---|
| Dashboard | Multi-tenant overview with health scores |
| Monitoring | Real-time alerts for security events |
| Basic reports | Weekly summary emails, CSV export |
| Tenant limit | Up to 3 tenants |
| Users | Unlimited users per tenant |
| Support | Community + email (48h response) |
| Data retention | 30 days |

**Target buyer**: Small MSP evaluating the platform, or internal IT team with a few M365 tenants.

---

### Professional -- $79/tenant/mo (Recommended)

The workhorse. Where most MSPs land and stay.

| Included | Details |
|---|---|
| Everything in Starter | Plus all items below |
| Security intelligence | CIS benchmarks, email threat analysis, sign-in anomaly detection |
| Compliance automation | CIS, NIST, SOC 2 framework scanning with evidence export |
| AI analysis | Claude-powered security and cost recommendations |
| Workflows | Custom automation with scheduling and approval chains |
| License insights | Waste detection and reallocation suggestions |
| Tenant limit | Up to 10 tenants |
| Support | Priority email (24h response) + onboarding call |
| Data retention | 90 days |

**Target buyer**: Growing MSP that needs security and compliance capabilities to win enterprise clients.

---

### Enterprise -- $149-199/tenant/mo

The full platform. For MSPs running serious operations.

| Included | Details |
|---|---|
| Everything in Professional | Plus all items below |
| One-click remediation | With preview, approval workflows, and automatic rollback |
| Backup and recovery | Configuration snapshots, drift detection, restore |
| FinOps engine | AI-powered license optimization with savings tracking |
| AI autopilot | Automated investigation and remediation for low-risk findings |
| Cross-tenant benchmarking | Compare security posture across all managed tenants |
| Executive reporting | Branded PDF reports for client board meetings |
| SSO/SAML | Enterprise identity provider integration |
| Tenant limit | Unlimited |
| Support | Dedicated CSM, 4h response SLA, quarterly business reviews |
| Data retention | 1 year |
| SLA | 99.9% uptime guarantee |

**Target buyer**: Established MSP managing 20+ tenants, or mid-market enterprise with strict compliance requirements.

---

## Add-on Skill Pricing

Skills are modular capabilities that can be added to any plan. This drives ARPU without forcing plan upgrades.

| Skill | Price | Value Proposition |
|---|---|---|
| Cloud Backup | +$20/tenant/mo | Automated M365 configuration backup with point-in-time restore |
| CIS Benchmark Pro | +$15/tenant/mo | Advanced control customization, custom frameworks, audit-ready reports |
| License Optimization | +$10/tenant/mo | AI-powered waste detection with projected savings and auto-reallocation |
| AI Autopilot | +$25/tenant/mo | Automated investigation and remediation for pre-approved action categories |
| Email Security Pro | +$15/tenant/mo | Advanced email threat analysis, DMARC/DKIM/SPF management |
| Compliance Pack | +$20/tenant/mo | HIPAA, PCI-DSS, and ISO 27001 framework mappings |
| Executive Reports | +$10/tenant/mo | Branded PDF reports with custom logos and scheduling |

**Typical Professional + Add-ons bundle**: $79 + $10 (License Opt) + $15 (CIS Pro) = **$104/tenant/mo**

This modular approach lets MSPs start lean and expand as they see value -- no cliff between tiers.

---

## Savings-Based Pricing Model

### Concept

"Take 10-20% of savings generated."

TenantIQ's license optimization engine identifies unused, underutilized, and misassigned licenses. Instead of (or in addition to) flat subscription pricing, capture a percentage of documented savings.

### How It Works

| Step | Detail |
|---|---|
| 1. Baseline | TenantIQ scans current license allocation and identifies waste |
| 2. Recommend | AI generates optimization plan with projected monthly savings |
| 3. Implement | MSP approves changes; TenantIQ executes via Graph API |
| 4. Track | Dashboard shows actual savings vs. baseline, month over month |
| 5. Bill | TenantIQ invoices 10-20% of verified savings |

### Example

| Metric | Value |
|---|---|
| Tenant license spend | $50,000/mo |
| Waste identified | $8,000/mo (16% of spend) |
| Savings after optimization | $6,000/mo realized |
| TenantIQ earnings (15%) | $900/mo |
| MSP keeps | $5,100/mo in recovered margin |

### Positioning

**"Pay for outcomes, not seats."**

- CFO-friendly: cost is directly tied to value delivered
- MSP-friendly: increases their margin, not their costs
- Self-selling: the bigger the savings, the more TenantIQ earns
- Low risk: if TenantIQ finds nothing to optimize, the MSP pays nothing extra

### When to Offer

- Enterprise tier as a hybrid model (base subscription + savings share)
- Large MSPs with 50+ tenants where license waste compounds
- Proof-of-value engagements to convert skeptical prospects

---

## Why This Pricing Wins

### 1. Per-Tenant Aligns with MSP Margin

MSPs bill their clients per tenant or per user. TenantIQ's per-tenant pricing maps directly to their revenue model. No complex user-count calculations. No surprise overages. Predictable cost per managed tenant.

### 2. Modular Skills Increase ARPU Without Friction

Add-on skills let MSPs grow their TenantIQ spend organically. They start with the base plan, see value, and bolt on capabilities one at a time. No forced plan upgrades. No wasted features.

### 3. Savings-Based Pricing is CFO-Friendly

When TenantIQ costs less than it saves, the purchase decision is trivial. Finance teams approve tools that pay for themselves. The savings-based model makes ROI undeniable.

### 4. Low Entry, High Ceiling

$29/mo gets an MSP started. $199/mo + add-ons delivers a full control plane. The pricing scales with the customer's sophistication and tenant count, matching value delivered at every stage.

---

## Competitive Pricing Context

| Competitor | Pricing Model | Typical Cost |
|---|---|---|
| Microsoft Lighthouse | Free (bundled) | $0 -- but limited functionality |
| CIPP | Free (self-hosted) | $0 + Azure hosting ($50-200/mo) + engineer time |
| Augmentt | Per-user | $2-4/user/mo ($200-400/mo for 100-user tenant) |
| Nerdio | Per-user (Azure) | $3-6/user/mo |
| Zylo / Torii | Platform fee + % | $2,000-10,000/mo (enterprise SaaS management) |
| **TenantIQ** | **Per-tenant** | **$29-199/tenant/mo** |

TenantIQ's per-tenant model is more predictable and often cheaper than per-user competitors for MSPs managing tenants with 50+ users.

---

## Revenue Projections

| Milestone | Tenants | Avg Revenue/Tenant | MRR | ARR |
|---|---|---|---|---|
| Launch (Month 3) | 30 | $79 | $2,370 | $28,440 |
| Growth (Month 6) | 100 | $89 | $8,900 | $106,800 |
| Scale (Month 12) | 300 | $99 | $29,700 | $356,400 |
| Mature (Month 18) | 700 | $109 | $76,300 | $915,600 |
| Target (Month 24) | 1,000 | $119 | $119,000 | $1,428,000 |

Average revenue per tenant increases over time as customers adopt add-on skills and upgrade tiers.
