# LemonSqueezy Product Spec — sdlc-platform

> **Status:** Draft for human approval. **Do not push to LemonSqueezy
> yet.** A future agent (`luna-agents:ll-ls-products`) will turn this
> into real products via the LS API only after the human signs off.
>
> **Last updated:** 2026-05-16
> **Linked terms:** [`COMMERCIAL.md`](../../COMMERCIAL.md) ·
> [`docs/brand/2026-05-16-brand-kit.md`](../brand/2026-05-16-brand-kit.md)
> **Store:** `finsavvy.lemonsqueezy.com` (existing, reused).

## Conventions

- **Currency:** USD.
- **Tax:** LemonSqueezy is the Merchant of Record; VAT/sales tax is
  handled by them. We do not collect tax ourselves.
- **Fees:** **5% + $0.50 per transaction** (LS standard rate).
- **After-purchase redirects** route to a page under
  `sdlc.cc/welcome/*` so the buyer lands on activation instructions
  instead of a generic thank-you.
- **Custom fields** marked *required* are enforced at checkout.
- **Image prompts** are placeholders — the brand visual style is
  defined in [`2026-05-16-brand-kit.md`](../brand/2026-05-16-brand-kit.md):
  *ink-on-paper, off-white legal-pad background `#F7F5EF`, oxblood
  accent `#7A1F2B`, Source Serif 4 headlines. Aesthetic: bound brief
  cover, Penguin Classics spine. No gradients, no 3D, no stock
  photography of suits.*

---

## Cost-of-payment math

LemonSqueezy fee model: **5% + $0.50 per transaction.** The fee is
charged once per checkout, not per seat or per renewal cycle.
Subscriptions incur the fee on every renewal.

| SKU | Gross | LS fee | Net | Margin |
|---|---|---|---|---|
| Commercial — 1 seat | $4,000.00 | $200.50 | **$3,799.50** | 95.0% |
| Commercial — 5 seats | $19,000.00 | $950.50 | **$18,049.50** | 95.0% |
| Commercial — 10 seats | $36,000.00 | $1,800.50 | **$34,199.50** | 95.0% |
| Commercial — 50 seats | $160,000.00 | $8,000.50 | **$151,999.50** | 95.0% |
| Setup engagement | $5,000.00 | $250.50 | **$4,749.50** | 95.0% |
| Support — Basic | $500.00 / mo | $25.50 | **$474.50** / mo | 94.9% |
| Support — Pro | $1,000.00 / mo | $50.50 | **$949.50** / mo | 94.9% |
| Support — Priority | $2,000.00 / mo | $100.50 | **$1,899.50** / mo | 95.0% |
| Sponsor (min) | $5.00 | $0.75 | **$4.25** | 85.0% |

**Notes**

- Annual subscriptions cost one fee per year; monthly subscriptions
  cost one fee per month. A $500/mo Basic support contract over 12
  months yields $5,694 net vs. $5,940 if billed annually — keep
  Basic monthly because the buyer's purchase reflex is monthly.
- Stripe-direct would be ~2.9% + $0.30 (cheaper at high volume) but
  we lose the Merchant-of-Record VAT handling. The 2.1% delta is
  worth it for solo-maintainer compliance simplicity.
- Wire transfer remains the cheapest option for 50-seat orders;
  route those via `commercial@sdlc.cc` instead of LS.

---

## Product 1 — Commercial License (Annual)

- **Name:** `sdlc-platform Commercial License — Annual`
- **Slug:** `sdlc-commercial-annual`
- **Type:** Subscription, **annual** billing.
- **Status:** Draft. Do not publish until human approval.
- **Description (~100 words):**
  > sdlc.cc is AGPL-3.0 open source. The commercial license lifts
  > the AGPL source-disclosure obligation for organisations that
  > embed the gateway inside a closed-source product, SaaS, or
  > internal proprietary system. Pricing is **per seat per year**,
  > where a seat is one end-user identity authorised to interact
  > with the gateway. Includes a signed PDF license agreement
  > within 24 hours of checkout, access to the private support
  > channel (5 business day response), and a renewal price locked
  > for two cycles. Full terms in COMMERCIAL.md. AGPL-3.0 remains
  > available at no cost for users who comply with copyleft.

### Variants (one per seat tier)

