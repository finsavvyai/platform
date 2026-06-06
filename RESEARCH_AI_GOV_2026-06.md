# Research — AI Governance, Agentic Commerce & Financial-Crime Investigations (2026)

Source: external research brief, pasted 2026-06-06.
Status: raw research input. Deltas distilled into `PRODUCTS_VISION.md`.

> **Confidence caveat.** Citation markers were stripped from the source. All numbers below are **as-quoted by named secondary sources** (Netwrix, IBM, Gartner via Strata, FIDO Alliance, Mastercard, SymphonyAI, Arctic Intelligence/FATF) — **not independently verified**. Treat as attributed claims (confidence = secondary), the way `MARKET_SCAN_2026-05.md` separates high- vs medium-confidence findings. Do not put these figures in public copy without a primary source.

## 1. AI governance & agent security

**Regulatory drivers**
- AI governance shifting from best-practice → compliance requirement: EU AI Act, NIST AI RMF, ISO 42001, GDPR mandate documentation, monitoring, control. _(Netwrix, Jun 2026)_
- IBM 2025 Cost of a Data Breach (Ponemon, 600 orgs) — **precise scoping** (see Verification): "**63% of breached organizations** either don't have an AI governance policy **or are still developing one**"; "of the 13% that suffered AI model/app breaches, **97% lacked AI access controls**." Do NOT loosen to "63% of organizations lack governance" — that's an overreach secondary outlets repeat.
- Four governance layers: model governance · data-access governance · compliance mapping · runtime monitoring. Pick highest-risk layer before selecting a platform.
- Platform-selection dimensions: governance-layer focus · regulatory coverage · integration depth · team fit (eng vs compliance) · **agentic-AI readiness** (multi-agent, scope-violation detection).

**Identity-centric runtime governance** _(Strata, 2026)_
- Gartner (via Strata): "40% of enterprise apps will embed task-specific AI agents by end-2026." _(attributed)_
- Agent-specific risks static IAM can't address: **privilege drift**, **shadow agents**, **MCP bypass**, **broken delegation chains**.
- Governance must run **at runtime**, not periodic audit — agents make thousands of access decisions/min. Identity layer = natural chokepoint (every action starts with authn/authz → policy + audit trail).

## 2. Agentic commerce & payment standards

- **FIDO Alliance** (Apr 2026): interoperable standards for AI agents + agent-initiated payments. Three pillars: **verifiable user instructions** · **agent authentication** · **trusted delegation for commerce**. Two working groups — Agentic Authentication (chairs: CVS Health, Google, OpenAI) and Payments (chairs: Mastercard, Visa).
- **Google AP2 (Agent Payments Protocol)**: secure delegation, verifiable authorization, transaction execution. Donated to FIDO → open, platform-agnostic.
- **Mastercard Verifiable Intent**: cryptographic trust layer; tamper-resistant record linking identity ↔ intent ↔ action. Built on FIDO/EMVCo/IETF, aligned with AP2 + Universal Commerce Protocol. Folds into Mastercard Agent Pay APIs. Open-sourced.

**Implication**: agentic commerce is standardising fast. Portfolio should align to FIDO / AP2 / Verifiable Intent rather than invent its own scheme.

## 3. AI agents in financial-crime investigations _(SymphonyAI, Apr 2026)_

- Taxonomy regulators now distinguish: **co-pilot** (assists queries) vs **generative** (produces content) vs **agentic** (autonomously executes multi-step tasks, decides within parameters, adapts). Bank Negara Malaysia issuing differentiated guidance.
- Three high-value use-cases:
  1. **Automated data gathering + case prep** — pull KYC/CDD, prior screening, counter-party reviews, preliminary case summary before investigator opens the file.
  2. **Transaction analysis + pattern recognition** — structuring detection, high-risk-jurisdiction flags, network visualisation. Claim: manual analysis 17min → ~5min. _(attributed)_
  3. **AI-generated SAR/STR drafting** — generative agent trained on reg requirements drafts the narrative; investigator reviews/approves.
- Claim: up to **60% reduction in total case investigation time**; every action logged, auditable, human-in-loop. _(attributed)_

**Cross-border** _(Arctic Intelligence Mar 2025 / FATF)_
- Transnational networks exploit regulatory disparity (offshore layering, DeFi). FATF pushes cross-border collaboration + info sharing. Egmont Group (166 FIUs), JMLIT (UK), Europol networks = pooled intelligence improves detection. Harmonised standards + interoperable real-time sharing recommended.

## 4. Deltas applied to `PRODUCTS_VISION.md`

