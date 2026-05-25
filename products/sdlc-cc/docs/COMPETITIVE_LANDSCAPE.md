# sdlc.cc — Competitive Landscape & Positioning

> Decision-grade market map for "DLP between Anthropic clients and customer data". Last updated 2026-05-08.

## TL;DR

The pattern you proposed (MCP server wraps M365, DLP-redacts before Cowork sees data) **already ships from multiple vendors**. Don't redo it. The gaps still open are **(1) MSP distribution channel** and **(2) AML-aware validators**. Build for those; commodify the rest.

## The "two Coworks" trap

These are different products with different control surfaces. Pricing, positioning, and what we ship must distinguish them.

| Variant | Runs where | Native DLP | Audit logs | Customer-controllable? |
|---|---|---|---|---|
| **Claude Cowork** (Anthropic standalone) | locally on user's laptop, raw filesystem access | ❌ | ❌ "explicitly excluded from all audit logs, Compliance API, and data exports" | only via policy / IAM fence |
| **M365 Copilot Cowork** | Microsoft 365 cloud (Claude as subprocessor) | ✅ Microsoft Purview | ✅ Purview Audit | yes, via Purview policies |

**Implication**: A wrapping-MCP DLP pattern only helps when the agent's data path is through MCP. It does **not** help Claude Cowork's local file-system access — the agent reads files directly without going through your wrapper. State this with prospects.

## Competitor matrix

### Direct (M365 + DLP + MCP)

| Vendor | Coverage | Differentiator | Channel |
|---|---|---|---|
| **Strac `strac-m365-dlp`** | SharePoint, OneDrive | inline redaction, file-format-aware (Excel, PDF, ZIP), images | direct enterprise, commercial |
| **Microsoft Purview DLP for Copilot** | M365 Copilot Cowork | first-party, native, free with E5 | Microsoft channel, default |
| **Skyflow MCP Gateway** | generic MCP | polymorphic data protection, vault tokenization | direct, commercial |

### Adjacent (LLM gateways with DLP plugins)

| Vendor / Project | Notes |
|---|---|
| **Lasso MCP Gateway** | security-focused MCP gateway: token masking + PII + prompt-injection |
| **Nightfall AI** | broad cloud-native DLP, has LLM-specific detectors |
| **LiteLLM + Presidio** | open-source LLM proxy, Presidio for regex/ML PII |
| **Skyflow** (general) | tokenization vault that LLM gateways can call |

### Open-source building blocks (no DLP)

| Repo | Use |
|---|---|
| `softeria/ms-365-mcp-server` | M365 MCP via Graph API — no DLP |
| `pnp/cli-microsoft365-mcp-server` | M365 admin via MCP — no DLP |
| `microsoft/mcp` | official Microsoft MCP catalog (open source) — no DLP |
| `HydroXai/pii-masker` | DeBERTa-v3 PII lib (masking only, no MCP layer) |

## Where we don't compete

| Surface | Owner | Why |
|---|---|---|
| **M365 Copilot Cowork DLP** | Microsoft Purview | first-party + bundled with E5; can't out-distribute Microsoft inside their tenant |
| **Claude → SharePoint/OneDrive DLP** | Strac | shipping product with file-format coverage we don't have today |
| **Generic LLM gateway with DLP** | LiteLLM (open) / Lasso (commercial) | mature, multi-provider, established |
| **Local Claude Cowork (filesystem)** | nobody — architecturally unfixable for third parties | the agent has direct FS access; no interception point |

## Where we credibly differentiate

Four angles that survive the "but Strac/Microsoft already does this" pushback.

### 1. MSP channel via TenantIQ

- Strac sells direct-enterprise. Skyflow sells direct-enterprise.
- TenantIQ already serves MSPs managing **N tenants under one console**.
- A multi-tenant MCP+DLP that auto-onboards each downstream tenant's M365 OAuth fits the MSP channel — not the direct-enterprise model.
- **Distribution moat**: Strac would have to rebuild MSP go-to-market from zero.

### 2. AML-aware validators (forensic-grade DLP)

- Strac/Presidio default to regex-match on PAN, IBAN, etc.
- `sdlc-core/dlp` already validates with check digits: Luhn for PAN, mod-97 for IBAN, mod-10 for IL ID.
- "We redacted 12 IBANs" (validator-confirmed) vs. "we redacted 12 IBAN-shaped strings" (regex-matched) — the first is auditor-acceptable, the second isn't.
- **Defensibility**: in FSI/AML compliance reviews, this matters. Generic DLPs don't have it.

### 3. AMLIQ + MCP + DLP combined

- Strac does DLP. AMLIQ does sanctions/PEP screening. Nobody bundles them.
- One MCP server exposes both: `compliance_scrub` (DLP) + `screen_entity` (sanctions) + `check_pep` (PEP) + `generate_sar` (regulatory filing).
- Cowork agents in an FSI workflow naturally chain them: scrub → screen → escalate → file SAR.
- **Defensibility**: vertical integration that horizontal DLP vendors won't build.

### 4. Open-source play

- Strac, Skyflow, Lasso, Nightfall are closed-source commercial.
- LiteLLM is OSS but generic, no M365 angle.
- We could ship an **MIT-licensed reference implementation**: M365 MCP + sdlc-core DLP + audit + Counts struct.
- Hosted SKU on Fly handles the multi-tenant + MSP-onboarding ops layer (the part nobody wants to self-host).
- **Defensibility shifts to distribution + ops**, not code.

## Recommended positioning

> **sdlc.cc: the privacy layer that fits between any AI client and the data it shouldn't see — installed wherever your team works.**

