# CISO Demo — 15-Minute Talk Track

**Audience:** CISO / Director of Security / IT Director at an MSP serving 9–250+ M365 tenants, or at a multi-subsidiary enterprise.
**Length:** 15 minutes total — 12 demo + 3 Q&A buffer. **No slides.**
**Setup:** browser tabs pre-opened in this order (use the demo bearer `tiq_demo_visitor_2026` for any logged-out flows; a real admin session for the rest).

---

## 0. Pre-flight (done before they join)

- Chrome window with these tabs open in order:
  1. `https://app.tenantiq.app/scan/microsoft.com` (primed — already loaded once)
  2. `https://app.tenantiq.app/agents` (signed in as admin)
  3. `https://app.tenantiq.app/security/timewarp` (admin)
  4. `https://app.tenantiq.app/security/cis` (admin)
  5. `https://app.tenantiq.app/leaderboard` (no auth)
  6. `https://app.tenantiq.app/settings/mcp-clients` (admin)
  7. `https://app.tenantiq.app/compare`
- Claude Desktop running with MCP server `tenantiq` configured + the demo bearer. One conversation pre-tested.
- Have ready: a 25–35 page PDF of `docs/sales/HOW_IT_WORKS.md` to email after the call.

---

## 1. The wedge (1 minute)

> **Talk:** *"Three weeks ago Anthropic shipped Claude as a single agent across Excel, Word, PowerPoint, Outlook. That commoditises 'AI inside one customer's M365.' What it doesn't address is the layer above — managing other people's tenants at scale. That's the only thing TenantIQ does, and it's why this conversation isn't about replacing Microsoft Defender or Copilot."*

**No clicks yet.** This is the framing line.

## 2. The lead-in scan — autonomous, public, no signup (90 seconds)

**Tab 1 → `app.tenantiq.app/scan/microsoft.com`**

> **Talk:** *"This is an unauthenticated TenantIQ agent scanning a domain in real time — DNS auth, M365 tenant identity, federation type, mail provider — narrating each step as it goes. It's the same SSE pattern that drives the rest of the autonomous flow. Anyone can run this on any domain — it's our public lead-gen surface."*

Refresh the page mid-talk so they see the live SSE narration paint stage by stage.

**Question to expect:** *"Does this hit our tenant?"* → **A:** *"Only public DNS + Microsoft's openid-configuration endpoint. Read-only, no credentials, no signup. The full posture work happens after admin consent."*

## 3. Live agent feed — the autonomous narrative (3 minutes)

**Tab 2 → `app.tenantiq.app/agents`**

> **Talk:** *"This is the live feed of every autonomous action TenantIQ has taken across this org's tenants in the last 24 hours. Each row is one entry in the `agent_actions` table — append-only, tamper-evident, JWT-scoped to the calling org. Sub-second push: when an agent writes, it fans out via a Cloudflare Durable Object to this stream."*

Walk through 2–3 row types:

- **`autonomous-auditor` → `email-sent`** — *"This agent runs every 6 hours per tenant, picks the top 3 unfixed CIS controls, drafts a Claude-written remediation email to the customer's IT contact, and sends it via Resend. The email is signed 'Audited autonomously by TenantIQ — one-click fix.' Forwardable, branded with the MSP's identity."*

- **`auto-remediator` → `fix-applied` (status: pending-approval)** — *"This is the dry-run path. The scanner matched a config drift against a source-pinned recipe — only two ship today: re-enabling a CA legacy-auth block that flipped to report-only, and re-enabling the Microsoft Authenticator method. The recipe captured the baseline, would have applied the fix, but the tenant is in dry-run mode so it queued for approval. Click Approve and it runs live with a 60-second anomaly watch."*

- **`auto-remediator` → `rollback`** — *"And here's the safety net. After applying a fix in live mode, the agent watches alerts for 60 seconds. If critical/high alerts spike to ≥3× the prior-hour baseline, it auto-rolls back to the captured baseline. This is what makes 'autonomous' livable for a CISO."*

**Click an Approve button** on a pending row. Show the toast. Show the new row appear in the stream within 5 seconds.

**Question to expect:** *"How do I stop a runaway agent?"* → **A:** *"Three ways. (1) Per-tenant `autofix:mode` flag — flip back to dry-run instantly via `/api/tenants/:id/auto-fix-mode`. (2) Daily cap of 5 auto-fixes per tenant per 24h, KV-enforced, can't be bypassed. (3) Recipes are source-pinned — adding a new one is a PR, not a runtime change."*

## 4. Time-traveling agent — incident response (2 minutes)

**Tab 3 → `app.tenantiq.app/security/timewarp`**

> **Talk:** *"Standard incident-response question: 'What did our CA policies look like at 3am Tuesday when the breach happened?' Most tools answer 'check your snapshots.' We rebuild the state."*

Click the **24h ago** preset → click **Travel**.

> **Talk:** *"It pulled the latest config snapshot before that timestamp, applied every config_drift in chronological order until it caught up to the target moment, summarised the audit-log slice for context, and produced a JSON tree. Per-category buckets show `lastChange` + `lastChangeAt` from the most recent drift before the moment. This is what makes blameless post-mortems actually possible."*

**Question to expect:** *"Where does the data come from? What if our snapshots have gaps?"* → **A:** *"Snapshots run nightly (cron 0 2 * * *) and on-demand. Drift events are continuous from the security-scan cron. If there's no snapshot ≤ the target, we say so explicitly — narrative reads 'No config_snapshot captured before this timestamp — cannot reconstruct.' We don't fabricate state."*

## 5. CIS depth + per-tenant overrides (2 minutes)

**Tab 4 → `app.tenantiq.app/security/cis`**

