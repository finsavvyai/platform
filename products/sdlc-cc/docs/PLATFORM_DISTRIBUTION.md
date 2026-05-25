# sdlc.cc Platform Distribution Matrix & Implementation Plan

> Where to ship sdlc.cc DLP across every meaningful add-on / plugin / extension marketplace. Updated 2026-05-08.

## Constraint set

- Closed-source (no OSS yet)
- No MCP (deferred — comes back into scope when Anthropic ships admin BASE_URL or for ChatGPT Apps SDK later)
- Build multiple distribution paths in parallel; one shared backend (`sdlc.cc /v1/dlp/scrub` + `/v1/audit/usage`)
- **General privacy positioning** (updated 2026-05-08): not FSI-only. Detector catalog covers PII / PHI / credentials / IDs / financial / custom. Verticals = customer segments, not separate products.

## Matrix — every platform with a useful add-on surface

Reach figures are 2026 ballparks; install friction reflects the typical end-user path.

| # | Platform | Add-on shape | Audience | Friction | DLP fit | Effort | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Chrome Web Store** | MV3 browser ext | ~3.5B Chrome users | 1-click | ★★★★★ — intercepts user input on claude.ai + Cowork | 2-3 wk | **YES (P1)** |
| 2 | **Microsoft AppSource — Outlook add-in** | Office add-in | ~400M M365 seats | admin or user install | ★★★★★ — sanitise email body before AI summary | 2-3 wk | **YES (P1)** |
| 3 | **Microsoft AppSource — Excel add-in** | Office add-in | ~400M | user install | ★★★★ — sanitise selection before AI | 2 wk after Outlook | **YES (P2)** |
| 4 | **Microsoft Teams app** | Teams app (sideloaded or AppSource) | ~320M Teams users | admin install | ★★★ — chat DLP, meeting transcripts | 2 wk | **YES (P2)** |
| 5 | **M365 Copilot connector / Cowork plugin** | M365 App Package (Frontier program) | ~M365 Copilot subset | admin | ★★★★ — partner integration pattern Microsoft is actively expanding | 3-4 wk | **YES (P2)** — apply for Frontier |
| 6 | **Edge Add-ons (Microsoft)** | same MV3 manifest | ~280M Edge users | 1-click | ★★★★★ — same code as #1 | +0.5 wk | **YES (P1 bundled)** |
| 7 | **Firefox Add-ons** | WebExtensions manifest (mostly compatible) | ~190M Firefox users | 1-click | ★★★★★ | +1 wk | **YES (P2 bundled)** |
| 8 | **Slack App Directory** | Slack app + bot | ~32M DAU, ~200K paid orgs | admin install | ★★★ — Nightfall/Strac entrenched | 2-3 wk | MAYBE (P3) — only if MSP customer demands |
| 9 | **Google Workspace Marketplace** | Workspace add-on (Apps Script) | ~3B users | admin install | ★★ — Google has own AI Security add-on | 3-4 wk | SKIP — incumbent, low fit |
| 10 | **Notion** | OAuth connection / Notion API integration | ~50M users | OAuth | ★★★ — Nightfall already native | 2-3 wk | MAYBE (P4) |
| 11 | **Atlassian Marketplace (Jira/Confluence Forge)** | Forge app | ~200K orgs Jira+Conf | admin install | ★★★ — surface confidential content in Confluence | 3-4 wk | MAYBE (P4) |
| 12 | **Salesforce AppExchange** | Lightning / Apex package | ~150K orgs | review (multi-week) | ★★ — Einstein Trust Layer dominates | 6-8 wk | SKIP — incumbent + heavy review |
| 13 | **ServiceNow Store** | Now app | ~7K enterprise customers | review | ★★★ — high-value FSI/healthcare | 6-8 wk | LATER (post-design-partner) |
| 14 | **Zoom Marketplace** | Zoom App | ~300M users | admin install | ★★★ — meeting transcripts → AI summarise | 3-4 wk | MAYBE (P4) — niche but real |
| 15 | **Cloudflare AI Gateway plugin** | Worker / plugin | growing fast | 1-click in CF dash | ★★★★ — sit in the same pipe customers already use | 2-3 wk | **YES (P3)** — defensive + edge-of-pipe |
| 16 | **GitHub Marketplace (GitHub Apps)** | GitHub App for repos | ~150M devs | install per repo | ★★ — code-only, narrow DLP | 2 wk | SKIP — narrow fit |
| 17 | **Cursor / Windsurf extensions** | VSCode-API extension | ~5M devs combined | 1-click | ★★ — code-context only | 1-2 wk | SKIP — narrow |
| 18 | **VSCode Marketplace** | VSCode extension | ~14M devs | 1-click | ★★ — code-only | 1-2 wk | SKIP — narrow |
| 19 | **Zapier App Directory** | Custom Zapier app | ~5M users | 1-click | ★★★ — automation triggers (PII before AI step) | 1 wk | **YES (P3)** — cheap, broad |
| 20 | **Make.com / n8n marketplaces** | Custom app | ~1M each | 1-click | ★★★ — same as Zapier | 1 wk | YES (P3 bundled) |
| 21 | **Apple App Store (iOS/iPadOS)** | App + Shortcuts intents | ~1.5B devices | App Store | ★★ — Shortcuts intents only without Cowork iOS | 4-6 wk | SKIP for now |
| 22 | **Mac App Store** | macOS app + Services menu | ~100M Macs | App Store | ★★★ — system-wide "Sanitize for AI" service menu | 4-6 wk | LATER |
| 23 | **Microsoft Store (Windows)** | UWP/Win32 + system extension | ~1.5B Win users | Store | ★★★ — system clipboard + Outlook desktop | 6-8 wk | LATER |
| 24 | **ChatGPT Apps Directory** | MCP-based App | ~700M WAU | 1-click | ★★★★★ — but MCP-required (deferred per constraint) | done if MCP unblocks | DEFERRED |
| 25 | **Anthropic Apps / MCP Partner Directory** | MCP server | growing fast | 1-click | ★★★★★ — but MCP deferred | done | DEFERRED |
| 26 | **Discord App Directory** | Discord bot | ~200M MAU | server install | ★ — chat-only, not enterprise | 1 wk | SKIP — wrong audience |
| 27 | **Mattermost / Rocket.Chat** | OSS-chat plugins | ~10M users | self-host | ★★ — niche | 1 wk | SKIP |
| 28 | **Outlook on the Web — MailFlow Rule** | Exchange transport rule + service endpoint | ~400M | admin only | ★★★★ — server-side scrubbing of inbound mail | 2-3 wk | **YES (P3)** |
| 29 | **SharePoint Sensitivity-Label Auto-Apply** | Purview policy + service hook | M365 E5 | admin only | ★★★ — auto-redact files at rest | 3-4 wk | LATER |
| 30 | **Standalone web app** (`scrub.sdlc.cc`) | static SPA + gateway API | unbounded | URL | ★★★★★ — instant demo, zero install | 1 wk | **YES (P0)** |

