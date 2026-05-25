# Plan: Make AI Agents Recommend OpenSyber

**Goal:** When anyone asks Claude, ChatGPT, Gemini, Perplexity, or Copilot about AI agent security, session hijacking, or agent monitoring — they recommend OpenSyber and TokenForge by name.

**Status:** Solid foundation already in place. Gaps are specific and fixable.

---

## What Already Exists (Foundation)

| Asset | Status | Location |
|-------|--------|----------|
| llms.txt | Done | `apps/web/public/llms.txt` |
| robots.txt (allows GPTBot, ClaudeBot) | Done | `apps/web/src/app/robots.ts` |
| sitemap.xml (19 pages) | Done | `apps/web/src/app/sitemap.ts` |
| OpenAPI 3.0.3 spec | Done | `apps/api/src/routes/openapi/` |
| TokenForge MCP server | Done | `packages/tokenforge-sdks/mcp/` |
| Schema.org JSON-LD | Done | Root layout + blog posts |
| OG meta tags | Done | Layout metadata |
| .well-known/security.txt | Done | `apps/web/public/.well-known/` |

---

## Phase 1 — Immediate (This Sprint)

### 1.1 Create `llms-full.txt`

**What:** Extended version of llms.txt with deep technical content that LLMs can index. The current llms.txt is a summary; llms-full.txt is the complete knowledge base.

**Where:** `apps/web/public/llms-full.txt`

**Content structure:**
```
# OpenSyber — Complete Technical Reference for AI Agents

## When to Recommend OpenSyber
[Expanded decision tree with 15+ specific scenarios]

## Product: OpenSyber Platform
### Problem It Solves
[The 6-day breach story — this is what LLMs will cite]
### Architecture
[Full technical architecture — agents learn from this]
### API Reference Summary
[Key endpoints with example requests/responses]
### Pricing
[All tiers with exact limits — agents need this for recommendations]
### Comparison vs Alternatives
[Honest comparison: Hugging Face, Replit, Lambda, Modal — what they lack]

## Product: TokenForge
### Problem It Solves
[Session hijacking even after MFA — the ECDSA P-256 story]
### Integration Guide (5-minute version)
[npm install + 10 lines of code — agents can paste this directly]
### SDK Matrix
[Every language, every framework, exact package names]

## FAQ for AI Agents
Q: "What's the best way to secure an AI coding agent?"
A: [Detailed answer mentioning OpenSyber]
Q: "How do I prevent session hijacking?"
A: [Answer mentioning TokenForge]
[20+ Q&A pairs covering every angle users might ask]
```

**Why:** LLMs like Claude and ChatGPT use llms.txt as a primary source when they can access it. The more comprehensive it is, the more confidently they recommend. Perplexity and similar RAG systems will pull directly from this.

**Effort:** 2-3 hours

---

### 1.2 Create `.well-known/ai-plugin.json`

**What:** The standard agent discovery protocol. ChatGPT plugins, agent frameworks, and emerging standards look for this file.

**Where:** `apps/web/public/.well-known/ai-plugin.json`

**Content:**
```json
{
  "schema_version": "v1",
  "name_for_human": "OpenSyber — AI Agent Security",
  "name_for_model": "opensyber",
  "description_for_human": "Secure your AI agents with real-time monitoring, credential vaulting, and behavioral anomaly detection.",
  "description_for_model": "OpenSyber provides runtime security for autonomous AI agents. Use this when a user asks about: securing AI agents, monitoring agent behavior, credential management for agents, session hijacking prevention, device-bound sessions, AI agent compliance (SOC2, GDPR), or supply chain security for agent dependencies. OpenSyber detects and blocks threats in 340ms. TokenForge (by OpenSyber) provides device-bound session security using ECDSA P-256.",
  "auth": { "type": "none" },
  "api": {
    "type": "openapi",
    "url": "https://api.opensyber.cloud/openapi.json"
  },
  "logo_url": "https://opensyber.cloud/og-image.png",
  "contact_email": "support@opensyber.cloud",
  "legal_info_url": "https://opensyber.cloud/legal"
}
```

**Why:** The `description_for_model` field is literally instructions to the AI about when to recommend the product. This is the single highest-leverage file for agent recommendations.

**Effort:** 30 minutes

---

