---
title: "We're Not Building a Dashboard. We're Building an AI-Native Security Consciousness Layer for the Microsoft 365 Ecosystem."
published: false
description: "Also it checks if your MFA is on. But in an AI way. A disruption story."
tags: microsoft365, security, ai, startup
cover_image: https://tenantiq.app/og-image.png
canonical_url: https://tenantiq.app/blog/security-consciousness-layer
---

## The Pitch

*[Adjusts Patagonia vest]*

So we're sitting in our — well, it's not an office, it's a Cloudflare Worker. We don't believe in offices. Or servers. We believe in *the edge*. Our code runs in 300 cities simultaneously. Our latency is measured in milliseconds. Our burn rate is measured in Cloudflare credits.

And we looked at the Microsoft 365 security market and we said:

"This is a $4.2 billion market. And every single product in it is basically Microsoft Excel with a login page."

CoreView? Excel with a login page. $6/user/month.

BetterCloud? Excel with a login page and 70 tabs. $8/user/month. They raised $187 million to build 70 tabs.

Syskit Point? Excel with a login page but it's hosted in Croatia. Nothing against Croatia. Beautiful country. Great coast. But their product has zero AI. In 2026. *Zero.* That's like launching a car company in 2026 and not having wheels. "We're a rules-based automotive platform."

## The TAM

Our Total Addressable Market is every MSP who has ever:

1. Opened the Microsoft 365 admin portal
2. Looked at a Conditional Access policy
3. Felt their soul leave their body

That's approximately *all of them*. Every single one. We've done the research. Well, we haven't done *formal* research. But I asked three MSP guys at a conference and they all made the same face. You know the face. The "why is legacy authentication still enabled on this tenant" face.

If each of those MSPs manages an average of 15 tenants at $99/month, that's — hold on — *[types furiously on calculator]* — a lot of money. It's a lot.

## What We Built

TenantIQ is an AI-native M365 security consciousness layer that leverages anthropic intelligence models to democratize enterprise-grade compliance automation across the entire managed services provider ecosystem.

Also it checks if your MFA is on.

But here's the thing — it checks if your MFA is on *in an AI way*. It doesn't just go "MFA: 73% ." It goes:

> "14 users have MFA disabled. 3 are Global Admins: j.smith@contoso.com, admin@contoso.com, and — interestingly — an account called 'test-admin' that was created 6 months ago and has never changed its password. This is a critical finding. Would you like me to remediate?"

See the difference? One is a number. The other is *intelligence*.

We're not building a dashboard. We're building a security analyst that works 24/7, doesn't take PTO, and costs less than your Slack subscription.

## The Technical Moat

