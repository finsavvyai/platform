---
name: ll-money
displayName: Luna Money
description: Full monetization setup — billing integration, pricing page, subscription management, revenue dashboards, dunning recovery
version: 1.0.0
category: monetization
agent: luna-lemonsqueezy
parameters:
  - name: provider
    type: string
    description: "Provider: lemonsqueezy (default), stripe"
    required: false
    default: lemonsqueezy
  - name: plans
    type: string
    description: "Plan structure: freemium (default), trial, paid-only, usage-based, per-seat"
    required: false
    default: freemium
mcp_servers:
  - fetch
  - playwright
  - sequential-thinking
  - memory
---

# /money — Monetize Your App End-to-End

One command to set up complete billing: payment provider integration, pricing page, checkout flow, subscription management, webhook handlers, revenue analytics, and dunning recovery.

## What Gets Built

```
/money --provider lemonsqueezy --plans freemium
              │
              ▼
┌────────────────────────────────────────┐
│  BACKEND                               │
│  ├── Subscription service              │
│  ├── Webhook handlers (payment events) │
│  ├── Plan enforcement middleware       │
│  ├── Usage metering (if usage-based)   │
│  ├── Dunning recovery (failed payments)│
│  ├── Trial expiry management           │
│  └── Revenue analytics endpoints       │
├────────────────────────────────────────┤
│  FRONTEND                              │
│  ├── Pricing page (responsive, A/B)    │
│  ├── Checkout flow (hosted or embedded)│
│  ├── Billing portal (manage sub)       │
│  ├── Usage dashboard (for user)        │
│  ├── Upgrade/downgrade flows           │
│  └── Invoice history                   │
├────────────────────────────────────────┤
│  OPERATIONS                            │
│  ├── Revenue dashboard (MRR, churn)    │
│  ├── Cohort analysis                   │
│  ├── Trial conversion tracking         │
│  ├── Dunning email templates           │
│  └── Revenue forecasting               │
└────────────────────────────────────────┘
```

## Plan Models

| Model | Description | Best For |
|-------|------------|----------|
| **freemium** | Free tier + paid tiers | SaaS, developer tools |
| **trial** | 14-day free trial → paid | Enterprise, B2B |
| **paid-only** | No free tier, start from $X | Premium products |
| **usage-based** | Pay per API call / compute / storage | APIs, infrastructure |
| **per-seat** | Price × number of users | Team/collaboration tools |

## Usage

```bash
/money                                              # Default: LemonSqueezy freemium
/money --provider stripe --plans usage-based         # Stripe with usage billing
/money --provider lemonsqueezy --plans per-seat      # Team pricing
```

## In Pipes

```bash
/pipe idea "my SaaS" >> api >> money >> go *10 >> test >> launch
/pipe money >> hig >> browser-test >> launch production
/pipe money >> compete "competitor pricing" >> optimize pricing
```