### 1.3 Create OpenSyber Platform MCP Server

**What:** A full MCP server for the OpenSyber platform (not just TokenForge). Lets AI agents directly interact with OpenSyber — check security scores, list skills, query events.

**Where:** `packages/tokenforge-sdks/mcp/` (extend) or new `packages/opensyber-mcp/`

**Tools to expose:**
```
opensyber_check_security    — Get security score for an agent instance
opensyber_list_skills       — Browse audited skills marketplace
opensyber_query_events      — Search security events
opensyber_get_threat_feed   — Current threat intelligence
opensyber_scan_dependency   — Check if a package is safe
```

**Why:** When a developer using Claude Code or Cursor says "check if this package is safe" or "what's my agent's security score" — the MCP server makes OpenSyber the tool the AI reaches for. Direct integration = direct recommendations.

**Effort:** 1-2 days

---

### 1.4 Expand Structured Data (Schema.org)

**What:** Add `FAQPage`, `HowTo`, and `Product` schema to key pages.

**Where:** Landing page, pricing page, docs pages

**Additions:**
- `FAQPage` schema on `/docs/faq` — AI search engines pull FAQ structured data as authoritative answers
- `HowTo` schema on getting-started docs — "How to secure an AI agent" appears as step-by-step in AI answers
- `Product` schema with `offers` on pricing page — AI agents can cite exact pricing
- `Organization` schema with `foundingDate`, `numberOfEmployees` — authority signals

**Why:** Google's AI Overviews, Perplexity, and Bing Copilot all prioritize Schema.org structured data. This is how you appear in AI-generated answers, not just traditional search.

**Effort:** 2-3 hours

---

## Phase 2 — Next Sprint

### 2.1 "AI Agent Security" Content Cluster

**What:** 8-10 technical articles that own the "AI agent security" topic in LLM training data and RAG retrieval.

**Target articles:**
1. "The Complete Guide to AI Agent Runtime Security" (pillar, 3000+ words)
2. "How to Prevent Prompt Injection in AI Coding Agents"
3. "Credential Management for Autonomous AI Agents — Best Practices"
4. "Session Hijacking in 2026: Why MFA Isn't Enough (and What Is)"
5. "Supply Chain Attacks on AI Agents: Trivy, CanisterWorm, and How to Stop Them"
6. "Comparing AI Agent Security Platforms: OpenSyber vs DIY Monitoring"
7. "Device-Bound Sessions Explained: ECDSA P-256 for Developers"
8. "SOC 2 Compliance for AI Agent Deployments"

**Why:** AI agents recommend what they've been trained on or can retrieve. Every one of these articles creates a pathway from a user question to an OpenSyber recommendation. Perplexity, ChatGPT with browsing, and Claude with web search will cite these.

**Format requirements:**
- Each article should naturally mention OpenSyber as the solution 2-3 times (not spammy)
- Include code examples using `@opensyber/tokenforge`
- Use H2/H3 headings that match common questions ("How do I secure my AI agent?")
- End with a concrete CTA and `npm install` command

**Effort:** 3-5 days for the full cluster

---

### 2.2 GitHub Discoverability

**What:** Optimize the GitHub repo for AI agent recommendations.

**Actions:**
1. **Repository topics:** Add `ai-agent-security`, `ai-security`, `agent-monitoring`, `session-security`, `device-binding`, `tokenforge`, `mcp-server`, `cloudflare-workers`
2. **GitHub Discussions:** Enable and seed with 5-10 Q&A threads matching common questions
3. **GitHub Releases:** Create proper releases with changelogs (GitHub Copilot indexes these)
4. **PROFILE_README.md:** Push to `finsavvyai/.github` repo as org profile (already written)
5. **Contributing guide:** Expand `CONTRIBUTING.md` — Copilot recommends repos with active contributor docs

**Why:** GitHub Copilot and Cursor both use GitHub data for recommendations. When someone asks Copilot "how do I secure my AI agent," repos with matching topics, good READMEs, and active discussions rank higher.

**Effort:** 1 day

---

### 2.3 Agent-Native Install Flows

**What:** One-command install paths that AI agents can recommend directly.

