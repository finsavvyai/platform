# The TenantIQ MSP Stack

*Press-release / blog draft, ready to publish 2026-05-06.*

---

## TL;DR

TenantIQ is the only Microsoft 365 control plane built for **MSPs managing other people's tenants** — and it ships with the integrations the work actually runs on.

When Anthropic announced Claude-as-one-agent across Excel/PowerPoint/Word/Outlook last week, "AI inside M365" stopped being a feature. **What MSPs need is the layer above** — multi-tenant scoping, per-customer CIS overrides, drift attribution, and license-tier billing logic that horizontal AI fundamentally can't deliver.

Today we're naming the stack TenantIQ runs on, end to end.

---

## The Stack

### PSA — get tenant data into your existing ticket flow

| Partner | What it does in TenantIQ |
|---|---|
| **ConnectWise** | Bi-directional ticket sync; CIS findings + drift events become CW tickets with portal-deep-links and per-tenant ownership. |
| **Datto Autotask** | Same shape as CW; alert→ticket pipeline + runbook attachment. |
| **Kaseya VSA / BMS** | Asset linkage (Intune device → VSA endpoint), ticket creation on remediation block. |

### Co-sell — be where customers buy

| Partner | What it does in TenantIQ |
|---|---|
| **Microsoft Commercial Marketplace** | TenantIQ is co-sell ready; private-offer-capable for enterprise MSP deals. CSP partners can attach via Partner Center. |
| **OpenClaw** | TokenForge integration for Cyber Insurance attestation evidence; TenantIQ posture export feeds carrier underwriting. |

### Billing & ops — per-tenant economics, no surprises

| Partner | What it does in TenantIQ |
|---|---|
| **LemonSqueezy** | Self-serve checkout; 4 plans × 2 cycles; HMAC-verified webhooks; per-tenant volume tiers ($45–$99/mo). |
| **Resend** | Transactional + reporting email (MSP-branded with custom domain DNS verification). |
| **Cloudflare R2** | Customer-isolated object storage for snapshots, evidence bundles, and PDF reports. |

### Security stack — what makes the data trustworthy

| Partner | What it does in TenantIQ |
|---|---|
| **Microsoft Graph API** | Primary data spine — users, groups, licenses, mail, security alerts, Intune devices, PIM assignments, Defender Secure Score. |
| **Microsoft Defender XDR** | Coverage audit via Secure Score control profiles; per-control deep links to the M365 Defender portal. |
| **Microsoft Intune** | Endpoint compliance, device hygiene, App Protection (MAM) policies; 8 finding types across device + policy + MAM. |
| **Microsoft Entra ID PIM** | Standing-privileged role detection, JIT adoption rate, perpetual-assignment audit. |
| **CIS Foundations Benchmark v3.1** | 121 controls across 7 domains; 31+ wired to live Graph; per-tenant overrides with audit-grade justification. |
| **Cloudflare 1.1.1.1 DoH** | SPF / DMARC / DKIM probing for BEC and email-auth findings — no third-party DNS dependency. |
| **Anthropic Claude API** | AI explainer for CIS + compliance gaps; tenant-context-aware, KV-cached 24h. |

### Compliance frameworks — evidence MSPs can hand auditors

- **CIS Microsoft 365 v3.1** (L1 + L2 tagged)
- **ISO 27001:2022 Annex A** (25 telemetry-evaluable + honest disclosure of 68 organisational controls)
- **SOC 2 Type II** (CC6.1 / CC6.2 / CC7.2 / CC8.1)
- **HIPAA Security Rule** (164.312 a–e)
- **GDPR** (Art. 5.1 / 17 / 25 / 32 / 33)
- **M365 Publisher Attestation** (~85% complete; cascade contract test pinned at 33 tables)

---

## What this means

If you run an MSP with 9–250+ Azure tenants, you don't need *another* AI surface. You need a control plane that:

1. **Reads every tenant's posture** — already integrated above.
2. **Writes back through your existing PSA + billing + co-sell pipes** — already integrated above.
3. **Doesn't pretend the work is happening inside one customer's Excel file** — that's the horizontal AI play, and it's not the same product.

We're shipping that. Today.

---

## Try it

- **Free public scan:** drop a domain at [app.tenantiq.app/prospect](https://app.tenantiq.app/prospect) — DNS auth + tenant identity + federation + risk score in 5 seconds. No signup.
- **14-day free trial** with full multi-tenant connect: [app.tenantiq.app](https://app.tenantiq.app)
- **MSP volume pricing** from $45/tenant/month at 50+ tenants: [app.tenantiq.app/pricing](https://app.tenantiq.app/pricing)
- **vs horizontal AI assistants:** [app.tenantiq.app/compare](https://app.tenantiq.app/compare)

---

## Press contacts + redistribution

- LinkedIn long-form: paste body above; first paragraph as preview
- Twitter/X thread: 8 posts, 1 per partner table row
- HN Show post title: *"Show HN: TenantIQ — the M365 control plane Claude-in-Excel can't be"*
- MSP-vertical newsletters (Marius Mihalec / The MSP Brief / Channel E2E): blurb + CTA to /compare

---

*Last updated 2026-05-06. Status: ready to publish pending channel scheduling.*
