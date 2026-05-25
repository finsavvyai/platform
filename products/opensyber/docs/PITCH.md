# OpenSyber — One-Page Pitch

**Last updated:** 2026-05-16

## Tagline
Deploy a secured AI security agent in 60 seconds.

## The problem
Security teams drown in alerts. 70% of SOC tickets are noise, but you cannot ignore them — one missed alert is a breach. Existing options:

- **Hire more analysts** — $120K each, 6-month ramp, burnout
- **Buy Dropzone or Prophet** — $50K+ ACV, vendor lock-in, their AI only
- **Build in-house** — 6 months, ML engineers, GPU bills, security debt

Mid-market security teams (10–500 employees) have no path. They cannot afford the incumbents and do not have the engineering bench to build.

## The solution
OpenSyber is the platform layer for AI security agents — Vercel + Stripe for security automation.

In 60 seconds you can:

1. Deploy an AI agent to your environment (Cloudflare-hosted, isolated VM)
2. Install skills from a marketplace (AI triage, remediation, compliance writing, threat intel)
3. Connect data sources (cloud accounts, SIEM, EDR via webhooks)
4. Watch alerts get triaged, prioritized, and remediated autonomously

Every agent runs with **TokenForge device-bound sessions** — stolen tokens are useless without the original device's hardware key. No other platform offers this.

## Why now
- **Wiz acquired by Google ($32B, Mar 2025)** — incumbent moves upmarket, leaves mid-market gap
- **Dropzone $57M, Prophet $30M** — proves buyers will pay for AI SOC; OpenSyber serves the 99% who cannot afford them
- **Market**: $1.65B (2026) → $13.52B (2032), 42% CAGR
- **Gartner**: multi-agent threat response goes from 5% → 70% of AI deployments
- **Compliance shift**: SOC 2 and ISO 27001 now ask "how do you secure AI agents?"

## Differentiators (defensible moat)
1. **Open skill marketplace** — Dropzone/Prophet are closed; we are the App Store
2. **TokenForge device binding** — ECDSA P-256 sessions, non-extractable keys
3. **60-second deploy** — no sales call, no PoC, no implementation team
4. **10x cheaper** — $99/mo vs $4,000+/mo
5. **Self-host option** — bring-your-own-cloud for regulated industries

## Business model

| Tier | Price | Target |
|------|-------|--------|
| Free | $0 | Sandbox skill preview, lead gen |
| Starter | $29/mo | Solo dev, 1 agent |
| Pro | $99/mo | Small team, 3 agents, AI bundle |
| Team | $299/mo | 10 agents, SSO, audit logs |
| Enterprise | $1,999+/mo | SAML, data residency, SLA |
| Marketplace | 30% rev share | Long-tail revenue, flywheel |

Plus TokenForge as standalone product ($49–$499/mo) and Claw Gateway as API product (usage-based).

## Honest traction (May 2026)
- 82% production-ready (Sprint 23 of 34 shipped)
- 263 API endpoints, 165 web components, 103 DB tables
- 782 test files, 6 AI skills bundle ready
- LemonSqueezy billing live, 4 OAuth providers
- **Pre-revenue, pre-design-partner** — actively seeking 10 design partners pre-launch
- Q2 2026 Product Hunt launch planned

## Investor sidebar
- **Comparable**: Dropzone $57M at ~$300M valuation; Prophet $30M at ~$200M
- **Wedge**: SMB/mid-market that incumbents cannot reach economically
- **Capital efficiency**: Cloudflare-first stack means infra costs ~$2K/mo at 1K users
- **Exit paths**: Palo Alto, CrowdStrike, Cisco, SentinelOne all acquired in this space ($1B–$32B range)
- **Ask**: Seed round for SOC 2 cert, 2 design-partner enterprise sales, 1 senior security engineer

## Sources
- Dropzone AI funding: https://www.dropzone.ai/press-release/dropzone-ai-37m-series-b-funding-ai-soc-agents
- Prophet Security: https://venturebeat.com/ai/ai-vs-ai-prophet-security-raises-30m-to-replace-human-analysts-with-autonomous-defenders
- Market size: https://www.marketsandmarkets.com/PressReleases/agentic-ai-security.asp
- CNAPP landscape: https://guptadeepak.com/tools/top-10-cnapp-solutions-2026/
