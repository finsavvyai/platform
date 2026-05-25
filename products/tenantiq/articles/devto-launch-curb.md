---
title: "Your MSP Is Paying $8/User/Month for a Dashboard That Can't Even Think"
published: false
description: "I built an AI-powered M365 security tool because I got tired of paying enterprise prices for color-coded tables. Here's what happened."
tags: microsoft365, security, ai, saas
cover_image: https://tenantiq.app/og-image.png
canonical_url: https://tenantiq.app/blog/msp-security-pricing
---

So I'm sitting there. Looking at our M365 management bill. And I go — wait.

We're paying... *per user*?

For a *dashboard*?

Let me get this straight. I have 20 tenants. Average 500 users each. That's 10,000 users. At $6 a pop. **$60,000 a year.** For a tool that shows me a table. With colors. Red means bad. Green means good.

*That's it?*

I could've built that in a spreadsheet. My intern could've built that in a spreadsheet. My intern's *dog* could've — okay, the dog couldn't. But you get the point.

## The Part Where I Lose It at Dinner

So I'm at dinner with another MSP guy. He's telling me about his security stack. He's got CoreView for management. He's got some compliance thing. He's got a separate license optimizer. He's got alerts going to three different Slack channels.

I go: "How much?"

He goes: "Don't ask."

I go: "I'm asking."

He goes: "...$140K."

I put down my fork. I look at him. I go:

"A hundred and forty thousand dollars. And when a user's MFA gets disabled at 2am on a Sunday... what happens?"

He goes: "We find out Monday."

**MONDAY.**

Somebody could've exfiltrated your entire SharePoint by Monday. Your CEO's inbox? Gone by Monday. That sensitive client data you promised was locked down? It's on a USB drive in Belarus by Monday.

And you're paying $140K for the privilege of finding out *on Monday*.

## The Thing That Made Me Build TenantIQ

Here's what broke me. I'm doing a CIS benchmark audit for a client. Manually. Because the expensive tool we're paying for doesn't actually *do* CIS benchmarks — it just tells you your Secure Score, which is Microsoft's version of a participation trophy.

So I'm going through 100+ controls. By hand. Checking Conditional Access policies. Checking MFA registration. Checking if someone left legacy authentication enabled (they did, they always do). Checking if there are 47 Global Admins (there were, I wish I was joking).

And I think: why am I doing this? Why is a human being — a carbon-based life form with hopes and dreams — manually checking if DKIM is configured on a subdomain?

A computer should do this. Not just check it. *Understand* it. Tell me what's actually dangerous. Tell me what to fix first. Tell me how much money I'm wasting on licenses nobody uses.

So I built that.

## What TenantIQ Actually Does (The Non-Rant Part)

TenantIQ is what happens when you give Claude AI access to your M365 tenant data and say "what's wrong and how do I fix it?"

**It's not a dashboard. It's a security analyst that never sleeps.**

Here's the difference:

| What You're Used To | What TenantIQ Does |
|---|---|
| Color-coded table: "MFA: 73%" | "14 users have MFA disabled. 3 are Global Admins. Here are their names. Want me to fix it?" |
| "License utilization: see report" | "You're wasting $2,400/month on 120 unused E5 licenses. 47 belong to users who haven't signed in for 90+ days. I can reclaim them now." |
| "Compliance: review recommended" | "You're failing 23 CIS controls. 7 are critical. Here's the exact Graph API call to remediate each one." |
| Alert email at 9am | Real-time anomaly detection: "New Global Admin added at 2:17am from an IP in a country where you have no employees." |

You know that thing where you ask ChatGPT a question and it gives you a weirdly specific, actually useful answer? That's what TenantIQ does for your M365 tenants. Except it has your *actual data*.

Ask it: "How many licenses are we wasting?"

It doesn't say "check your admin portal." It says:

> **License Summary**
> - ENTERPRISEPACK: 340/500 assigned ($36/user/mo) — 160 unused = $5,760/mo waste
> - EMSPREMIUM: 12/50 assigned ($16/user/mo) — 38 unused = $608/mo waste
>
> **Total waste: $6,368/month. Want me to generate a reclamation plan?**

That's not a dashboard. That's a CFO in a box.

## The Pricing Part Where I Get Petty