> **Talk:** *"121 controls across 7 domains, L1/L2 tagged per CIS v3.1. 31+ are wired to live Microsoft Graph evaluation — not 'check this and report back,' actually checks the tenant. The override engine is the differentiator: each customer can accept-risk or omit a control with auditor-grade justification, ScubaGear-style. The override is a row, not a global setting — your auditor sees who decided what when, per tenant."*

Click into a finding → expand → show the **AI explainer** card.

> **Talk:** *"That's Claude with tenant context — current MFA rate, CA policy count, secure score — explaining the gap to a technician in 4–6 sentences with the exact M365 admin path to close it. KV-cached 24 hours; degrades to a static fallback if the API key is missing. The model is the explainer; it never decides to mutate state."*

## 6. Cross-tenant rollups & MCP composer (2 minutes)

**Tab 5 → `app.tenantiq.app/leaderboard`** *(brief, 30 seconds)*

> **Talk:** *"Anonymized aggregate across every MSP running TenantIQ. Powered by the same agent_actions table that drives /agents — just rolled up. Built for transparency, also for distribution: this URL is shareable LinkedIn material."*

**Tab 6 → `app.tenantiq.app/settings/mcp-clients`** *(90 seconds — the composer story)*

> **Talk:** *"This is the strategic move. TenantIQ ships its own MCP server at `api.tenantiq.app/api/mcp` — that's covered later. But here we're an MCP client too. Register Microsoft's Graph MCP, GitHub MCP, Moody's MCP, your own internal tooling — TenantIQ's AI Agent calls their tools alongside ours. We don't compete with the MCP ecosystem; we orchestrate it."*

Type a fake URL into the form → show validation. Don't actually save.

## 7. Outside the dashboard — Claude Desktop (2 minutes — the stinger)

**Switch to Claude Desktop** (already configured with TenantIQ MCP + demo bearer).

Type into the chat:

> *"Show me the CIS posture for the Acme tenant."*

Claude calls `get_cis_posture` (tool/call) → returns synthetic posture for `demo-tenant-acme`. Claude narrates the score, top failing controls, suggested next actions.

> **Talk:** *"This is a CISO demoing to a board, with the same data the dashboard shows, in the conversation surface their team already lives in. Two surfaces, one source of truth, role gating enforced server-side. Write tools require admin role — no jailbreak in Claude Desktop config can grant write access."*

If time, ask Claude:

> *"Run the onboarding template on the Globex tenant."*

Claude pulls the `onboard_tenant` MCP prompt, calls `apply_skill_template` with `templateId=tpl_new_tenant_onboarding`, narrates the activated skills.

## 8. Comparison + close (1 minute)

**Tab 7 → `app.tenantiq.app/compare`**

> **Talk:** *"Last frame. Three columns. Horizontal AI inside M365 — Claude or Copilot — and our nearest direct competitor. The first table is the only one that matters for this conversation: every row is something TenantIQ does that horizontal AI fundamentally can't, scoped by the agent loop you just saw. That's the wedge."*

Pause. Then:

> *"What I want from this conversation: a 14-day pilot on three of your tenants, dry-run mode only. Zero Graph mutations. We populate /agents and /security/timewarp with real data, you decide if the autonomous narrative is what your team needs. If yes, you flip the per-tenant mode flag."*

---

## Anticipated questions + crisp answers

| Question | Answer |
|---|---|
| "What if your AI hallucinates a recipe?" | Recipes are source-pinned. Code, not data. Adding a recipe is a PR. AI explains; deterministic code acts. |
| "How do you handle EU data residency?" | All compute on Cloudflare Workers; D1 in chosen region; Microsoft Graph reads scoped per Azure tenant region; no data ever leaves the customer's geographic boundary except for Anthropic API calls (those are the explainer-only path, optional, can be disabled). |
| "Cost?" | Per-tenant pricing $45–$99/mo, volume tiers, plus your own Anthropic API spend if you opt in for the explainer (≤ $0.25/tenant/month at typical usage). |
| "How do I get out?" | Account-deletion cascade — 33 tables, contract test in CI. GDPR Art. 17 + M365 Cert C7. Single API call. |
| "Pen test?" | None published yet. Honest answer. We're targeting one in Q3 2026. |
| "SOC 2 Type II?" | Targeting H2 2026. We evaluate SOC 2 controls *for our customers* but our own SOC 2 attestation is in flight, not done. |
| "What scopes does the agent need?" | The standard read-mostly Graph scopes plus `Policy.ReadWrite.ConditionalAccess` and `UserAuthenticationMethod.ReadWrite.All` only when auto-remediator is activated. We list each scope, per skill, on the activation page. |

---

## Post-call follow-up email template

> Subject: TenantIQ pilot — three tenants, dry-run only, no Graph mutations
>
> Thanks for the time today. Recap of what we'd propose:
>
> - 14-day pilot on three of your tenants
> - Dry-run mode only — zero Graph mutations, baseline-capture only
> - You see real `agent_actions` populate `/agents`, real reconstructions on `/security/timewarp`, real CIS evaluation depth
> - Decision to flip a tenant to `live` mode is yours, per tenant, via API or admin UI
> - Cancellable any time, full account-deletion cascade in one call
>
> Attached: how-it-works one-pager. URLs that don't need a login:
>
> - `app.tenantiq.app/compare` — vs horizontal AI assistants + nearest competitor
> - `app.tenantiq.app/scan/<your-domain>` — autonomous public scan with our agent narrating
> - `app.tenantiq.app/leaderboard` — anonymized aggregate of agent activity
>
> Demo MCP key for Claude Desktop (read-only, synthetic data): `tiq_demo_visitor_2026`
>
> Two questions:
> 1. Which three tenants for the pilot?
> 2. Who from your team should be the first admin?
