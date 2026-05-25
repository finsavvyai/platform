# Three-product monetization model

How ClawPipe + sdlc.cc + OpenSyber make money together without
cannibalizing each other.

## The shape

**ClawPipe** = top of funnel. Open source MIT. Cheap to free.
**sdlc.cc** = enterprise upsell. BUSL-1.1. Compliance / regulated buyers.
**OpenSyber** = vertical SaaS. Security agent platform with skill marketplace.

```
Free / OSS user (ClawPipe MIT)
     │ 5-10% convert when scale hits
     ▼
ClawPipe Dev / Growth / Scale (SaaS, $79 / $299 / $799)
     │ ~5% convert when compliance/regulated
     ▼                     ┌─────────────────┐
sdlc.cc Startup → Enterprise (compliance)    OpenSyber (vertical:
                                              security agents)
```

Each tier is independent — but **one billing surface, one wallet, one
account** removes friction.

## Pricing matrix (proposed)

| Plan | Price | What | Buyer |
|---|---|---|---|
| **Hobbyist** | Free | ClawPipe SDK + 1K calls/day, 1 project | Devs evaluating |
| **Dev** | $79/mo | ClawPipe Dev 15K/day + analytics | Indie devs / early startups |
| **Growth** | $299/mo | ClawPipe Growth 150K/day + quality scoring + global weight sync | Funded startups, dev teams |
| **Scale** | $799/mo | ClawPipe Scale 1.5M/day + SLA + team management + sdlc.cc Pro + OpenSyber priority + premium AI skill bundle | Mid-market |
| **Enterprise** | $50K-500K/yr | Self-host options, SSO, SLA, dedicated infra, all skills, compliance certs | Regulated industries |

Dev alone (today): $79 × ~500 customers = $40K/mo.
Growth adoption (~50): $299 × 50 = $15K/mo.
Scale (~10): $799 × 10 = $8K/mo.
Enterprise (~3 in year 1): $150K avg = $450K/yr.

**Year-1 ARR target: ~$1M from a few hundred paying accounts.**

## Three monetization mechanics that stack

### 1. Funnel — ClawPipe brings them in
- MIT license + 246 booster rules + 57% benchmark = developer love
- Dev tier converts via dashboard ("you'd save $X with Growth")
- 5-10% of paid accounts hit a compliance question → upsell to sdlc.cc
- Security-focused customers → OpenSyber skill marketplace

### 2. Bundling — each product makes the others stickier
- One signup, three API keys
- Cross-product analytics in shared dashboard
- "Cancelling ClawPipe? Note: also cancels sdlc.cc + OpenSyber Scale."

### 3. Marketplace — recurring transaction revenue
- OpenSyber's skill marketplace becomes the **claw skill marketplace**
- Customers using ClawPipe or sdlc.cc as runtime can install paid skills
- Take 30% of every skill purchase (Apple model)
- Premium AI Security Bundle ($99/mo) is the first; community-submitted
  skills follow

## Open-core line for ClawPipe

ClawPipe stays MIT. Premium add-ons sold as private packages:

| Package | Price | What |
|---|---|---|
| `@clawpipe/enterprise-pack` | $$$ | SSO, audit certifications, dedicated SLA, multi-region |
| `@clawpipe/dlp-plus` | $$ | Extended PII detection (60+ classes vs 12 OSS) |
| `@clawpipe/sessions-do` | $$ | Cloudflare Durable Object session store (high-scale) |
| `@clawpipe/skill-bundles` | $-$$$ | Per-domain skill packs (security, finance, legal, healthcare) |

OSS adoption keeps growing → enterprise add-ons monetize the scale curve.

## Single billing layer

Use OpenSyber's existing `packages/shared-billing/` as the canonical
billing module. ClawPipe + sdlc.cc both consume it. One LemonSqueezy
storefront (Merchant of Record — VAT/GST/sales tax handled in 130+
jurisdictions on our behalf). One invoice.

Customer experience:
- `accounts.openclaw.ai` — one signup
- Provisions API keys for ClawPipe + sdlc.cc + OpenSyber instantly
- Single dashboard shows spend per product + warning when usage suggests
  upgrade

## Affiliate / referral

- 20% revenue share on first 12 months for any product when referred via
  another ("ClawPipe → Cepien → sdlc.cc Enterprise" gets the originator
  paid 20% of all three contracts).
- Each product's docs/landing has affiliate links to the others.

## Brand stack going forward

- **Parent**: OpenClaw (the family) — stays low-key, mostly used in
  footer + accounts portal
- **Public products**: ClawPipe, sdlc.cc, OpenSyber — each with its own
  landing + go-to-market
- **Backend reality**: one repo per product, one shared billing, one
  shared MCP server, one canonical SDK (clawpipe-ai)

## Decision gates

| Quarter | Trigger | Action |
|---|---|---|
| Q2 2026 | ClawPipe Dev hits 100 paying | Launch bundled Growth + Scale upsell push |
| Q2 2026 | sdlc.cc gets first Enterprise | Ship enterprise-pack |
| Q3 2026 | Marketplace has 20+ skills | Launch claw skill marketplace site |
| Q4 2026 | Family ARR > $500K | Hire founding sales |