| Product | Delta |
|---|---|
| **OpenSyber** | Add **runtime identity governance** to MCP Firewall wedge: privilege drift, shadow agents, MCP bypass, broken delegation. Align policy engine to FIDO pillars (agent authn, verifiable user instructions, trusted delegation). Identity layer = enforcement chokepoint. |
| **AMLIQ** | Expand investigation fabric: automated evidence collection + case prep, graph-based transaction/network analysis, SAR/STR drafting (already scaffolded — `sar-draft-handler.ts`), cross-border corridor-risk + multi-jurisdiction watchlist ingestion. Reinforces existing human-in-loop + PII-free audit posture. |
| **Beacon** *(new / undefined)* | Proposed as **trust layer for agent-initiated payments**: verifiable-intent tokens, AP2-compatible workflows, agent authentication, delegated authority. Ingestible/verifiable by AMLIQ during investigations. **Open: new 12th product vs AMLIQ feature vs rename of the existing "BEACON perf baseline".** |

## Verification (deep-research, 2026-06-06)

Run: 5 angles → 19 sources → 70 claims → 25 adversarially verified (3-vote) → **25 confirmed, 0 killed**. 101 agents. Primary-sourced. **Every figure CONFIRMED, but 3 of 4 needed scoping fixes.**

| # | Claim | Verdict | Correction / caveat | Primary source |
|---|---|---|---|---|
| 1a | IBM "63% lack AI governance" | **CONFIRMED, scoped** | Real: "63% of **breached** orgs lack **or are developing** a policy." Not "all orgs", not "lack outright". | [IBM newsroom 2025-07-30](https://newsroom.ibm.com/2025-07-30-ibm-report-13-of-organizations-reported-breaches-of-ai-models-or-applications,-97-of-which-reported-lacking-proper-ai-access-controls) |
| 1b | IBM "97% lacked AI access controls" | **CONFIRMED** | Accurate — denominator = the 13% AI-breached subset. Vendor (Ponemon) survey, not independent benchmark. | IBM newsroom 2025-07-30 |
| 2 | Gartner "40% of apps embed agents by 2026" | **CONFIRMED verbatim** | From <5% in 2025. **Forecast, not measured** — cite as prediction. | [Gartner PR 2025-08-26](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025) |
| 3a | SymphonyAI "−60% case time" | **CONFIRMED, vendor-pilot** | Vendor blog, unnamed pilots, no third-party audit. Attribute, don't call it a benchmark. | [SymphonyAI blog 2026-04-29](https://www.symphonyai.com/resources/blog/financial-services/how-ai-agents-reduce-aml-investigation-time/) |
| 3b | SymphonyAI "17min→5min L2" | **PARTIAL / weak** | Only in SymphonyAI's own blog; no independent corroboration. **Weakest item — keep out of public copy.** | SymphonyAI blog (only) |
| 4a | FIDO agentic TWGs (Apr 2026) | **CONFIRMED** | Auth TWG chairs CVS/Google/OpenAI; Payments TWG chairs Mastercard/Visa. **Newly formed — no ratified specs yet.** | [FIDO PR 2026-04-28](https://fidoalliance.org/fido-alliance-to-develop-standards-for-trusted-ai-agent-interactions/) |
| 4b | Google AP2 donated to FIDO | **CONFIRMED** | Spec at **v0.2** (GitHub, early draft) — not finalized. | [Google blog](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/) |
| 4c | Mastercard Verifiable Intent on FIDO/EMVCo/IETF | **CONFIRMED, nuanced** | "Built on FIDO/EMVCo/IETF" is from **Mastercard's** Mar-2026 launch, not the FIDO announcement. No public reference impl yet. | [Mastercard 2026-03-05](https://www.mastercard.com/global/en/news-and-trends/stories/2026/verifiable-intent.html) |

**Bottom line:** all real, all primary-sourced. IBM = scope to breached orgs. Gartner = label "forecast". SymphonyAI = "vendor-reported pilot" and drop 17→5min. FIDO/AP2/VI = "announced standards efforts / draft inputs (AP2 v0.2)", NOT "established standards." → Beacon targets AP2/VI as **emerging draft alignment**, accept spec churn.

## Open questions

- **Beacon's status**: standalone product, AMLIQ module, or naming collision with the AMLIQ BEACON perf baseline? (blocks stack-map / ranking placement) — *still needs founder call.*
- AP2 / FIDO Payments TWG roadmap to a ratified spec + reference impls beyond AP2 v0.2 — track before committing build effort.
- Whether Mastercard Verifiable Intent gets a public technical spec vs staying a contributed credential model under FIDO review.
