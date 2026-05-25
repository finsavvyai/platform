# Legal-AI Competitive Depth — 2026-05-16

Audience: mid-market US law firms (50–500 attorneys). Product: AGPL-3.0 + commercial-license LLM gateway, $4K/yr/seat.

## 1. Verdict

**The gap is real, and it just got bigger.** Harvey, CoCounsel, Hebbia, and Legora are explicitly priced and packaged for AmLaw 200 — Harvey requires 25-seat minimums at ~$1,200–$2,000/seat/month, i.e. $288K floor ([AI Vortex](https://www.aivortex.io/legal/ai-tools/harvey-ai-pricing-2026/), [Irys](https://www.irys.ai/insights/market/harvey-enterprise-pricing-legal-ai-april-2026)). Mid-market practice-management AI (Clio Duo, MyCase IQ) tops out around $39–$99/seat/month but is shallow — document summarization, no real privilege-preserving retrieval ([Lawyerist](https://lawyerist.com/reviews/artificial-intelligence-in-law-firms/clio-duo-review-artificial-intelligence-for-lawyers/)). **No major vendor offers self-hosted deployment.** That matters more than ever post-*US v. Heppner* (SDNY, Feb 2026), where Judge Rakoff held AI prompts to a consumer LLM destroyed both attorney-client privilege AND work-product protection ([Gibson Dunn](https://www.gibsondunn.com/ai-privilege-waivers-sdny-rules-against-privilege-protection-for-consumer-ai-outputs/), [Harvard L. Rev.](https://harvardlawreview.org/blog/2026/03/united-states-v-heppner/)). $4K/yr/seat with self-host is a defensible wedge into 50–500 attorney firms that cannot stomach Harvey's $14,400/yr/seat floor and refuse to ship matter data to a SaaS after Heppner.

## 2. Competitor Matrix

| Vendor | 2026 Price (real) | Buyer Tier | Self-host? | Privilege handling | Deploy time | Won't serve |
|---|---|---|---|---|---|---|
| **Harvey** | $1,200–$2,000/seat/mo, 25-seat min (~$288K floor) ([AI Vortex](https://www.aivortex.io/legal/ai-tools/harvey-ai-pricing-2026/)) | AmLaw 100/200 | No (SaaS only) | DPA + zero-retention contractual | 4–8 wk pilot | <25-lawyer firms; <$10M revenue |
| **CoCounsel (TR)** | $225/user/mo standalone; bundled w/ Westlaw $400–$500+/mo all-in ([TR sales](https://sales.legalsolutions.thomsonreuters.com/en-us/products/cocounsel-legal/700/plans-pricing), [Lawyerist](https://lawyerist.com/reviews/artificial-intelligence-in-law-firms/cocounsel-review-artificial-intelligence-for-lawyers/)) | BigLaw + mid-market | No | Westlaw DPA, SaaS | 2–4 wk | Firms unwilling to standardize on Westlaw |
| **Spellbook** | $99–$199/mo or ~$300–$350/mo enterprise ([AI Vortex](https://www.aivortex.io/legal/compare/spellbook-pricing-2026/)) | Mid-market + boutique transactional | No | SaaS, contractual | <1 wk | Litigation, regulated industries with on-prem mandates |
| **Robin AI** | Effectively dead — Dec 2025 acquihire to Scissero; Microsoft took engineering Jan 2026 ([G2](https://www.g2.com/products/robin-2025-07-08/pricing)) | n/a | n/a | n/a | n/a | n/a |
| **Hebbia** | Lite ~$3K/user/yr; Pro ~$10K/user/yr ([Hebbia / Sacra](https://sacra.com/c/hebbia/)) | Hedge funds + AmLaw 50 M&A | No | SaaS, enterprise contract | 6–12 wk | Firms outside complex M&A/PE |
| **Legora (Leya)** | $3,000/user/yr, 10-seat min ($30K floor) ([Doolpa](https://doolpa.com/article/legora)) | EU + US mid-large | No | SaaS, EU data residency | 2–4 wk | Sub-10 seat practices |
| **EvenUp** | Per-demand; one client pays $4M/yr ([Fortune](https://fortune.com/2025/10/07/exclusive-evenup-raises-150-million-series-e-at-2-billion-valuation-as-ai-reshapes-personal-injury-law/)) | High-volume PI plaintiff | No | SaaS | 2–6 wk | Defense, non-PI |
| **Filevine AI** | Custom — bundled into PM platform ([Filevine](https://www.filevine.com/pricing/)) | Mid-market litigation | No | SaaS | 4–8 wk | Firms wanting standalone AI w/o swapping PM |
| **Lex Machina (LexisNexis)** | Bundled w/ Lexis+ Protégé, est. $500–$1,000+/user/mo ([Elephas](https://elephas.app/resources/legal-ai-tools-pricing-comparison)) | BigLaw + corporate | No | SaaS | 2–4 wk | Small/solo |
| **Clio Duo** | $39/user/mo on top of Clio Manage $49–$149 ([Lawyerist](https://lawyerist.com/reviews/artificial-intelligence-in-law-firms/clio-duo-review-artificial-intelligence-for-lawyers/)) | Solo + small (<50) | No | SaaS | <1 day | Mid-market depth — shallow features |
| **MyCase IQ** | $79–$99/user/mo (Pro/Advanced tier) ([Purple Blog](https://purple.law/blog/mycase-pricing-analysis/)) | Solo + small | No | SaaS | <1 day | Mid-market depth |
| **PracticePanther AI** | $49–$89/user/mo ([Capterra](https://www.capterra.com/p/115613/MyCase/pricing/)) | Solo + small | No | SaaS | <1 day | Mid-market depth |
| **Smokeball** | $49–$89/user/mo, Grow/Prosper+ custom ([Capterra](https://www.capterra.com/p/133656/Smokeball/pricing/)) | Solo + small | No | SaaS | <1 day | Mid-market depth |
| **Ironclad (CLM)** | $50K–$120K/yr mid-market ([Vendr](https://www.vendr.com/marketplace/ironclad), [Hyperstart](https://www.hyperstart.com/blog/ironclad-pricing/)) | In-house counsel | No | SaaS | 8–16 wk | Outside counsel workflow; law firms |
| **LinkSquares (CLM)** | $45K–$110K/yr ([Hyperstart](https://www.hyperstart.com/blog/ironclad-vs-linksquares/)) | In-house counsel | No | SaaS | 8–12 wk | Same — in-house only |
| **ContractPodAI (Leah)** | ~$50K/yr starting ([G2](https://www.g2.com/products/contractpodai/pricing)) | In-house counsel | No | SaaS | 8–16 wk | Outside counsel |

**Self-host scorecard for our target tier: 0 of 16.** OpenSpecter and a few OSS projects exist ([OpenSpecter](https://www.openspecter.com/)) but no commercial-grade legal-AI vendor with privilege controls ships an on-prem SKU.

## 3. Mid-Market Gap Evidence

1. **Harvey's 25-seat floor literally excludes 99% of US firms.** "There are roughly 450,000 law firms in the United States. Maybe 2,000–3,000 can afford Harvey. That leaves 99% of the market underserved." ([The Law GPT](https://www.thelawgpt.com/blog/harvey-ai-alternatives-solo-lawyers-small-firms))
2. **Reddit r/LawFirm**, on Harvey: "crazy pricing/demo model… requires 30 lawyers before a demo… never got a straight answer on price." ([Law GPT summarizing r/LawFirm thread](https://www.thelawgpt.com/blog/harvey-ai-alternatives-solo-lawyers-small-firms))
3. **Law360 Pulse (Jan 2026)**: "Law firms exploring legal AI tools want flexible contract terms, but some vendors are pushing firmwide licenses tied to multiyear commitments." ([Law360](https://www.law360.com/pulse/articles/2387366/law-firms-push-back-on-ai-vendors-all-or-nothing-pricing))
4. **Above the Law (Mar 2026)**: Two firms of equal size on the same legal-AI platform can see 40–50% price differential, indicating non-transparent enterprise pricing optimized against BigLaw budgets. ([Above the Law](https://abovethelaw.com/2026/03/why-your-competitor-pays-half-what-you-do-decoding-legal-research-ai-pricing/))
5. **Math doesn't work for sub-50 firms**: "$720K+ on a $10–20M revenue firm" — Harvey's price is structurally incompatible with mid-market P&L. ([Irys analysis](https://www.irys.ai/blog/real-decision-harvey-legora-claude-irys))

## 4. ABA / State Bar Regulatory Hooks Our DLP Can Cite

| Authority | Rule | What our gateway can prove |
|---|---|---|
| **ABA Formal Op. 512 (Jul 2024)** | Model Rule 1.6 confidentiality — lawyers "responsible for knowing how GAI uses data… secure clients' informed consent before using client confidences"; boilerplate engagement-letter consent insufficient ([ABA](https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/)) | Self-host = no third-party disclosure to start with; per-matter consent log via audit trail |
| **ABA 512** | Competence (Rule 1.1) — lawyers must understand GAI limits ([UNC Law Library](https://library.law.unc.edu/2025/02/aba-formal-opinion-512-the-paradigm-for-generative-ai-in-legal-practice/)) | Citation grounding + provenance per response |
| **ABA 512** | Fees (Rule 1.5) — cannot bill clients for learning generic AI ([ABA Business Law Today](https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-october/aba-ethics-opinion-generative-ai-offers-useful-framework/)) | Per-matter usage metering for write-off vs bill |
| **Florida Bar Op. 24-1** | Informed consent before any 3rd-party GAI touches client info ([Clearbrief](https://clearbrief.com/legal-ai-resources/florida)) | DLP block on outbound until consent flag set |
| **NYSBA Task Force (2024)** | RPC 1.6 violated via "direct, indirect, API, or plugin" disclosure ([NYSBA via NatLawReview](https://natlawreview.com/article/ny-state-bar-association-joins-florida-and-california-ai-ethics-guidance-suggests)) | Outbound egress controls per route, not just app |
| **California (RPC 1.6 + guidance)** | Treats AI under existing competence/confidentiality rules ([Clio summary](https://www.clio.com/blog/ai-ethics-opinion/)) | Tenant-level policy engine maps to firm rules |
| **US v. Heppner, SDNY (Feb 17, 2026)** | Prompts to consumer Claude = no privilege, no work product, and may waive privilege over the original communications ([Gibson Dunn](https://www.gibsondunn.com/ai-privilege-waivers-sdny-rules-against-privilege-protection-for-consumer-ai-outputs/), [NYSBA](https://nysba.org/loose-ai-prompts-sink-ships-how-heppner-shook-the-legal-community/)) | Self-host + zero retention + closed-network deployment = the affirmative defense pattern Rakoff flagged |
| **California SB 574 (passed Senate Jan 30, 2026)** | Pending restrictions on attorney GAI use ([Inside Privacy](https://www.insideprivacy.com/artificial-intelligence/ai-and-legal-privilege-key-takeaways-from-us-v-heppner/)) | Policy hooks for jurisdiction-specific blocks |
| **UK Sec. State for Home Dep't (2026)** | UK court: open-source AI use may waive legal professional privilege ([Norton Rose](https://www.nortonrosefulbright.com/en/inside-disputes/blog/202604-court-guidance-that-use-of-open-source-ai-waives-confidentiality-and-legal-professional)) | Distinguishes self-hosted closed-network from public OSS endpoints — our exact deployment |

## 5. Pricing Anchors — What Mid-Market Firms Actually Pay

- **Practice-management base**: Clio Manage $49–$149/seat/mo; MyCase $39–$119/seat/mo; PracticePanther $49–$89; Smokeball $49–$89 ([Purple Blog](https://purple.law/blog/clio-vs-mycase-vs-smokeball/))
- **AI add-on on top of PM**: Clio Duo $39/seat/mo; MyCase IQ $79–$99/seat/mo
- **Westlaw + CoCounsel bundle**: $400–$500+/seat/mo
- **Industry survey**: mid-market firms spending $50–$350/attorney/month on AI tools ([Elephas](https://elephas.app/resources/legal-ai-tools-pricing-comparison))
- **Stated mid-market AI band**: Bloomberg Law / industry reports cite ~30% lift on existing research/tech budget for AI ([LlamaLab](https://www.llamalab.ai/blog/legal-tech-spending-surges-2026-ai-adoption))

**Our $4,000/yr/seat = $333/seat/mo.** This lands at the top of the mid-market AI add-on band, well below Harvey ($14,400+) and Hebbia ($10K), and roughly on par with CoCounsel+Westlaw bundle — but with self-host and OSS escape hatch they cannot match.

## 6. Three Changes to Roadmap / Pitch

1. **Lead the pitch with *Heppner*, not features.** Every mid-market GC has either read the SDNY ruling or had it forwarded by their malpractice carrier. The pitch is: "After *Heppner*, prompts to SaaS LLMs are a privilege-waiver risk. We are the only vendor that runs inside your VPC, retains nothing, and produces a per-matter audit log that maps to ABA Op. 512 and Florida Op. 24-1." Build a one-page *Heppner* compliance brief signed by outside ethics counsel and put it on the landing page. Cite [Gibson Dunn](https://www.gibsondunn.com/ai-privilege-waivers-sdny-rules-against-privilege-protection-for-consumer-ai-outputs/) and [NYSBA](https://nysba.org/loose-ai-prompts-sink-ships-how-heppner-shook-the-legal-community/) directly.

2. **Reposition the SKU as a "Clio Duo replacement for firms that outgrew it" — not as a Harvey competitor.** Harvey punches down with marketing FUD; we lose that fight. Clio Duo's $39/seat is shallow document-summary AI ([Lawyerist review](https://lawyerist.com/reviews/artificial-intelligence-in-law-firms/clio-duo-review-artificial-intelligence-for-lawyers/)). Frame: "Clio Duo for the first 25 attorneys. When matter complexity outgrows it, attach our gateway to your existing PM at $333/seat — without rebuilding on Westlaw." This positions us as additive to the buyer's existing stack (Clio/MyCase/Smokeball), not a rip-and-replace.

3. **Ship a DLP rule pack that names each authority in plain text on the rule.** Not "PII detection" — instead: `aba_op_512_unconsented_client_data`, `fl_op_24_1_third_party_disclosure`, `nysba_rpc_1_6_api_egress`, `heppner_consumer_llm_block`. Compliance officers buy on language they already know. The rule pack ships in the OSS distribution; the commercial license unlocks the SOC-2-aligned audit log, jurisdiction-aware routing, and the firm-wide policy editor. This makes the AGPL → commercial upgrade legible to a non-engineer managing partner. Source rules in: [ABA Op. 512](https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/), [FL Op. 24-1](https://clearbrief.com/legal-ai-resources/florida), [NYSBA Task Force Report](https://natlawreview.com/article/ny-state-bar-association-joins-florida-and-california-ai-ethics-guidance-suggests), [Heppner](https://harvardlawreview.org/blog/2026/03/united-states-v-heppner/).

---

**Word count**: ~1,420.
