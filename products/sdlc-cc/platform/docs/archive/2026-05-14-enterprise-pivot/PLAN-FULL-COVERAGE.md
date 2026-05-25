# Full-Coverage Plan — Every Claude + OpenAI surface, FI-grade, production

Created: 2026-05-02. Author scope: technical roadmap + compliance + ops + GTM
required to deliver the CTO's stated vision.

> **Vision (verbatim from session)**: cover every Claude surface employees
> use (web, desktop, mobile, Code, custom apps), plus OpenAI equivalents,
> with full DLP across email + Excel + file workflows, production-grade for
> financial institutes, with measurable leak detection. Less than this is
> not the goal.

This document is the full plan. Subsequent sections specify what work,
what cost, what risk, what unlocks each tier.

---

## Part A — Surface coverage matrix

The product wins by covering every place an employee can hand data to a
model. Each surface needs its own interception strategy.

| Surface | Protocol | Status today | Component needed |
|---|---|---|---|
| Anthropic SDK custom apps | `/v1/messages` | ✅ shipped | Gateway (have it) |
| OpenAI SDK custom apps | `/v1/chat/completions` | ❌ | Gateway OpenAI compat |
| Claude Code (CLI) | SDK over `ANTHROPIC_BASE_URL` | ✅ via env | MDM policy push |
| chat.anthropic.com (web) | Browser → Anthropic web | ❌ | Browser extension |
| chatgpt.com (web) | Browser → OpenAI web | ❌ | Browser extension |
| Claude desktop app | Same web protocol | ❌ | Same browser extension via Electron embedded webview interception |
| Claude / ChatGPT iOS | Mobile cert-pinned | ❌ | MDM-installed root CA + transparent proxy |
| Claude / ChatGPT Android | Mobile cert-pinned | ❌ | Same |
| Outlook (M365) "send to Claude" | Office.js add-in | ❌ | M365 add-in |
| Excel (M365) "analyze with Claude" | Office.js add-in | ❌ | M365 add-in |
| Word (M365) | Office.js add-in | ❌ | M365 add-in |
| Teams "ask Claude" bot | Teams app SDK | ❌ | Teams app |
| Gmail (Workspace) | Apps Script add-on | ❌ | GAS add-on |
| Google Sheets | Apps Script add-on | ❌ | GAS add-on |
| Google Docs | Apps Script add-on | ❌ | GAS add-on |
| Slack "ask Claude" | Slack app | ❌ | Slack app + bot |
| Microsoft Copilot for M365 | Graph API webhooks | ❌ | Graph subscription |
| Google Gemini (Workspace) | Workspace AI APIs | ❌ | Vertex AI compat |
| GitHub Copilot in IDE | Cert-pinned to GitHub | ❌ | IDE plugin (VS Code, JetBrains) |
| Cursor IDE | Anthropic SDK | ✅ via env | Same MDM as Claude Code |
| Windsurf / Codeium | Mixed | ❌ | IDE plugin |
| Notion AI | Notion API | ❌ | Notion API hooks |
| Slack AI | Slack proprietary | ❌ | Slack workspace integration |

**Verdict**: ~5 of 22 surfaces work today (gateway + Claude Code + Cursor +
custom Anthropic SDK + custom OpenAI SDK once compat ships). Real
coverage requires a multi-pronged client + plugin + MDM strategy.

---

## Part B — DLP / Privacy engine — what FI actually needs

The current detector covers 15 PII classes via regex. FI deployments
need substantially more.

### B.1 Detection engine upgrades

