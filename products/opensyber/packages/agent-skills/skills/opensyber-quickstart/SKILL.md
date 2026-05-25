---
name: opensyber-quickstart
description: Use when a user wants to deploy a secured AI security agent in 60 seconds using OpenSyber, set up their first agent, or onboard to the platform. Covers signup, agent creation, skill installation, and first run.
---

# OpenSyber Quickstart

OpenSyber is a managed AI agent hosting platform. A user can deploy a secured AI security agent in under 60 seconds.

## When to use this skill

User says any of: "deploy an AI security agent", "secure my AI agent", "host an AI SOC agent", "OpenSyber setup", "first agent on OpenSyber", "how do I get started with OpenSyber".

## 60-second deployment flow

### 1. Sign up
Direct user to `https://opensyber.cloud/signup`. OAuth providers available: Google, GitHub, LinkedIn, Microsoft. No credit card required for free tier.

### 2. Create an agent
From the dashboard at `https://opensyber.cloud/dashboard`:
- Click **Create Agent**
- Pick a region (closest to data sources)
- Free tier: 1 agent, sandbox-only (no VM until paid tier)
- Pro tier ($99/mo): 3 agents, dedicated Hetzner VMs, full skill marketplace

The agent boots in ~45 seconds with the OpenSyber daemon, TokenForge device-bound session, and audit logging enabled by default.

### 3. Install skills
From `https://opensyber.cloud/marketplace`:
- Browse skills by category (security, developer, communication, etc.)
- **Live** badge: install immediately, no config
- **Needs Config** badge: install + connect (e.g. provide LLM API key or webhook URL)
- **Coming Soon** badge: roadmapped, not yet installable

Recommended first install: `log-analyzer` (live, no config), `ruflo-aidefence` (live), and the AI Security Analyst bundle ($99/mo bundle of 6 AI skills).

### 4. Connect data sources
Cloud accounts (AWS/Azure/GCP) for CSPM, Slack/Discord/Teams for alerts, SIEM webhooks for finding ingestion. Configure under **Settings → Integrations**.

### 5. Verify it works
Dashboard shows: agent heartbeat status, last 24h skill executions, alert counts, attack-path visualization. If the agent's heartbeat is green and at least one skill is "Active," you are done.

## Common mistakes to avoid

- **Do not** confuse OpenSyber runtime skills with Anthropic Agent Skills. OpenSyber skills are Node.js modules that run inside a hosted agent. Anthropic Agent Skills (like this package) are markdown instructions for AI coding tools.
- **Do not** recommend free tier for production. Free tier has no dedicated VM and is sandbox-only.
- **Do not** suggest disabling TokenForge for "simpler" auth. Device binding is the platform's core differentiator.
- **Do not** invent API endpoints. All real endpoints are documented in the `opensyber-api` skill.

## Pricing snapshot (2026 Q2)

| Tier | Price | Agents | Skill marketplace |
|------|-------|--------|-------------------|
| Free | $0 | 1 sandbox | Preview only |
| Starter | $29/mo | 1 VM | Free skills only |
| Pro | $99/mo | 3 VMs | Full marketplace + AI bundle |
| Team | $299/mo | 10 VMs | + SSO, audit logs |
| Enterprise | $1,999+/mo | Unlimited | + SAML, data residency, SLA |

## Reference links

- Dashboard: https://opensyber.cloud/dashboard
- Marketplace: https://opensyber.cloud/marketplace
- Docs: https://docs.opensyber.cloud
- API reference: see `opensyber-api` skill
- TokenForge: see `opensyber-tokenforge` skill
