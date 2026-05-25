# VISION.md — AMLIQ Market Position & Product Roadmap

## Mission

Replace World-Check with an AI-powered, configurable, explainable AML/CFT screening platform that financial institutions can afford and understand.

## The Problem

- **World-Check**: $50k+/year, opaque matching, slow updates, no configurability
- **Manual review**: Banks hire compliance teams ($200k+/year), slow, inconsistent
- **False positives**: High false positive rates in traditional tools (costs money to investigate)
- **No explainability**: "System says match" — no insight into why

## Our Solution

AMLIQ provides:
1. **6-layer AI matching**: Catches more real matches than single-algorithm systems
2. **Configurable per bank**: Adjust weights, thresholds, list priorities
3. **Explainable**: "Match on family name + first letter + same DOB" (not a black box)
4. **Fast**: <50ms per screening (sub-second batch of 100)
5. **Affordable**: SaaS model ($500-5000/month per bank depending on volume)

## Target Market

**Primary**: Mid-market banks, payment processors, fintechs in US/EU/APAC
- $1B-100B+ AUM (smaller than mega-banks, larger than startups)
- Currently using World-Check or manual review
- Regulatory pressure to screen customers at onboarding
- Pain point: cost + false positives eating compliance budget

**Secondary**: Crypto exchanges, remittance services, fintech platforms
- High-risk, high-screening-volume use cases
- Willing to pay premium for fast, accurate screening

**Market size**: ~5,000 regulated financial institutions in target regions
- At 10% penetration: 500 customers × $2000/year avg = $1M ARR (conservative)
- At 30% penetration: $3M ARR

## 5 Product Lines

### 1. API
RESTful screening service for servers.
- Pricing: $1/100 screenings or $500/month flat
- Target: Developers integrating AML into payment flows

### 2. Dashboard
Web UI for compliance officers to review alerts, configure screening rules, manage team.
- Pricing: $2000/month + $50/seat/month for Analysts
- Target: Compliance teams (2-10 people per bank)

### 3. SDK
Downloadable library (Go, Python, Node.js) for offline screening.
- Pricing: $1500/month + list data per version
- Target: Banks with air-gapped environments, on-premise needs

### 4. iFrame
Embeddable screening widget for partner platforms (payment processors, crypto exchanges).
- Pricing: $500/month + per-screening fees
- Target: B2B2C platforms (Stripe, payment gateways)

### 5. Dataset
Raw sanctions list data (OFAC, UN, EU, etc.) in standardized JSON.
- Pricing: $200/month per list or $1000/month for all
- Target: Researchers, risk teams, internal compliance systems

## Competitive Landscape

| Feature | AMLIQ v2 | World-Check | Manual Review |
|---------|----------|-------------|--------------|
| Explainability | ✓ High | ✗ None | ✓ High |
| Speed | ✓ <50ms | ✓ Similar | ✗ Days |
| Cost | ✓ $500-5k/mo | ✗ $50k+/mo | ✗ $200k+/mo (team) |
| Configurability | ✓ High | ✗ Low | ✓ High |
| Accuracy | ✓ 6-layer | ✓ Proprietary | ✓ High |
| Ease of use | ✓ Developer-friendly | ✗ Legacy UI | ✓ Manual process |
| Vessel Screening | ✓ New | ✗ Limited | ✗ Manual |
| PEP Classification | ✓ 5 Tiers | ✗ Binary | ✓ Variable |
| Country Risk | ✓ 240+ Countries | ✗ Basic | ✗ Manual |
| UBO Enrichment | ✓ Full Stack | ✗ Partial | ✗ None |

## Revenue Model

SaaS subscriptions via LemonSqueezy:
- **Per-product tiers** (Lite, Pro, Enterprise)
- **Usage-based overage** (screenings beyond plan limit)
- **Annual commitment discounts** (20% off)
- **Promo codes** for early adopters (AMLIQ_FREE for testing)

## KPIs for Success

1. **Customer Acquisition**: 10 paying customers by month 6
2. **MRR**: $5k by month 12 (500 screenings/day × $1 per 100)
3. **False Positive Rate**: Designed to minimize through 6-layer weighted scoring (benchmark pending)
4. **Screening Latency**: <50ms p95 target
5. **NPS**: Target >50 (benchmark pending)
6. **Churn**: <2% MRR (industry standard ~5%)

## Roadmap — Completed Milestones (v2.0)

- ✓ **Vessel/Maritime Screening**: IMO/MMSI matching for maritime finance, port state control
- ✓ **Enhanced PEP Classification**: 5-tier system (Domestic, Foreign, IntlOrg, SOE, RCA) with risk multipliers
- ✓ **Country Risk Index**: 240+ countries with CPI + FATF + Basel + WorldBank composite scoring
- ✓ **UBO Enrichment**: Ultimate Beneficial Owner screening + classification + risk profiles
- ✓ **Compliance Documentation**: SOC 2 readiness, incident response, access controls
- ✓ **Advanced Ingestion**: EveryPolitician PEP data, GLEIF LEI, ICIJ databases, OpenSanctions premium

## Roadmap (Next 6-12 Months)

- **Month 1-2**: Beta with 3 pilot customers (US regional banks)
- **Month 3-4**: Public launch of enhanced API + Dashboard (v2.1 release)
- **Month 5-6**: SDK for Go, Python (community demand)
- **Month 7-8**: iFrame widget (payment processor partnerships)
- **Month 9-10**: Graph matching with relationship traversal
- **Month 11-12**: Enterprise support, SLAs, training + SOC 2 Type II attestation

## Why We Win

1. **Explainable AI**: Regulators prefer to see "why" not "how"
2. **Configurability**: One-size-fits-all doesn't work in compliance
3. **Speed**: Time-to-screening matters for customer onboarding
4. **Cost**: 10x cheaper than World-Check, 100x cheaper than hiring team
5. **Open model**: Show customers how we match (build trust)

---

See `docs/BILLING_MODEL.md` for detailed pricing structure and product tiers.
