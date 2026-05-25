# Commercial License — sdlc-platform

**Last updated:** 2026-05-20
**Open-source license:** [AGPL-3.0-or-later](LICENSE)

The OSS code in this repository is licensed under AGPL-3.0-or-later.
Commercial buyers can lift the AGPL source-disclosure obligation
under a tiered commercial license.

## When you need the commercial license

You need a commercial license **only** if you want to embed
`sdlc-platform` (or any service in this repository) inside a
closed-source product, SaaS, or internal proprietary system **and
you do not want to release your source code under AGPL-3.0**.

The AGPL-3.0 grants you the right to use, modify, and redistribute
the code freely **on the condition** that any networked or
distributed derivative product must also be released under AGPL-3.0
with full source disclosure. The commercial license lifts that
condition.

You **do not** need the commercial license if:

- You are evaluating the gateway on your own machine.
- You self-host the gateway for your own internal use and do not
  offer access to third parties as a service.
- You contribute back to this repository under the same AGPL-3.0
  terms.
- You run a paid service that **does** release its source under
  AGPL-3.0 (and complies with the rest of the AGPL terms).

## Tiers

| Tier | Price | Seats | What it covers |
|---|---|---|---|
| **Free (self-host)** | $0 | unlimited | AGPL-3.0 terms apply. No commercial buyout, no support. |
| **Team** | $39/seat/mo | 5+ | Commercial buyout · email support · semver upgrade window · all DLP presets (including `legal`) |
| **Business** | $79/seat/mo | 10+ | Team + extension store-listed builds · SAML/SCIM bundled · priority SLA (1 business day) · DPA template |
| **Enterprise** | from $4,000/seat/yr | negotiated | Business + custom DLP presets · DPA negotiation · CMEK · named on-call · 5-business-day SLA · audit-log retention extensions |

A "seat" is one end-user identity authorised to interact with the
gateway, the browser extension, the IDE addins, or the Office addins.

Prices reviewed annually. Existing customers' renewals lock at the
price they signed, for two renewal cycles.

### Volume + non-profit

- **Volume:** 10% off at 25+ seats, 20% off at 100+ seats. Stacks
  with Business or Enterprise tier.
- **Educational / non-profit / government grant-funded:** 50% off,
  contact `commercial@sdlc.cc`.
- **First-year (Business + Enterprise only):** 25% off if signed
  before 2026-12-31.

## What every paid tier grants

- A perpetual, non-transferable, non-exclusive right to use the
  current and prior versions of the software in closed-source
  products and services for the term of the license.
- Permission to keep your derivative source private — no AGPL
  source-disclosure obligation.
- Permission to redistribute compiled binaries to your end users
  as part of a closed-source product.
- Access to a private support channel.

## What no tier grants

- The right to redistribute the source code under any license
  other than AGPL-3.0 to third parties (commercial-license holders
  must keep the source confidential within their organisation).
- Transferability — the license is non-transferable except as part
  of a sale of substantially all of the licensee's assets.
- A warranty. The software is provided "as is" — see the
  limitation-of-liability section in the actual contract.
- An indemnity. We do not indemnify against third-party IP claims.
- A certification or compliance attestation. The commercial
  license does NOT bundle SOC 2, HIPAA, ISO 42001, or FINRA
  certificates. Those are separate yr-2+ deliverables — track at
  [trust/soc2.html](trust/soc2.html).

## Optional add-ons (any tier)

| Add-on | Price | What it includes |
|---|---|---|
| **Setup engagement** | $5,000 one-time | We deploy the gateway in your infrastructure, configure DLP for your use case, hand over the runbook. ~1-2 weeks. |
| **Support contract** | $500-$2,000 / month | Prioritised bug fixes, upgrade path, named contact, monthly check-in. |

Add-ons are billed separately. Either can be purchased without the
commercial license (against the AGPL release).

## Trust posture

Every paid tier inherits the same Trust posture — see
[trust/](trust/) for the Trust Center covering sdlc-platform,
AMLIQ, and Claw under one MSA. A single signed MSA + DPA covers
any combination of the three products.

## How to buy

1. Visit **https://sdlc.cc/pricing** (live once Wave 3 landing
   ships).
2. Pick Team or Business → LemonSqueezy checkout, instant
   activation. Enterprise → email `commercial@sdlc.cc` for an MSA
   + Order Form.
3. Receive a signed PDF license agreement within 24 hours (Team /
   Business) or 5 business days (Enterprise w/ redlines).
4. (Optional) Schedule a setup-engagement intake call.

## How to verify a license

The signed PDF contains a license key with embedded organisation
name + tier + seat count + expiry date. The gateway's
`/admin/license` endpoint accepts the key and reports its
validity. (Once Track A1 ships — see [ROADMAP.md](ROADMAP.md).)

## What happens at renewal

We email you 60 days before expiry. Same seat count → price stays
locked. Seat-count increase → new seats billed at the prevailing
rate; original seats stay locked for two more renewal cycles.

If you do not renew, you retain perpetual rights to the version
covered during the license term but receive no further support,
upgrades, or new versions under the commercial license. You revert
to AGPL terms for any newer version.

## How to evaluate before buying

The AGPL release is the same code as every paid tier. Clone the
repo, run `docker-compose up`, hit `POST /v1/redact`. There is no
separate "trial" build — the commercial license is a contract
artifact, not a different binary.

## Questions

- **Sales / legal:** `commercial@sdlc.cc` (response within 1
  business day)
- **Technical evaluation:** GitHub issues on
  https://github.com/finsavvyai/sdlc-platform
- **General:** `hello@sdlc.cc`

## License history

| Date | License | Why |
|---|---|---|
| Pre-2026-05-16 | Business Source License 1.1 | Default Cloudflare-Workers / MariaDB-style license |
| 2026-05-16 | AGPL-3.0-or-later + flat $4K/seat/yr commercial | Vertical legal-AI OSS play |
| **2026-05-20** | **AGPL-3.0-or-later + tiered commercial** (Free · Team · Business · Enterprise) | Privacy-gateway pivot — broader TAM than legal vertical alone ([decision record](docs/PIVOT-2026-05-20-PRIVACY-GATEWAY.md)) |

This document, and the license decisions behind it, can change
with future pivots. The license terms applicable to a release are
the ones in effect at the time of that release.
