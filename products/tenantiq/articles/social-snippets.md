# Social Snippets — TenantIQ Launch

## Twitter/X (Thread)

**Tweet 1:**
Your MSP is paying $60K/year for M365 security tools that show you colored tables.

I built TenantIQ — an AI security analyst for M365 that costs $99/tenant/month.

Not per user. Per tenant.

Thread on why the M365 management market is broken:

**Tweet 2:**
CoreView: $6/user/month
BetterCloud: $8/user/month
Syskit Point: EUR 30/user/year

For a 500-user tenant, that's $1,000-3,000/month.

TenantIQ: $99/month. Same tenant. AI-powered. 100+ CIS controls automated.

**Tweet 3:**
The wildest part? None of them have real AI.

CoreView bolted on "AI" in 2024. Syskit has zero AI — in 2026.

TenantIQ was built with Claude from day one. Ask it anything about your tenant in plain English. It answers with actual numbers.

**Tweet 4:**
Ask TenantIQ: "how much are we wasting on licenses?"

It doesn't say "check your admin portal."

It says: "You're wasting $6,368/month on 198 unused licenses across 3 SKUs. Want me to generate a reclamation plan?"

**Tweet 5:**
Built on Cloudflare Workers (50ms globally), SvelteKit 5, Claude AI.

100+ CIS controls with auto-remediation.
Real-time anomaly detection.
Config drift alerts.
Copilot readiness assessment.

Free 14-day trial: tenantiq.app

---

## LinkedIn Post

I spent the last year watching MSPs pay $60,000+/year for M365 management tools that are essentially color-coded spreadsheets.

Red = bad. Green = good. That's the whole product.

So I built TenantIQ.

It's an AI-powered M365 security and compliance platform for MSPs. Not a dashboard — a security analyst that never sleeps.

What makes it different:

- 100+ CIS benchmark controls — automated, not manual
- Claude AI analyzes your tenant and gives actionable recommendations with real numbers
- $49-99/tenant/month — not $6-8/user/month
- Real-time anomaly detection — not "we'll check Monday"
- Config drift alerts — know when someone weakens a policy
- License waste detection — find every unused seat, every dollar wasted

The M365 management market charges per user. That punishes MSPs who manage large tenants.

TenantIQ charges per tenant. Because your cost shouldn't scale with your client's headcount.

14-day free trial, no credit card: tenantiq.app

#MSP #Microsoft365 #Cybersecurity #SaaS

---

## Reddit (r/msp)

**Title:** I built an AI-powered M365 security tool because I was tired of paying $6/user for CoreView

**Body:**

I run an MSP and I hit my breaking point last year during a CIS benchmark audit. Going through 100+ controls manually. Checking Conditional Access policies. Counting Global Admins (47, not joking). Verifying DKIM on every domain.

Meanwhile, we're paying $3-6/user/month for a tool that basically shows us what the M365 admin portal already shows, but with nicer charts.

So I built TenantIQ. Here's what it does differently:

- **AI-native**: Ask it anything in plain English. "How many licenses are we wasting?" — it gives you exact SKUs, counts, and dollar amounts
- **100+ CIS controls**: Automated scanning with one-click remediation via Graph API
- **Real-time alerts**: Not "check your email Monday morning." Anomaly detected at 2am? You know at 2am
- **Config drift**: Snapshot your M365 config, get alerted when things change
- **Per-tenant pricing**: $49-99/tenant/month. Not per user. A 500-user tenant costs $99, not $3,000

Currently in beta. Free 14-day trial at tenantiq.app.

Happy to answer questions about the tech stack (Cloudflare Workers, SvelteKit, Claude AI) or the business model.

---

## Hacker News

**Title:** TenantIQ – AI-powered M365 security for MSPs ($99/tenant vs $6/user)

**Body:**

Hi HN, I built TenantIQ because the M365 management tool market charges per-user pricing that punishes MSPs managing large tenants.

Key technical decisions:
- Cloudflare Workers + Hono (edge runtime, sub-50ms globally)
- SvelteKit 5 + Svelte 5 (runes mode)
- Claude AI with structured tool use (not just a chatbot — it calls Graph API)
- D1 (SQLite at the edge) + KV caching + R2 storage
- 100+ CIS benchmark controls as code with auto-remediation

The AI layer uses a multi-pathway router: booster (pattern matching, 0 cost) → semantic cache (fuzzy match) → Claw gateway → direct Anthropic → OpenClaw agents. Self-learning feedback loop improves recommendations over time.

Per-tenant pricing instead of per-user because an MSP's cost to secure a tenant doesn't scale linearly with user count.

Free trial: https://tenantiq.app
