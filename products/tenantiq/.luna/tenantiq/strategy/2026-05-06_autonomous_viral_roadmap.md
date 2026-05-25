# Autonomous + Viral + Futuristic — TenantIQ next-leverage moves

**Date:** 2026-05-06
**Premise:** MCP makes TenantIQ a Claude data source. Now compose:
*autonomous* (agents do work without clicks) + *viral* (every artifact is
shareable + branded) + *futuristic* (multi-agent / agents-on-agents).

## Twelve concrete moves, ranked by ship-time

### Tier A — ship this week (each <2 days)

1. **Public unauthenticated MCP namespace.** Anyone with Claude Desktop
   pointed at `https://api.tenantiq.app/api/mcp-public` can call
   `scan_domain(domain)`. No signup. Lead-gen via Claude itself. *Viral:*
   the answer cites TenantIQ; users save the config. Foundation for #4.

2. **Live public counter on landing.** `/api/stats/public` returns
   aggregate (anonymized) numbers — total scans, controls audited, drift
   events caught, autonomous fixes applied this month. SSE-updated on
   landing as a ticking number. *Viral:* screenshot material on
   LinkedIn / Twitter.

3. **Autonomous agent action log.** New `agent_actions` table records
   every action an autonomous Claude agent takes (scan, finding raised,
   email sent, fix applied, drift reverted). Powers #2's counter, #4's
   leaderboard, and gives MSPs an audit trail for "what did the agent
   do overnight?"

### Tier B — ship next sprint (2–5 days each)

4. **Public agent leaderboard at `/leaderboard`.** Anonymized weekly
   stats: "TenantIQ agents fixed N controls across M tenants this week
   without human approval." Per-finding-type breakdown. *Viral:* every
   MSP wants to see what their peers' agents are doing.

5. **Autonomous Tenant Auditor cron.** Every 6 hours per active tenant:
   pick top 3 unfixed findings (CIS + Defender + PIM), Claude drafts an
   MSP-branded email with one-click fix buttons (calls MCP write tools
   on click), Resend ships it. *Futuristic:* MSPs wake up to inboxes
   triaged. *Viral:* email signed *"Audited autonomously by TenantIQ —
   one-click fix"* with forward-safe branding so end customers see it.

6. **Agent-narrated public scan.** Today `/scan/:domain` returns a
   pre-canned report. Replace with an SSE stream from a Claude agent
   that calls 4 sub-tools (DNS / OAuth tenant probe / mail provider /
   federation), narrates each step live as the page paints. *Futuristic:*
   prospects see Claude doing the work. *Viral:* shareable URL is
   already there — now it's a 30-sec demo.

7. **MCP demo-mode key (`tiq_demo_*`).** Any visitor copies the key,
   pastes into Claude Desktop, gets a working synthetic 3-tenant org.
   60-second integration test before signup. Sales-cycle compression.

### Tier C — foundational, 1–2 weeks each

8. **Autonomous remediation with rollback.** Claude reads a finding,
   calls the right Graph PATCH, watches the audit log for blast radius
   for 60 seconds via SSE, auto-rollbacks if anomaly. Already have
   drift revert + audit logger + anomaly detection — just compose them
   under Claude orchestration. *Futuristic:* the dashboard self-heals.

9. **Multi-agent debate mode.** Two Claude agents argue each finding —
   Conservative says revert, Pragmatic says accept-risk. Each writes a
   one-paragraph case. MSP picks. *Viral:* perfect LinkedIn-video shape.

10. **TenantIQ-as-MCP-client.** Smart-router gains the ability to call
    *other* MCP servers (Microsoft Graph MCP when it ships, GitHub MCP,
    etc.) as tools for our AI Agent. *Futuristic:* TenantIQ orchestrates
    the MCP ecosystem instead of competing with it.

11. **MCP prompts surface for skill templates.** Each agent template
    becomes a Claude `prompts/get` entry with parameters. *"Run the
    onboarding template on tenant Acme"* → Claude pulls the structured
    prompt + auto-invokes `apply_skill_template`. Closes the gap
    between human language and write tools.

12. **Time-traveling agent.** Given a date, reconstruct tenant state
    from snapshots + drift events + audit logs. *"What did Acme's CA
    policies look like 2026-04-12?"* — incident-response gold and a
    perfect demo.

## Compound effects

Tier A is the foundation: public counter + agent action log + public
MCP namespace. Once those exist, Tier B leverages them (leaderboard
reads from action log; demo mode reads from public MCP; auditor cron
writes to action log). Tier C is the autonomy moat — agents acting on
agents.

## What ships today (this turn)

- Move 1 — public MCP namespace with `scan_domain` (unauthenticated)
- Move 2 — public stats endpoint + landing counter
- Move 3 — agent actions table + write helper

The rest queued for follow-up sprints.
