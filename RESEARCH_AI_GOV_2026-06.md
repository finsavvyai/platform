# Research — AI Governance, Agentic Commerce & Financial-Crime Investigations (2026)

Source: external research brief, pasted 2026-06-06.
Status: raw research input. Deltas distilled into `PRODUCTS_VISION.md`.

> **Confidence caveat.** Citation markers were stripped from the source. All numbers below are **as-quoted by named secondary sources** (Netwrix, IBM, Gartner via Strata, FIDO Alliance, Mastercard, SymphonyAI, Arctic Intelligence/FATF) — **not independently verified**. Treat as attributed claims (confidence = secondary), the way `MARKET_SCAN_2026-05.md` separates high- vs medium-confidence findings. Do not put these figures in public copy without a primary source.

## 1. AI governance & agent security

**Regulatory drivers**
- AI governance shifting from best-practice → compliance requirement: EU AI Act, NIST AI RMF, ISO 42001, GDPR mandate documentation, monitoring, control. _(Netwrix, Jun 2026)_
- "63% of orgs lack AI governance policies; 97% of those with AI-related incidents had inadequate access controls." _(IBM 2025 Cost of a Data Breach, via Netwrix — attributed)_
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

## Open questions

- Beacon's status: standalone product, AMLIQ module, or naming collision with the AMLIQ BEACON perf baseline? (blocks adding it cleanly to the stack map / ranking)
- None of the numeric claims are primary-sourced. A `deep-research` verification pass (like the market-scan addendum) would confirm/kill the 60% / 17→5min / 40%-by-2026 figures before they inform pricing or public copy.
- FIDO/AP2/Verifiable Intent are real consortium efforts — confirm current spec maturity + whether reference implementations exist before committing OpenSyber/Beacon to them.