CoreView: **$2-6 per user per month.** Per *user*. So your 500-user tenant costs $1,000-3,000/month. For 20 tenants? Do the math. Actually don't, you'll cry.

BetterCloud: **$3-8 per user per month.** And they don't even *list* the price — you have to get on a call with a "solutions architect" who's really just a sales rep with a fancier title. Minimum deal: $25K/year. And their M365 coverage? It's one of 70 SaaS apps they "support." One of *seventy*. Your M365 security is sharing a roadmap with their Dropbox integration.

Syskit Point: **EUR 30/user/year** for governance. And — I love this part — **zero AI**. In 2026. Zero. Their automation is "rules-based." You know what else is rules-based? A thermostat. My thermostat doesn't cost EUR 30/user/year.

TenantIQ: **$49/tenant/month** for Starter. **$99/tenant/month** for Professional with AI.

Not per user. Per *tenant*.

Your 500-user tenant costs $99/month. Not $3,000. Ninety-nine dollars.

For 20 tenants: $1,980/month vs. their $60,000/month.

I'll say that again. **$1,980 vs. $60,000.** For a tool that's smarter.

## "But Does It Actually Work?"

100+ CIS controls. Automated. With auto-remediation. Not "here's a PDF that says you should maybe look at this" — actual remediation. Click a button, TenantIQ calls the Graph API, fixes the misconfiguration, and logs an audit trail.

Here's what's running right now:

- **CIS Benchmark Automation** — 100+ controls evaluated against your live tenant. Not a snapshot from last Tuesday. *Right now.*
- **AI Security Scanning** — Claude analyzes your security posture and gives you a risk score with specific, actionable findings
- **License Optimization** — finds every wasted dollar, every unused seat, every E5 that should be an E3
- **Email Security** — DMARC, SPF, DKIM analysis. Not "check recommended" — actual misconfiguration detection
- **Config Drift Detection** — snapshots your M365 config, alerts you when something changes. Someone weakened a Conditional Access policy? You know in minutes, not Monday
- **Anomaly Detection** — behavioral analysis that flags when things look weird. New admin at 2am? Bulk file downloads? Mass forwarding rules? You know *now*
- **Copilot Readiness** — before you spend $30/user/month on Copilot, know if your tenant is actually ready. Sensitivity labels? DLP? Oversharing?

All of this. $99/tenant/month.

## The Architecture Flex (For the Nerds)

Built on Cloudflare Workers. Not Azure. Not AWS. The *edge*.

Your API calls resolve in under 50ms globally. Not "under 500ms from us-east-1." Fifty milliseconds from *everywhere*.

- **Hono** framework (fastest in class, 21K GitHub stars)
- **SvelteKit 5** frontend (because life's too short for React hydration bugs)
- **Cloudflare D1** database (SQLite at the edge, replicated globally)
- **Claude AI** for security analysis (not GPT-3.5 with a system prompt — actual Claude with structured tool use)

The AI doesn't just answer questions. It has tools. It can scan your tenant, check policies, analyze licenses, run compliance checks. It's not a chatbot wearing a security hat. It's a security engine that happens to speak English.

## So What Are We Doing Here?

Look. I get it. You've been paying CoreView or BetterCloud or Syskit for years. It works. It's fine. You've got the PO approved. The CFO signed off. Changing tools is a whole thing.

But here's my question:

When your client asks "are we secure?" — do you *actually know*? Or do you pull up a dashboard, point at some green circles, and go "yeah, looks good"?

Because your client's auditor is going to ask harder questions. Their cyber insurance provider is going to ask harder questions. And when that question comes — "show me your CIS compliance posture across all tenants" — you either have a tool that can answer it, or you're spending the weekend in Excel.

TenantIQ can answer it. In natural language. With actual numbers. Backed by real-time data.

And it costs less than your team's coffee budget.

---

**Try it free:** [tenantiq.app](https://tenantiq.app)

14-day trial. No credit card. Connect your tenant in 2 minutes.

Your M365 tenants deserve an analyst that works weekends. Your wallet deserves a tool that doesn't charge per user.

---

*Built by an MSP engineer who got tired of overpaying for dashboards. Powered by Claude AI. Runs on Cloudflare's edge. Priced for humans.*
