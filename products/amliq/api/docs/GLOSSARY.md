# GLOSSARY.md — AML/Compliance Terminology

## Regulatory Acronyms

| Acronym | Full Form | What It Means |
|---------|-----------|---------------|
| AML | Anti-Money Laundering | Laws preventing criminals from hiding money origins |
| CFT | Combating Terrorist Financing | Laws preventing financing of terrorist organizations |
| KYC | Know Your Customer | Process of verifying customer identity (onboarding) |
| KYT | Know Your Transaction | Monitoring ongoing transactions for suspicious activity |
| PEP | Politically Exposed Person | High-risk individuals (government officials, close family) |
| SDN | Specially Designated Nationals | OFAC's list of sanctioned individuals/entities |
| OFAC | Office of Foreign Assets Control | US agency that maintains sanctions lists |
| FATF | Financial Action Task Force | International AML/CFT standards body |
| GDPR | General Data Protection Regulation | EU data privacy law (affects screening) |
| PSD2 | Payment Services Directive 2 | EU regulation for payment service providers |
| MiFID II | Markets in Financial Instruments Directive II | EU securities regulation (impacts screening) |
| BSA | Bank Secrecy Act | US law requiring AML compliance |
| FinCEN | Financial Crimes Enforcement Network | US agency that enforces AML laws |
| SAR | Suspicious Activity Report | Filing when institution detects potential crime |
| CTR | Currency Transaction Report | Filing for cash transactions >$10k (US) |
| UBO | Ultimate Beneficial Owner | Person who ultimately owns/controls entity |
| STR | Suspicious Transaction Report | Report filed for suspicious transactions (UK/EU term for SAR) |
| TFS | Targeted Financial Sanctions | Sanctions aimed at specific persons/entities (FATF Rec. 6-7) |
| CPF | Counter Proliferation Financing | Preventing financing of WMD proliferation (FATF focus since 2023) |
| EDD | Enhanced Due Diligence | Deeper investigation for high-risk customers/transactions |
| CDD | Customer Due Diligence | Standard identity verification and risk assessment |
| SDD | Simplified Due Diligence | Reduced checks for low-risk scenarios |
| AMLD6 | 6th Anti-Money Laundering Directive | Current EU AML directive (adopted May 2024) |
| AMLA | Anti-Money Laundering Authority | EU central AML supervisor (operational July 2025, Frankfurt) |
| OFSI | Office of Financial Sanctions Implementation | UK agency enforcing financial sanctions |
| FCDO | Foreign, Commonwealth and Development Office | UK foreign policy department (sets sanctions policy) |
| POCA | Proceeds of Crime Act 2002 | UK primary money laundering legislation |
| MLR | Money Laundering Regulations 2017 | UK CDD/AML requirements for regulated firms |
| NCA | National Crime Agency | UK law enforcement for serious/organized crime |

## Screening Concepts

| Term | Definition | Example |
|------|-----------|---------|
| **Sanctions List** | Database of individuals/entities banned by governments | OFAC SDN, UN Security Council |
| **Watchlist** | Monitored but not necessarily banned | Internal risk list, PEP lists |
| **Screening** | Process of checking entity against sanctions lists | Input: "John Smith" → Output: Match? |
| **Match** | Entity found on a sanctions list | "John Smith" matches OFAC entry |
| **False Positive** | Match that's incorrect (different person, typo) | Common in screening (expensive to review) |
| **True Match** | Actual sanctioned entity (money/risk) | Real John Smith who IS on OFAC list |
| **Confidence Score** | AI's certainty that match is real (0-100) | 87 = likely match, 42 = uncertain |
| **Disposition** | Decision after match found | Accept / Reject / NeedsReview / FalsePositive |
| **Alert** | High-confidence match requiring manual review | Confidence 75+ → Creates alert for analyst |
| **Explainability** | Showing WHY system made decision | "Matched on exact family name + phonetic" |

## Matching Algorithms

| Algorithm | How It Works | What It Catches |
|-----------|------------|-----------------|
| **Exact Match** | Character-by-character comparison (with normalization) | "JOHN SMITH" = "john smith" |
| **Fuzzy Matching** | String similarity (Jaro-Winkler) | "JOHN SMITH" vs "JON SMITH" (92% similar) |
| **Phonetic** | Sound-alike names (Soundex) | "SMITH" vs "SMYTH" (sounds same) |
| **Token** | Word-by-word comparison (Jaccard) | "John David Smith" vs "Smith, John" |
| **Embedding** | Semantic similarity (vector embeddings) | Transliterations, foreign scripts |
| **Graph** | Relationship connections | "Son of" sanctioned person |

## Disposition Types

| Disposition | Meaning | Next Step |
|-------------|---------|-----------|
| **NeedsReview** | AI uncertain, human judgment needed | Analyst reviews, makes decision |
| **Accept** | Confirmed as legitimate (not sanctioned) | Customer approved for banking |
| **Reject** | Confirmed as sanctioned | Block customer, file SAR |
| **FalsePositive** | Match was wrong (same name, different person) | Mark as whitelist, don't alert again |

## Entity Types

| Type | Definition | Example |
|------|-----------|---------|
| **Individual** | Natural person | John Smith, age 45 |
| **Company** | Legal entity / corporation | ACME Corp LLC |
| **Vessel** | Ship / boat | MV Ocean Master |
| **Aircraft** | Plane / helicopter | Boeing 747 (tail number N123AB) |

