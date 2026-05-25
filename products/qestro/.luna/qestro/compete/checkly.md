# Checkly (checklyhq.com)

> **Category**: AI-first / modern — synthetic monitoring + Playwright-as-a-service
> **Threat level to Qestro**: **MEDIUM** — overlapping on Playwright-in-the-cloud, but their primary wedge is monitoring, not pre-deploy testing

## 1. One-sentence positioning
"Build Confidently. Ship Continuously." — application monitoring and synthetic testing platform with an "AI-native workflow" and "Monitoring as Code."

## 2. Core product capabilities
- Synthetic monitoring (Playwright-based browser checks)
- Uptime monitoring (URL, TCP, DNS, DB) from 22+ locations
- API checks with assertions
- Rocky AI: automated root cause analysis
- Agent Skills: "prompt to monitor" via natural language
- Alerting (Slack, PagerDuty, email, SMS, phone)
- Monitoring-as-Code: Terraform, Pulumi, CLI-first
- Status pages
- OpenTelemetry integration
- Customers: Vercel, CrowdStrike, Airbus, ServiceNow

## 3. What they do BETTER than Qestro
- **Monitoring is a real thing Qestro doesn't do**. Running tests on a schedule against production every 30 seconds from 22 locations — that's Checkly's core. Qestro's scheduler is CI/cron-style, not global synthetic.
- **Infrastructure-as-code for tests**. Terraform + Pulumi support is ahead of Qestro.
- **Global locations**: 22+ regions vs Qestro's Cloudflare edge (which is broader physically but different use case).
- **OTEL integration**: traces from synthetic checks correlate with app observability.
- **Logo quality**: Vercel, CrowdStrike, Airbus are top-tier.

## 4. What Qestro does BETTER than them
- **Pre-deploy CI testing is the core use case**. Checkly is post-deploy monitoring. Different job. Qestro gates merges; Checkly alerts after the incident.
- **Test authoring from English**. Checkly's "prompt to monitor" is limited to single checks; Qestro generates full test suites with multiple assertions, data chains, and mobile/API steps.
- **Self-healing**. Checkly alerts you when a check fails. Qestro alerts *and* proposes a fix for the selector/assertion/timing.
- **Mobile testing**. Checkly is web + API only — no mobile.
- **Unified dashboard for dev + QA workflows**, not just SRE-adjacent monitoring.

## 5. Tech stack signals
- Playwright-based runner (explicit on homepage)
- OpenTelemetry native
- JavaScript/TypeScript SDK
- Infrastructure: likely AWS multi-region for the 22-location check network
- Terraform + Pulumi providers (public on GitHub)

## 6. Pricing tiers
| Tier | Price | Uptime | Browser runs/mo | API runs/mo |
|---|---|---|---|---|
| Hobby (Free) | $0 | 10 | 1,000 | 10,000 |
| Starter | $24/mo | 50 | 3,000 | 25,000 |
| Team | $64/mo | 75 | 12,000 | 100,000 |
| Enterprise | Contact | Custom | Custom | Custom |

Add-ons: $4-6.50 per 1k extra browser runs, $1.80-2.60 per 10k API runs.

**Verdict on pricing**: Checkly is meaningfully cheaper than Qestro for equivalent browser check volume ($64/mo Team vs Qestro Pro $499/mo). But they're solving a different job — synthetic monitoring, not pre-deploy CI.

## 7. Target customer
DevOps + SRE teams at developer-first companies. Vercel's own monitoring stack includes Checkly. Skews toward infrastructure-heavy orgs (edge, serverless, Kubernetes).

## 8. Recent signals
- Launched Rocky AI (root cause analysis) — AI features live.
- Launched Agent Skills (prompt-to-monitor) — embracing MCP/agent ecosystem.
- Strong developer marketing, very active blog.
- No major funding news recently — but they raised $10M Series A in 2022 per public sources.

## 9. Qestro's winning angle vs Checkly

**Different jobs-to-be-done.** Checkly is the synthetic monitoring tool you run in production. Qestro is the AI testing platform you run in CI before you merge to main. These are complementary.

"Checkly watches your production app every 30 seconds and pages you when something breaks. Qestro stops the thing from breaking in the first place by generating full test suites for every PR. Most serious teams run both."

**Key wedge plays vs Checkly**:
1. **Pre-deploy vs post-deploy**: "Don't catch bugs in production at 3am. Catch them in the PR."
2. **Test authoring depth**: Checkly's prompt-to-monitor is single-check. Qestro writes full multi-step user flows.
3. **Mobile**: we have it, they don't.
4. **Self-healing**: their tests break and they alert you. Ours break and we fix them.

**Where Qestro complements Checkly**: actually pitch them as partners. "Use Qestro in CI. Use Checkly in production. They're not overlapping." This is the rare case where the right move is co-marketing, not head-to-head.
