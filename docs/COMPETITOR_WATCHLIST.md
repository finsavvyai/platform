# Competitor Watchlist

*Ongoing tracking for the FinsavvyAI Platform thesis · last updated 2026-06-02 · sourcing in [`docs/MARKET_RESEARCH.md`](MARKET_RESEARCH.md)*

Confidence tags: **H** high · **M** medium · **L** low. Update the "Last move" column as news lands.

## Tier 1 — Strategic threats & likely acquirers

These are consolidating the exact layers the platform spans. Each is both a future competitor and a plausible acquirer.

| Player | Why they matter | Last move | Threat to | Conf |
|---|---|---|---|---|
| **Palo Alto Networks** | Building end-to-end "secure the AI" via Prisma AIRS by acquisition | Intent to acquire **Portkey** (AI gateway), Apr 30 2026; completed **Protect AI**, Jul 2025 | `ai-gateway`, `policy-engine` | H |
| **Check Point** | AI-security center of excellence | Acquired **Lakera** (~$300M, runtime guardrails/red-team), closed Nov 2025 | `policy-engine`, runtime guardrails | H |
| **Cisco** | AI Defense / security-for-AI | Acquired **Robust Intelligence** (model testing), closed late 2024 | `policy-engine`, `telemetry` | H |
| **Datadog** | APM incumbent w/ LLM Observability + Agent Monitoring; cross-sell startups can't match | Expanded LLM obs w/ agent monitoring + AI Agents Console, Jun 2025; 1,000+ obs customers | `telemetry` | H |
| **ClickHouse** | Data platform absorbing observability | Acquired **Langfuse** (OSS LLM obs), Jan 2026; $400M Series D | `telemetry` | H |

> **Note on Datadog's posture:** partner-and-compete — it's an *investor* in Arize, Braintrust, and LangChain while competing with them. Expect the same toward neutral control planes.

## Tier 2 — Layer-by-layer point competitors

### Gateway (`ai-gateway`) — *most commoditized; do not over-invest*
| Vendor | Model | Status | Conf |
|---|---|---|---|
| Portkey | OSS core + hosted control panel | Acquired by Palo Alto | H |
| OpenRouter | Model marketplace/router | $113M Series B at ~$1.3B, May 2026 | H |
| LiteLLM (BerriAI) | OSS proxy, 100+ providers | ~49k stars; only ~$1.6M seed | H |
| Cloudflare / Vercel / Kong | Bundled into edge/frontend/API platforms | Cloudflare free core; Vercel zero-markup; Kong "Agent Gateway" (MCP/A2A) | H |
| **Hyperscaler natives** | Bedrock Intelligent Prompt Routing, Azure Model Router, Vertex Model Garden | **The real commoditization threat** | H |

### Observability / replay (`telemetry`) — *converging into platforms*
| Vendor | Note | Conf |
|---|---|---|
| LangSmith | $125M Series B at $1.25B, Oct 2025 | H |
| Arize (Phoenix) | $70M Series C, Feb 2025; OSS Phoenix widely adopted | H |
| Braintrust | eval-first, "no seat tax" wedge; $80M Series B at $800M, Feb 2026 | H |
| Galileo / Laminar / AgentOps | eval-intelligence; agent debugging; time-travel replay | M |
| **Whitespace** | *Deterministic* execution replay remains unsolved | M |

### Policy / guardrails / AI-code governance (`policy-engine`) — *our most distinctive arena*
| Vendor | Angle | Status | Conf |
|---|---|---|---|
| Guardrails AI / NVIDIA NeMo | OSS I/O & dialogue guardrails | table-stakes, interoperable | H |
| Credo AI | enterprise GRC / AI governance | ~$41M; Gartner Market Guide 2025 | H |
| CodeRabbit | AI PR review, "quality gates for AI coding" | $60M Series B at $550M, Sep 2025 | H |
| Qodo | AI review + code **verification** | $70M Series B, Mar 2026 | H |
| Greptile / Graphite | full-codebase review; rule enforcement | Greptile ~$180M val; Graphite $52M (Anthropic-backed) | H/M |
| Semgrep / Snyk | "secure guardrails" for AI-gen code | Semgrep $100M Series D; Snyk AI Trust Platform | H |
| GitHub | Advanced Security split + Copilot Autofix | incumbent | H |

### Auth / agent identity (`auth`) — *enabler + emerging whitespace*
| Signal | Note | Conf |
|---|---|---|
| OWASP NHI Top 10 + Agentic Apps Top 10 (Dec 2025) | category being formalized | H |
| NIST AI Agent Standards Initiative (Feb 2026) | standards momentum | H |
| Microsoft Agent Governance Toolkit (Apr 2026, OSS) | hyperscaler entering | H |
| Okta / Strata / BigID | positioning on agent identity | M |

## What to monitor

- **New M&A** in any Tier-2 row → another layer absorbed; re-test the "squeeze" thesis.
- **Hyperscaler governance features** (beyond routing/caching) → erosion of the neutral-control-plane wedge.
- **A formal analyst label** for "governing AI-generated code" → category crystallizing; move to claim it.
- **EU AI Act enforcement** post-Aug 2, 2026 → demand inflection for `policy-engine` + `telemetry`.
- **Agentic project cancellation rate** → near-term budget signal (cuts both ways).