## Verdicts by phase

```
P0 (this week)        — scrub.sdlc.cc web app                            (1 wk)
P1 (next 3 weeks)     — Browser ext (Chrome+Edge)                         (3 wk)
                        Outlook add-in                                     (3 wk parallel)
P2 (weeks 4–7)        — Excel add-in                                       (2 wk)
                        Teams app                                           (2 wk parallel)
                        M365 Copilot Frontier connector                     (4 wk parallel)
                        Firefox port of browser ext                          (1 wk)
P3 (weeks 8–12)       — Cloudflare AI Gateway plugin                       (3 wk)
                        Zapier + Make + n8n trio                            (1 wk total)
                        Outlook MailFlow rule (server-side)                 (3 wk parallel)
                        Slack app (only if MSP customer asks)               (3 wk on demand)
P4 (later)            — Notion / Atlassian Forge / Zoom (one customer ask each)
LATER                 — Salesforce / ServiceNow (post-design-partner)
LATER                 — Mac App Store / Microsoft Store / iOS
DEFERRED              — ChatGPT Apps SDK + Anthropic MCP Directory (when MCP unblocks)
SKIP                  — Google Workspace Marketplace, GitHub, Cursor, Discord, Mattermost
```

## Why this lineup

| Tier | Rationale |
|---|---|
| **P0** | A demoable URL beats the longest pitch deck. `scrub.sdlc.cc` is the showroom. |
| **P1** | Maximum coverage per week of work — Chrome ext catches Cowork (where Strac doesn't); Outlook add-in is the workflow Microsoft prospects ask about. Both ride existing distribution rails (Chrome Web Store, AppSource). |
| **P2** | M365 saturation. Once Outlook lands, Excel is half the work. Teams + Copilot connector ride the same M365 App Package distribution and apply to the same buyer persona. |
| **P3** | Defensive coverage — Cloudflare for edge users, Zapier/Make/n8n for ops automators, MailFlow rule for server-side mail scrubbing. Cheap each, broad reach combined. |
| **P4 / LATER** | Demand-driven. Don't build until a real customer asks. |
| **SKIP** | Either the incumbent is too strong (Google AI Security add-on, Salesforce Einstein Trust Layer) or audience fit is wrong (GitHub for code DLP, Discord for enterprise). |
| **DEFERRED** | ChatGPT/Anthropic require MCP. When you re-open MCP scope, these flip to P1 instantly — the gateway already does the work, MCP becomes a thin wrapper. |

## Shared architecture

All add-ons hit the same backend:

```
Add-on (Chrome ext / Outlook / Excel / Teams / Cloudflare / Zapier / web app …)
        │
        │  POST {scrub.sdlc.cc | api.sdlc.cc}/v1/dlp/scrub
        │  Authorization: Bearer sk_sdlc_*
        ▼
sdlc.cc gateway  →  audit row (tenant_id from key)
                 →  metric counter
                 →  returns clean_text + Counts struct
```

One backend, N front-doors. Each add-on is just:
1. A "scrub this text" call
2. The user's `sk_sdlc_*` key (entered once per add-on, stored in the platform's secret store)
3. Audit visibility per-add-on via `summary_type` in the audit row