| Variant slug | Label | Price | Notes |
|---|---|---|---|
| `1-seat` | 1 seat | $4,000 / yr | Baseline; solo developer or partner. |
| `5-seat` | 5 seats | $19,000 / yr | 5% discount on the 5th seat ($20,000 list → $19,000). |
| `10-seat` | 10 seats | $36,000 / yr | 10% volume discount ($40,000 list → $36,000). |
| `50-seat` | 50 seats | $160,000 / yr | 20% volume discount ($200,000 list → $160,000). |

### Custom fields (checkout)

| Field | Type | Required | Notes |
|---|---|---|---|
| Organisation legal name | text | **yes** | Inserted verbatim into the signed PDF. |
| Jurisdiction | text | **yes** | e.g. "Delaware, US" or "England & Wales". Used in the governing-law clause. |
| Billing contact email | email | no | If different from the LS account email. |

### Redirect after purchase

`https://sdlc.cc/welcome/commercial?key={license_key}`

### Image prompts

1. **Hero (1600x800).** Off-white legal-pad background `#F7F5EF`,
   a single bound legal brief lying flat, oxblood `#7A1F2B` ribbon
   bookmark, the wordmark `sdlc.cc` debossed in Source Serif 4
   along the spine, no people, no devices, no gradients, soft
   natural light from upper-left. Mood: notarial seal, not SaaS
   marketing.
2. **Icon (512x512).** Monogram of `s` and `c` interlocked in a
   thin-stroke serif, enclosed in a single hairline circle.
   Oxblood mark on `#F7F5EF` field. Reads as an embossed seal.
3. **Social card (1200x630).** Oxblood title bar reading
   *Commercial License — $4,000 / seat / year* in Source Serif 4
   white, body underneath in Inter on `#F7F5EF`: *AGPL-3.0 open
   source; commercial license lifts copyleft obligations.* No
   product screenshot.
4. **Thumbnail (600x600).** The bound-brief image cropped to a
   square, ribbon bookmark visible top-right.

---

## Product 2 — Setup Engagement (One-time)

- **Name:** `sdlc-platform Setup Engagement`
- **Slug:** `sdlc-setup-engagement`
- **Type:** **One-time** purchase. Treat the deliverable as a
  service: invoice is for the engagement, not for software.
- **Status:** Draft.
- **Price:** $5,000 USD, one-time.
- **Description (~80 words):**
  > We deploy the sdlc.cc gateway inside your AWS, Azure, GCP, or
  > on-prem environment, configure the DLP pattern bundle for your
  > matter types (privileged communication, work product, client
  > identifiers), wire SCIM and SSO against your identity provider,
  > and hand over a runbook with a one-hour transfer call. Engagement
  > runs one to two weeks calendar time. Sold standalone or alongside
  > the Commercial License. AGPL-3.0 users may also purchase.

### Variants

Single variant; no tiers.

### Custom fields (checkout)

| Field | Type | Required | Notes |
|---|---|---|---|
| Target deployment environment | select (`AWS`, `Azure`, `GCP`, `On-prem`) | **yes** | Drives the runbook template. |
| Preferred start date | date | **yes** | We confirm within 1 business day. |
| Identity provider | text | no | e.g. "Okta", "Azure AD", "Google Workspace". |

### Redirect after purchase

`https://sdlc.cc/welcome/setup`

### Image prompts

1. **Hero (1600x800).** A printed runbook with a tabbed index,
   open to a page titled *Deployment runbook — sdlc.cc gateway*.
   Off-white background, oxblood tab markers, Source Serif 4
   chapter heading visible.
2. **Icon (512x512).** A simplified runbook silhouette in oxblood
   line art on `#F7F5EF`.
3. **Social card (1200x630).** Title *Setup Engagement — $5,000
   one-time* in white on an oxblood bar; subtitle *Gateway
   deployed in your VPC. DLP tuned to your matters. Runbook
   handover.* on `#F7F5EF` below.
4. **Thumbnail (600x600).** Stack of three runbooks viewed from
   the spine, oxblood tabs protruding.

---

## Product 3 — Support Contract (Monthly)

- **Name:** `sdlc-platform Support Contract`
- **Slug:** `sdlc-support`
- **Type:** Subscription, **monthly** billing.
- **Status:** Draft.
- **Description (~70 words):**
  > Three response-time tiers for organisations running sdlc.cc in
  > production. Each tier covers bug triage, security advisories,
  > and the upgrade path. Pro and Priority include a monthly check-in
  > and a named contact. Sold standalone; you do not need the
  > Commercial License to subscribe. Cancel any time; cancellation
  > takes effect at the end of the current monthly cycle. Slack
  > and email channels both supported.