| Capability | Status | Why needed |
|---|---|---|
| Microsoft Presidio integration | ❌ | Industry-baseline recall (~85-95% on synthetic, our regex is lower) |
| Custom NER models for finance | ❌ | Account numbers in proprietary formats, customer IDs, internal trade IDs |
| Reversible tokenization (Redis-backed cross-instance) | 🟡 in-process only | Multi-instance HA; FI traffic > one node |
| Output echo scanning | ❌ | Catches model echoing or inferring redacted PII (the #1 leak vector) |
| Differential analysis | ❌ | Compare with-DLP vs without-DLP outputs to surface re-identification |
| OCR for image content | ❌ | FI customers paste check images, statements, passports |
| PDF / DOCX / XLSX content extraction + DLP | ❌ | Excel-feed workflows |
| Audio transcription + DLP (Whisper local) | ❌ | Call recordings, voicemails |
| Multi-language PII | partial | German Steuer-ID, French NIR, Japanese My Number, Chinese Resident ID |
| Adversarial/bypass detection | ❌ | Prompt injection, encoding evasion, base64-wrapped PII |
| Confidence scoring per match | ❌ | Triage signal — high-confidence auto-block, low-confidence flag |

### B.2 Leak-detection harness

This is what your CTO question requires. Six techniques, each
addressing a different leak class:

1. **Synthetic ground-truth corpus** — labeled PII in your specific
   data formats. Run on every commit. Recall < 99% blocks merge.
2. **Presidio shadow comparator** — Presidio runs in parallel,
   diff hourly, every divergence = ticket.
3. **Output echo scanner** — re-scan responses for input-PII
   patterns. Match = the model leaked.
4. **Audit gap detector** — `count(detections) == count(audit_logs)`,
   nightly cron. Mismatch = silent drop.
5. **Side-channel sweep** — grep all outbound URLs / headers /
   error bodies for PII.
6. **Quarterly red-team** — adversarial corpus + variations: encoded,
   split, paraphrased, encoding-evaded.

Build cost: ~3-4 weeks for v1 of all six.

---

## Part C — Compliance + Trust

The FI deal requires non-code artifacts.

| Asset | Cost | Time | Required for |
|---|---|---|---|
| **SOC 2 Type II readiness audit** | $40-80K | 6 weeks | Type II observation start |
| **SOC 2 Type II observation period** | minimal | 6 months | Type II report |
| **SOC 2 Type II final audit + report** | $40-80K | 4 weeks | All FI customers |
| **External penetration test (annual)** | $25-60K | 3 weeks | Vendor risk reviews |
| **HIPAA BAA template + readiness** | $10K legal | 4 weeks | Health-finance customers |
| **PCI-DSS readiness** (if card data) | $50-150K | 12 weeks | Payment-flow tenants |
| **ISO 27001 mapping + cert** | $100-200K | 12 months | International FI (esp. EU) |
| **NIST 800-53 mapping** | internal | 6 weeks | US gov-adjacent |
| **GLBA Safeguards Rule mapping** | internal | 4 weeks | All US FI |
| **GDPR Article 28 DPA template** | $5-15K legal | 4 weeks | EU customers |
| **CCPA notice updates** | $5K legal | 2 weeks | California customers |
| **Subprocessor list + change-notification system** | engineering | 2 weeks | All enterprise |
| **Vulnerability disclosure policy + bug bounty** | $30K/year | 4 weeks | Trust signal |
| **CAIQ Lite + SIG Lite pre-fills** | internal | 4 weeks | Sales unblock |
| **Cyber liability insurance ($5-25M coverage)** | $50-300K/year | 8 weeks | Legal sign |
| **E&O insurance ($5M+)** | $20-100K/year | 4 weeks | Legal sign |
| **D&O insurance** | $15-50K/year | 4 weeks | Board protection |
| **Background-check vendor (Checkr/HireRight)** | $200/employee | ongoing | Staff with data access |
| **Right-to-audit clause + audit support process** | internal | 4 weeks | All FI MSAs |

**Year 1 compliance + insurance burn: ~$300-700K**.

---

## Part D — Infrastructure

Production FI deployments need infrastructure we don't have today.

| Component | Status | Need |
|---|---|---|
| Multi-region active-passive | ❌ | RPO/RTO commitments for FINRA BCP |
| HSM-backed CMEK per tenant | 🟡 platform-wide BYOK only | Per-tenant key isolation |
| PrivateLink / Private Endpoint / PSC | partial | No-public-internet ingress for HIPAA/FINRA |
| WAF (Cloudflare Magic / Fastly) | ❌ | DDoS + L7 attacks |
| TLS 1.3 enforced everywhere (Day 37 🔴) | ❌ | GLBA encryption-in-transit |
| Certificate transparency monitoring | ❌ | Catch rogue cert issuance |
| Secrets management (Vault) | partial | Eliminate env-var keys |
| Per-tenant rate limiting with Redis cluster | partial | Single-tenant-noisy-neighbor protection |
| Documented RPO/RTO with quarterly drill evidence | ❌ | Vendor risk review answer |
| Backup + restore drills monthly | ❌ | BCP audit trail |
| PostgreSQL HA (replication + auto-failover) | partial | 99.99% SLA capability |
| Redis HA (sentinel/cluster) | partial | Tokenize map availability |
| Observability (Prometheus + Grafana + Loki + Tempo) | partial | Incident triage |
| OTel exporters everywhere + Perfetto for analysis | partial | p99 latency proof |
| SIEM integration (Splunk/Sumo/Datadog) | ❌ | Enterprise customer requirement |
| SOAR for incident automation | ❌ | 24/7 ops scale |
| Vulnerability scanning (Snyk/Trivy/Dependabot) | partial | Continuous SAST |
| Container image signing (Cosign/Sigstore) | ❌ | Supply chain integrity |
| SBOM per release | ❌ | Executive Order 14028 if US gov |
| SLSA Level 3+ build provenance | ❌ | Mature supply chain |

**Year 1 infrastructure investment: ~$50K-200K/month at production scale**.

---

## Part E — Operations + people

Software is the small part. Running it for FI customers is the rest.

| Role | Headcount Year 1 | Notes |
|---|---|---|
| Platform engineering | 4-6 | Gateway, DLP engine, surface plugins |
| SRE / infrastructure | 2-3 | Multi-region, HA, observability |
| Security engineering | 2-3 | Threat model, pen-test remediation, detection engineering |
| Compliance | 1-2 | SOC 2, ISO, customer audits, vendor questionnaires |
| 24/7 SOC | 4 (or outsourced MSSP $200-500K/yr) | Detection + response |
| Customer success / FI accounts | 2-4 | Onboarding 4-8 weeks per FI |
| Solutions architects / FDE | 2-4 | Per-tenant config + migration |
| Sales engineering | 2-4 | Security questionnaire response, POC |
| Sales (FI focus) | 2-4 | Long cycle, $250K-2M ARR deals |
| Legal / DPO | 1-2 (or fractional) | Contracts, DPAs, breach notification |

**Total Year 1 headcount: 22-37 people. Payroll: ~$5-10M.**

---

## Part F — Realistic timeline

### Phase 1 (Months 0-3): Foundations
- OpenAI compat (`/openai/v1/chat/completions` + `/v1/responses`)
- SAML ACS route mounted
- Test harness built (synthetic corpus + Presidio shadow + 4 other techniques)
- SOC 2 readiness audit started
- Pen test scheduled
- Browser extension v0 (Chrome only, claude.ai paste-intercept)
- Claude Code MDM doc + Jamf/Intune profile
- HSM CMEK research + plan
- Multi-region deployment plan
- Insurance procurement started
- 2-3 design partner FIs signed under NDA

**Exit criteria**: design partner pilot running, observation period
started, no production customer data at risk.

### Phase 2 (Months 3-6): Surfaces + scale
- Browser extension Chrome production + Firefox + Edge
- Outlook + Excel add-ins
- Mobile MDM transparent proxy (iOS + Android)
- HSM CMEK shipped
- Multi-region active-passive
- WAF + DDoS protection
- TLS 1.3 enforcement
- 24/7 SOC stood up (or MSSP contracted)
- SOC 2 Type II observation continuing
- 5-10 design partners

**Exit criteria**: every Claude/OpenAI surface has a defensive
component, observation period 50% complete.

### Phase 3 (Months 6-9): Compliance unlock
- SOC 2 Type II final audit + report
- Pen test report
- DPA + subprocessors page + insurance certificates
- Word/Teams add-ins
- Gmail/Sheets/Docs add-ons
- Slack app
- Output echo scanner production
- Customer audit support process
- First production FI signed (post-Type II)

**Exit criteria**: SOC 2 Type II report delivered. Sellable to
enterprise FI legal review.

### Phase 4 (Months 9-12): Production at scale
- 10-15 production customers
- ISO 27001 in flight
- HIPAA BAA template + first health-finance customer
- Bug bounty live
- Quarterly compliance review process per customer
- Status page + on-call runbooks
- Customer success org operational

**Exit criteria**: $3-10M ARR, 10+ production customers, no leak
incidents in past 90 days.

### Year 2: Market leader
- ISO 27001 certified
- FedRAMP Moderate readiness (US gov-adjacent)
- 50+ enterprise customers
- Channel partner program (Big 4 consulting + CASB resellers)
- Analyst relations (Gartner)
- Series B or strategic acquirer conversations

---

## Part G — Cost / Funding profile

| Year | Burn | Revenue | Notes |
|---|---|---|---|
| 1 | $5-10M | $250K-1M (pilots) | Pre-revenue / early revenue |
| 2 | $10-15M | $3-15M ARR | First FI prod customers |
| 3 | $15-25M | $15-50M ARR | Mid-market expansion |

**Implication**: requires **~$8-15M Series A** to fund Year 1 + Year 2
ramp before Year 3 revenue covers burn.

Alternative: **bootstrap to $1-3M ARR** with 5-10 design partners + 3-5
mid-market customers using the post-SOC-2 trust pack, take Series A
later from a position of revenue strength. Slower but less dilutive.

---

## Part H — What gets built first (CTO can ship without funding)

Without a fundraise, the path that gets you to a sellable design-partner
pilot in 90 days:

1. **Week 1-2**: OpenAI compat + SAML ACS (~5 days)
2. **Week 3-4**: Test harness — synthetic corpus + Presidio shadow + audit-gap detector (~10 days)
3. **Week 5-6**: Browser extension v0 — Chrome only, claude.ai
   paste-intercept, posts detections to gateway (~10 days)
4. **Week 7-8**: Claude Code MDM doc + Jamf profile + Microsoft Intune
   profile (~5 days)
5. **Week 9-10**: First FI design partner pilot — your own org,
   internal-only, employee Slack channel only, with the test harness
   running shadow mode for 30 days
6. **Week 11-12**: Document leak-detection findings, harden the
   detection engine where shadow mode found gaps, write up case
   study from your own org's pilot
7. **Month 4**: Take case study + harness data to 3-5 design partner
   FIs. Sign 3-month pilots @ $25-50K each.
8. **Month 5-6**: Use pilot revenue + insights to scope SOC 2
   readiness audit + pen test (Year 1 burn ~$200K).

This path requires zero outside funding and zero new headcount until
month 5-6. It also generates the test data + customer references the
SOC 2 work needs.

---

## Part I — What kills this plan

Honest risks:

1. **Anthropic / OpenAI ship native enterprise DLP**. They both have
   Enterprise plans. If they bundle DLP into the Team SKU at no cost,
   our market disappears overnight.
2. **Microsoft Purview for Copilot expands** to cover non-Microsoft
   AI providers. Microsoft already has the M365 distribution; if they
   ship a Claude/OpenAI integration, the Outlook/Excel surfaces
   collapse to them.
3. **Browser-extension distribution is hard**. Enterprise IT teams
   are conservative. Getting MDM-pushed to 1000+ employee orgs takes
   3-6 months per customer.
4. **Mobile cert-pinning is intentionally adversarial**. Apple and
   Google are actively making MDM-CA-injection harder each release.
5. **Compliance burn outpaces revenue**. Year 1 SOC 2 + insurance +
   legal can run $500K before first prod customer signs.
6. **Leak event in pilot**. One PR-worthy leak in a design partner
   pilot ends the company. The leak-detection harness is mandatory
   before any production customer data flows.

Mitigations:

1. Be the **provider-agnostic** layer. If Anthropic ships enterprise
   DLP, we still cover OpenAI + Gemini + on-prem models. Position as
   the unified policy plane, not just an Anthropic gateway.
2. Differentiate on **multi-provider** + **finer-grained policy**
   (custom regex packs per tenant, output echo scanning, GDPR
   Article 15 self-serve).
3. Ship browser extension via **Chrome Web Store unlisted +
   per-customer enterprise install link** — bypass Chrome Web Store
   review for sensitive customers.
4. For mobile, offer a **"managed Claude" wrapper app** that customer
   IT distributes via MDM — sidesteps cert-pinning by being our own
   client.
5. Bootstrap Path H above before raising; revenue-funded Year 1
   reduces compliance burn risk.
6. **Test harness is non-negotiable before any production data**.
   Build it before the first pilot.

---

## Part J — Decision points for the CTO

You need to decide:

1. **Funding model**: bootstrap (slower, less dilutive, smaller TAM
   reach Year 1) vs Series A (faster, more risk, bigger ambition).
2. **Founding team**: do you bring co-founders for compliance + sales?
   Solo CTO can't ship Year 1 plan alone.
3. **Customer scope Year 1**: ~3 FI design partners (high-touch,
   slow) or ~10 mid-market customers (broader, less revenue per).
4. **Anthropic + OpenAI relationship**: do you partner (channel
   resell, integration) or compete-with-them (independent)?
5. **Build vs buy**: license Microsoft Presidio (open source, free) +
   AWS Macie (paid) vs build proprietary ML models?
6. **Deployment model**: SaaS multi-tenant, single-tenant cloud,
   on-prem appliance, or all three?

These choices change the plan above by 30-50% in either direction.

---

## Closing

This plan is the maximalist version. Every line item exists to clear a
real objection from a real customer (the "I've talked to a lot of FI
buyers in security" filter). It is also the version that requires a
real engineering org + real funding + 12-24 months of focused
execution.

The reduced version — bootstrap path, 5-10 design partners, OpenAI
compat + browser extension + test harness, no SOC 2 until pilot revenue
funds it — is a real business and is the rational starting point for
a CTO with day-job constraints.

Pick a path. Then we plan the next 30 days.