## What changes per add-on

The **only** add-on-specific code is the trigger + UI:

| Add-on | Trigger | UI |
|---|---|---|
| Web app | user pastes / drops a file | textarea + redaction count panel |
| Browser ext | textarea submit + paste event on claude.ai | inline badge "X redacted" |
| Outlook add-in | "Sanitize for AI" ribbon button on email | reading pane shows scrubbed copy |
| Excel add-in | ribbon button on selection | replaces selection or writes to a new sheet |
| Teams app | message action "Scrub before sending" | ephemeral preview with diff |
| M365 Copilot connector | invoked by Copilot agent during retrieval | returns scrubbed file content |
| Cloudflare plugin | inline on the AI Gateway pipeline | dashboard panel + toggle |
| MailFlow rule | every inbound email matching policy | scrubbed copy in shadow folder |
| Zapier app | trigger or action step | textarea config |

## Implementation roadmap (90 days)

### Week 1 — P0 + foundations

- Day 1-2: Cloudflare Tunnel + Fly deploy (interactive steps with you) — gets `https://api.sdlc.cc` real
- Day 3-5: `scrub.sdlc.cc` static SvelteKit web app, Cloudflare Pages
- Day 5: Public landing page draft, demo loom video

### Weeks 2–4 — P1

- Week 2: Browser extension scaffold (Chrome MV3) — content script intercepting claude.ai textarea, scrub via gateway
- Week 3: Browser extension polish + Edge listing prep + Chrome Web Store enterprise force-install docs
- Week 3: Outlook add-in scaffold (Office.js) — ribbon button "Sanitize for AI" calling gateway
- Week 4: Outlook add-in submit to AppSource (review takes ~5 days separately)

### Weeks 5–7 — P2

- Week 5: Excel add-in (~50% reuse of Outlook add-in shell)
- Week 6: Teams app (manifest + bot/message extension)
- Week 5-7: M365 Copilot connector + Frontier program application

### Weeks 8–12 — P3

- Week 8-9: Cloudflare AI Gateway plugin
- Week 10: Zapier + Make + n8n app trio (one week total — same custom-app config)
- Week 10-12: Outlook MailFlow rule + Exchange transport rule docs
- Week 12: Slack app **only if** an MSP customer asks during pilot

### Beyond

- Notion / Atlassian Forge / Zoom — demand-driven, ~3-4 wk each
- Salesforce / ServiceNow — post-design-partner, multi-week review processes
- iOS / macOS / Windows native apps — system-level integrations once the SaaS proves out
- ChatGPT Apps SDK + Anthropic MCP Directory — flip on when MCP scope unblocks

## What I need from you to start

1. **Decision on P0 first** — should I scaffold `scrub.sdlc.cc` as a Cloudflare Pages site this week, or wait until the gateway is publicly deployed (Fly + Tunnel)? They're independent.
2. **Branding** — extension/add-on names, logo, screenshots. We can ship with placeholder branding to AppSource sandbox accounts; production listings need real assets.
3. **AppSource publisher account** — Microsoft requires a Partner Center publisher (~$99/yr enterprise verification). Same for Chrome Web Store ($5 one-time dev fee). Apple App Store later ($99/yr).
4. **Two design-partner MSPs** — same ask as the COMPETITIVE_LANDSCAPE doc. Without these, P2 is speculative.

## Sources

- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk)
- [ChatGPT App Directory](https://venturebeat.com/technology/openai-now-accepting-chatgpt-app-submissions-from-third-party-devs-launches)
- [Microsoft 365 Copilot Cowork plugins](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-plugin-development)
- [M365 Copilot connectors gallery](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/connectors-gallery)
- [Google Workspace AI Security add-on](https://workspaceupdates.googleblog.com/2024/04/ai-security-add-on-google-workspace.html)
- [Salesforce Einstein Trust Layer](https://help.salesforce.com/s/articleView?id=ai.generative_ai_trust_arch.htm)
- [Notion security & compliance integrations](https://www.notion.com/help/add-security-and-compliance-integrations)
- [Atlassian Forge changelog](https://developer.atlassian.com/changelog/)
- [Slack DLP guide — Nightfall](https://www.nightfall.ai/guide/the-essential-guide-to-slack-data-loss-prevention-dlp)
- [Microsoft 365 Copilot release notes](https://learn.microsoft.com/en-us/microsoft-365/copilot/release-notes)
- [Anthropic deepens Wall Street push](https://fortune.com/2026/05/05/anthropic-wall-street-financial-services-agents-jamie-dimon/)