### Variants

| Variant slug | Label | Price | SLA |
|---|---|---|---|
| `basic` | Basic | $500 / mo | Response within 5 business days. |
| `pro` | Pro | $1,000 / mo | Response within 1 business day; monthly check-in. |
| `priority` | Priority | $2,000 / mo | Response within 4 business hours; named contact; monthly check-in. |

### Custom fields (checkout)

| Field | Type | Required | Notes |
|---|---|---|---|
| Slack workspace or email for support channel | text | **yes** | We provision the channel within 1 business day. |
| Primary contact name | text | no | For the Priority tier this becomes the named-contact field. |

### Redirect after purchase

`https://sdlc.cc/welcome/support`

### Image prompts

1. **Hero (1600x800).** A telephone handset on a wooden desk
   beside an open binder labelled *Incident Log*, oxblood ribbon
   marker, off-white background, evening warm light. Conveys
   on-call seriousness without engineer-with-laptop cliché.
2. **Icon (512x512).** A simple oxblood line-art handset on
   `#F7F5EF`, hairline circle around it.
3. **Social card (1200x630).** Three columns labelled *Basic*,
   *Pro*, *Priority* with response times underneath; oxblood
   header bar, Source Serif 4.
4. **Thumbnail (600x600).** The incident-log binder cropped
   square.

---

## Product 4 — Sponsor sdlc.cc (Optional, Pay-What-You-Want)

- **Name:** `Sponsor sdlc-platform`
- **Slug:** `sdlc-sponsor`
- **Type:** **One-time**, **custom amount** (pay-what-you-want).
- **Status:** Draft (optional — only publish if the GitHub Sponsors
  page is also wired up, to avoid two separate funnels).
- **Minimum:** $5 USD.
- **Description (~40 words):**
  > Mirror of the GitHub Sponsors funnel for buyers whose
  > procurement team prefers LemonSqueezy invoicing over GitHub.
  > Funds maintenance of the AGPL-3.0 open-source release. No
  > license rights conveyed; this is a donation, not a purchase.

### Variants

None; amount is buyer-supplied at checkout.

### Custom fields (checkout)

| Field | Type | Required | Notes |
|---|---|---|---|
| Public sponsor name (optional) | text | no | Shown in `SPONSORS.md` if provided. Leave blank for anonymous. |
| Comment | textarea | no | Up to 280 characters; we may quote on the sponsors page. |

### Redirect after purchase

`https://sdlc.cc/thank-you/sponsor`

### Image prompts

1. **Hero (1600x800).** A printer's tray of metal type spelling
   `THANK YOU`, oxblood ink-stained roller alongside, off-white
   background. Restrained, no balloons, no confetti.
2. **Icon (512x512).** An oxblood ampersand `&` in Source Serif 4
   on `#F7F5EF`.
3. **Social card (1200x630).** *Sponsor sdlc.cc* in serif, body
   text *Fund the AGPL-3.0 release. Minimum $5. No license rights
   conveyed.*
4. **Thumbnail (600x600).** The metal-type tray cropped square.

---

## Post-creation checklist (for the human)

After the human creates the products in LemonSqueezy:

1. Copy the **variant IDs** back into
   [`landing-page/src/app/pricing/tiers.ts`](../../landing-page/src/app/pricing/tiers.ts),
   replacing the `LS_CHECKOUT_ID_*` placeholders.
2. Confirm the **after-purchase redirects** match the URLs above —
   LS appends `?order_id=…&order_number=…&signature=…` automatically;
   our welcome pages must verify the signature server-side before
   trusting `{license_key}`.
3. Test each variant with a **$0 test mode** purchase before going
   live.
4. Mirror the four redirect pages into the App Router:
   - `/welcome/commercial`
   - `/welcome/setup`
   - `/welcome/support`
   - `/thank-you/sponsor`
5. Add a `lemonsqueezy:webhook` route under `pages/api/checkout/`
   to handle `subscription_created`, `subscription_cancelled`, and
   `order_created` events; the existing `pages/api/checkout/` folder
   already has the scaffold.