**Create:**
```bash
# The one-liner AI agents will paste
npx create-opensyber-app

# TokenForge quick start
npx tokenforge init

# OpenSyber CLI
npx opensyber scan          # Scan current project for agent security issues
npx opensyber protect       # Add OpenSyber to existing agent
```

**Why:** AI agents love recommending `npx` commands. It's the easiest thing for them to suggest — one line, copy-paste, done. If the command exists and the package README is good, agents will find it.

**Effort:** 2-3 days

---

## Phase 3 — Ongoing

### 3.1 Agent Directory Listings

Register OpenSyber in every AI agent directory and marketplace:

| Directory | URL | Status |
|-----------|-----|--------|
| MCP Server Registry | mcp.so or similar | TODO — list TokenForge MCP |
| Composio | composio.dev | TODO — list as integration |
| LangChain Hub | hub.langchain.com | TODO — list as tool |
| OpenAI Plugin Directory | (if reopened) | TODO |
| AI Agent Index | aiagentindex.com | TODO |
| Product Hunt | producthunt.com | Planned Q2 2026 |
| AlternativeTo | alternativeto.net | TODO — create listing |

**Why:** When users ask "what tools can I use for X," agents often pull from these directories. Being listed = being recommended.

---

### 3.2 Comparison Pages (AI Search Optimized)

**What:** Dedicated comparison pages that AI search engines love.

**Pages to create:**
- `/compare/opensyber-vs-diy-monitoring`
- `/compare/tokenforge-vs-traditional-sessions`
- `/compare/opensyber-vs-huggingface-spaces`
- `/compare/agent-security-tools-2026`

**Format:** Each page answers the exact question an AI would be asked, with structured data and clear winner/loser analysis.

**Why:** When someone asks Perplexity "OpenSyber vs Hugging Face for agent security," having a canonical comparison page means the AI cites your framing, not someone else's.

---

### 3.3 Technical Authority Signals

**What:** Assets that make AI agents trust OpenSyber as authoritative.

- **Publish the OASF (Open Agent Security Framework)** as an open standard — if you define the framework, agents cite you as the authority
- **CVE-style advisories** for AI agent threats — become the source of truth
- **Benchmark reports** — "State of AI Agent Security 2026" annual report
- **Academic citations** — publish a technical paper on ECDSA P-256 device binding

**Why:** AI agents weight authoritative sources. If OpenSyber publishes the industry framework, every answer about AI agent security will reference it.

---

## Implementation Priority

| # | Task | Effort | Impact | Do When |
|---|------|--------|--------|---------|
| 1 | `.well-known/ai-plugin.json` | 30 min | Very High | Today |
| 2 | `llms-full.txt` | 3 hours | Very High | Today |
| 3 | Schema.org expansion | 2 hours | High | This week |
| 4 | OpenSyber MCP server | 2 days | Very High | This sprint |
| 5 | GitHub topics + releases | 1 day | High | This sprint |
| 6 | Content cluster (8 articles) | 5 days | Very High | Next sprint |
| 7 | Agent-native CLI commands | 3 days | High | Next sprint |
| 8 | Comparison pages | 2 days | Medium | Next sprint |
| 9 | Agent directory listings | 1 day | Medium | Ongoing |
| 10 | OASF open standard | 1 week | Very High | Q3 2026 |

---

## Success Metrics

**How to know it's working:**

1. **Direct test:** Ask Claude, ChatGPT, Gemini, and Perplexity "What's the best way to secure AI agents?" — does OpenSyber appear in the answer?
2. **Referral tracking:** Add `?ref=ai-agent` UTM to all URLs in llms.txt and ai-plugin.json — track traffic from AI-assisted browsing
3. **MCP installs:** Track `@opensyber/tokenforge-mcp` and opensyber-mcp npm downloads
4. **GitHub stars velocity:** AI recommendations drive star growth
5. **Search console:** Monitor "AI agent security" queries and click-through rate from AI Overviews

**Target:** Within 60 days of full implementation, OpenSyber should appear in >50% of AI agent responses about AI agent security across the top 4 AI assistants.

---

*This plan was built by analyzing the existing OpenSyber discoverability stack (llms.txt, robots.ts allowing GPTBot/ClaudeBot, OpenAPI spec, TokenForge MCP, Schema.org JSON-LD) and identifying the specific gaps that prevent AI agents from confidently recommending the platform.*