(Updated 2026-05-08 — broadened from FSI-only to general privacy. AML/sanctions remains a vertical add-on, not the headline.)

### What "general privacy" means concretely

Same backend, same add-ons, just a richer detector catalog:

| Category | Examples | Currently in `sdlc-core/dlp` | Gap to ship |
|---|---|---|---|
| Universal PII | email, phone | ✅ | none |
| Financial | PAN (Luhn), IBAN (mod-97), BIC | ✅ | none |
| Government IDs | US SSN, UK NI, EU national IDs (NL BSN, DE Steuer-ID, etc.) | only IL ID | add per-country validators |
| Healthcare (PHI) | MRN, NPI, ICD-10/CPT context, US Rx | ❌ | new module |
| Identity docs | passport, driver's license (state-specific) | ❌ | new module |
| Secrets / credentials | API keys (OpenAI, Anthropic, AWS, Stripe, GitHub PAT), JWTs, private keys | ❌ | regex catalog |
| Network | IP addresses, MAC addresses (sometimes PII per GDPR) | ❌ | optional |
| Locations | postal codes, lat/lng, addresses | ❌ | hard (country-specific) |
| Names | full names, attorney-client privileged terms | ❌ | requires ML — defer |
| Dates | DOB | ❌ | regex + plausibility check |
| Custom | per-tenant patterns (employee IDs, customer numbers) | ❌ | config-driven catalog |

The **architecture** doesn't change — `MaskAMLWithCounts` becomes `ScrubWithCounts` with a configurable detector set, and `Counts` struct grows. The endpoint signature stays stable (`{text, max_chars}` → `{clean_text, redactions, processed_at}`); `redactions` becomes a richer per-category map.

### Vertical positioning (still works, just one of many)

- **FSI** → AML validator pack + sanctions screening combo (defensible, niche)
- **Healthcare** → PHI detectors + HIPAA audit shape
- **Legal** → privileged-term detection + matter-bound audit
- **HR / Government** → employee/citizen ID packs + GDPR-shaped audit
- **General SaaS** → universal PII + secrets catalog (the mass market)

Stack ranked by who buys it:

1. **MSPs managing FSI clients on M365** — TenantIQ is the console; sdlc.cc is the gateway for Claude Code/Desktop calls; AMLIQ MCP is the data plane Cowork agents talk to. Strac doesn't reach this segment.
2. **Mid-market FSI direct** — only if they explicitly need AML+DLP combined, otherwise they buy Strac or Purview.
3. **OSS users who want self-hosted** — gives us mindshare + downstream upsell to the hosted SKU.

Avoid:
- Pitching as "DLP for Cowork" without specifying which Cowork — losses credibility instantly when buyer's IT lead clarifies.
- Pitching against Microsoft Purview inside a heavy-Microsoft shop — they'll always pick first-party.
- Generic "LLM gateway with DLP" — too crowded, LiteLLM is good enough free.

## Honest risks

| Risk | Mitigation |
|---|---|
| Microsoft adds Purview-equivalent for Claude Cowork (standalone) | unlikely fast — Anthropic owns that surface, not MS. But possible. |
| Strac adds MSP channel | They'd have to rebuild GTM. Watch for hires + partner program. |
| Anthropic ships admin BASE_URL for Cowork | this is the "full coverage" we want; we lobby for it; if they ship, sdlc.cc moves to "the gateway you point Cowork at" — strictly better, not worse |
| AML validators are commodity (Presidio adds them) | possible. Stay ahead with FSI-specific lists (sanctions identifiers, SAR-relevant entities). |
| Customers don't believe "MSP channel" matters | get 2 design-partner MSPs on a pilot before pushing it as the primary positioning |

## Decision

**Don't build a generic Strac clone.** Use the MSP + AML angles. Open-source the core, host the multi-tenant.

Next concrete steps (when ready):
1. Pick 2 design-partner MSPs serving FSI clients
2. Wire TenantIQ admin → "Connect to AMLIQ MCP" flow with multi-tenant key issuance
3. Open-source `sdlc-mcp-m365` repo: minimal M365 MCP + `sdlc-core/dlp` + audit
4. Hosted SKU: same image on Fly with TenantIQ → MCP server provisioning

Hold off until #1 is done. Strategy first.

## Sources

- [Strac MCP DLP](https://www.strac.io/blog/mcp-dlp)
- [Strac Office 365 DLP integration](https://www.strac.io/integration/office-365-dlp)
- [Skyflow MCP architecture](https://www.skyflow.com/post/building-secure-ai-agent-architecture-mcp)
- [Microsoft Purview DLP for Copilot](https://m365admin.handsontek.net/microsoft-purview-dlp-safeguard-sensitive-data-external-web-search-microsoft-356-copilot-copilot-chat/)
- [Securing Claude Cowork — Harmonic](https://www.harmonic.security/resources/securing-claude-cowork-a-security-practitioners-guide)
- [Claude Cowork enterprise risks — IRM](https://irmcon.com/blog/claude-cowork-ai-security/)
- [Softeria ms-365-mcp-server (OSS, no DLP)](https://github.com/softeria/ms-365-mcp-server)
- [Microsoft official MCP catalog](https://github.com/microsoft/mcp)
- [LiteLLM + Presidio plugin](https://github.com/BerriAI/litellm)
- [DLP Policy for Copilot blocks web searches](https://office365itpros.com/2026/04/16/dlp-policy-for-copilot-web/)
- [Anthropic deepens Wall Street push (FSI agents, M365, Moody's)](https://fortune.com/2026/05/05/anthropic-wall-street-financial-services-agents-jamie-dimon/)