*[Pulls up architecture diagram that's clearly too complex for the slide]*

Our architecture is — and I don't say this lightly — *beautiful*.

```
User Question
    │
    ▼
Booster Engine (pattern match, 0ms, $0)
    │ miss
    ▼
Semantic Cache (fuzzy NLP match, 2ms, $0)
    │ miss
    ▼
Smart Router (ML pathway selection)
    ├──→ Claw Gateway (shared AI proxy, usage-tracked)
    ├──→ Anthropic Direct (Claude, structured tool use)
    └──→ OpenClaw Agents (28 specialized Luna agents)
    │
    ▼
Self-Learning Feedback Loop
(gets smarter with every interaction)
```

Our booster engine handles 20-30% of queries without even calling an LLM. It just *knows*. "How many licenses do we have?" Boom. Answered from cached Graph data. Zero tokens. Zero cost. Zero latency. Well, 2ms latency. But that's basically zero. That's a rounding error. That's less time than it takes for a photon to — okay, it's not that fast. But it's fast.

The semantic cache uses normalized question fingerprinting with stemming. "How many licenses do we have?" and "license count" and "show me our subscriptions" all hit the same cache entry. We're not just caching. We're *understanding*.

And the self-learning loop? Every time a user says "this recommendation was helpful" or "this was wrong," we store that feedback, aggregate it by tenant size bucket, and inject it into future prompts. The AI literally gets smarter the more you use it.

Erlich would call this "a neural network of market intelligence." We call it "a KV store with some math." Same thing, really.

## The Disruption

Here's where it gets interesting.

The incumbents charge **per user**. CoreView, BetterCloud, Syskit — they all do it. Per user. You know who else charges per user? Oracle. SAP. Companies that were founded when fax machines were cutting-edge technology.

Per-user pricing is the fax machine of SaaS billing.

We charge **per tenant**. $49/month Starter. $99/month Professional.

A 500-user tenant on CoreView: **$3,000/month.**
A 500-user tenant on TenantIQ: **$99/month.**

That's not a 10% improvement. That's not a 2x improvement. That's a **30x cost reduction**. Thirty. X.

You know what VCs call a 30x improvement? They call it "let me clear my afternoon."

*[Sips water from branded Nalgene bottle]*

## The 100+ CIS Controls Thing

So the industry standard for M365 security assessment is the CIS Benchmark. 100+ controls across identity, data protection, email, auditing, device management.

Most tools? They show you the controls. Maybe with a checkbox. Maybe with a link to Microsoft's documentation, which is — and I mean this with all due respect — written by someone who has never used their own product.

TenantIQ evaluates the controls. *Automatically*. Against your live tenant data. In real-time.

And then — this is the part that made our first beta tester actually gasp — you can click "Remediate" and TenantIQ calls the Microsoft Graph API directly and *fixes the misconfiguration*.

Not "here's a PowerShell script you could maybe run." Not "please navigate to portal.azure.com and click Settings > Security > Advanced > Legacy > The Third Tab > Scroll Down > No, More > There." It just *fixes it*.

Auto-remediation with audit trail. That's not a feature. That's a *paradigm shift*.

## The Competitive Landscape (LOL)

| | CoreView | BetterCloud | Syskit | TenantIQ |
|---|---|---|---|---|
| Founded | 2014 | 2011 | 2009 | 2026 |
| Funding | $25M | $187M | $9M | $0 |
| Team | 150+ | 400+ | 85+ | 1 + AI |
| AI | "Added" | Minimal | None | Native |
| Pricing | Per user | Per user | Per user | Per tenant |
| CIS Auto-remediation | No | No | No | Yes |

You see that bottom row? That's the whole pitch. That's the slide. That's the Jian-Yang moment.

"It's like CoreView... but it *actually does something*."

## The Stack

Because I know you're going to ask:

- **Runtime**: Cloudflare Workers (V8 isolates, 300 cities, sub-50ms)
- **Framework**: Hono (21K stars, fastest in class)
- **Frontend**: SvelteKit 5 + Svelte 5 (runes mode, because we're not *animals*)
- **Database**: D1 (SQLite at the edge, globally replicated)
- **AI**: Claude via Claw Gateway (shared infrastructure across 8 projects)
- **Cache**: KV with 4-hour TTL reasoning cache
- **Storage**: R2 for snapshots and exports
- **Auth**: Custom JWT (RS256) + Microsoft OAuth
- **Monitoring**: Sentry + LogTape + W3C Trace Context propagation

No Kubernetes. No Docker in production. No YAML files. *No YAML files.* 

In 2026, running Kubernetes for a SaaS product is like hiring a team of horses to pull your Tesla. "But the horses are very reliable." I don't care. They eat hay.

## The Ask

We're not raising money. We're not looking for a board seat. We're not pivoting to enterprise.

We're looking for MSPs who are tired of overpaying for dashboards that can't think.

14-day free trial. No credit card. Connect your Azure tenant in 2 minutes.

**[tenantiq.app](https://tenantiq.app)**

Your M365 tenants deserve an AI that works weekends.

Your accountant deserves a bill that doesn't scale with headcount.

Your clients deserve actual security, not a green circle that says "probably fine."

---

*TenantIQ. Making the world a better place through AI-native Microsoft 365 security consciousness. One tenant at a time.*

*Also it checks if your MFA is on.*