## Compliance Roles

| Role | Responsibilities | AMLIQ Access |
|------|-----------------|---------------|
| **Admin** | System configuration, user management | Full access, can change weights/thresholds |
| **Compliance Officer** | Overall risk management, policy setting | View all alerts, approve dispositions |
| **Analyst L1** | Initial review of alerts, flag for escalation | Review low-risk matches |
| **Analyst L2** | Complex investigation, escalation | Review high-risk, make final decisions |
| **Analyst L3** | Specialist (high-value targets, legal matters) | Deep investigation authority |
| **Auditor** | Compliance verification, audit trail | Read-only access to all data + audit log |

## Sanctions Lists in AMLIQ

| List | Owner | Coverage | Update Frequency |
|------|-------|----------|-------------------|
| **OFAC SDN** | US Treasury | US-controlled assets | Daily |
| **UN Security Council** | United Nations | Global terrorism/weapons | Weekly |
| **EU Consolidated Sanctions** | EU Commission | European entities | Daily |
| **UK OFSI/FCDO** | UK Government (OFSI, FCDO) | UK Sanctions List (UKSL) | Daily |
| **Swiss SECO** | Swiss Government | Swiss sanctions | Weekly |
| **Israeli Ministry of Defense** | Israeli Government | Middle East entities | Weekly |
| **Ukrainian SDFM** | Ukraine SSID | Russian/Belarusian entities | Daily |
| **OpenSanctions** | Open-source intelligence project | Global (public compilation) | Weekly |

## Risk Levels

| Level | Risk Profile | Example Client | AMLIQ Config |
|-------|-------------|-----------------|--------------|
| **Low** | Traditional bank, domestic focus | Community bank | Higher thresholds, fewer lists |
| **Medium** | International bank, mixed customer base | Mid-size regional bank | Balanced weights, all lists |
| **High** | Crypto/remittance/high-risk products | Crypto exchange | Aggressive matching, all lists + custom |
| **Critical** | Sanctioned jurisdiction operations | Payment processor for at-risk regions | Maximum layers, embedding + graph |

## Common Mistakes in Screening

| Mistake | Why It's Bad | How AMLIQ Fixes It |
|---------|------------|-------------------|
| **Single algorithm** | Misses variants (John vs Jon) | 6-layer matching catches variations |
| **Binary match/no-match** | All-or-nothing, no nuance | Confidence score (0-100) provides nuance |
| **No explainability** | "System said so" ≠ regulators | Explainer shows which layers matched |
| **Static thresholds** | One-size-fits-all | TenantConfig lets each customer adjust |
| **High false positives** | Costs analysts $100s/year to review | Weighted scoring reduces FP rate |
| **Manual review only** | Slow, inconsistent | Automated 6-layer + human review |
| **No audit trail** | Can't prove decisions made correctly | Immutable hash-chain audit log |

## Business Terms

| Term | Meaning | AMLIQ Connection |
|------|---------|------------------|
| **SaaS** | Software as a Service | AMLIQ is subscription-based (not one-time) |
| **Latency** | Time to complete request | AMLIQ targets <50ms per screening |
| **Throughput** | Requests per second capacity | AMLIQ supports 1000+ req/sec |
| **Tier/Plan** | Pricing level (Lite/Pro/Enterprise) | AMLIQ has 3 tiers per product |
| **Overage** | Usage beyond plan limit | $1 per 100 screenings beyond cap |
| **Webhook** | Event notification to your system | LemonSqueezy sends subscription events |
| **API Key** | Secret token for authentication | Prefixed per product (api_sk_, etc) |
| **Seat** | Named user in Dashboard product | $50/seat/month overage |
| **Promo Code** | Discount code | AMLIQ_FREE, EARLYBIRD, etc |

## Data Security Terms

| Term | Meaning | AMLIQ Implementation |
|------|---------|-------------------|
| **Encryption at rest** | Data encrypted in database | AES-256-GCM |
| **Encryption in transit** | HTTPS protection | TLS 1.3 mandatory |
| **PII** | Personally Identifiable Information | Encrypted separately (GDPR) |
| **Hash chain** | Tamper-proof audit trail | SHA-256 prev_hash in audit entries |
| **mTLS** | Mutual TLS authentication | Supported for B2B connections |
| **Rate limiting** | Prevent abuse via request limits | Token bucket per API key |
| **HMAC** | Webhook verification | HMAC-SHA256 for LemonSqueezy events |

## Metrics & KPIs

| Metric | What It Measures | AMLIQ Target |
|--------|-----------------|--------------|
| **False Positive Rate** | % of matches that are wrong | Target: minimize via 6-layer scoring (benchmark pending) |
| **True Positive Rate** | % of real matches caught | >95% |
| **Latency (p95)** | Time for 95th percentile request | <50ms |
| **Throughput** | Screenings per second | 1000+/sec |
| **Availability** | % of time system is up | 99.9% (4 nines) |
| **Accuracy** | Overall correctness | >98% when tuned |
| **NPS** | Customer satisfaction | Target: 50+ (benchmark pending) |

---

**Always ask yourself**: "What problem does this term solve in AML/CFT screening?"
