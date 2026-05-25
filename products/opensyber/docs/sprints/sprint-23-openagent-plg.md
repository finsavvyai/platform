> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 23: OpenAgent — Multi-Platform PLG Distribution ("Proof of Insecurity")

## Goal

Build a free, open-source presence across every surface where developers and
enterprises interact with AI tools. The "proof of insecurity" sales motion runs
everywhere: IDE, browser, cloud marketplace, AI platform, collaboration tools.
Each surface shows a different audience their own exposure — and converts them
to OpenSyber.

**This is not a product feature. This is the distribution strategy.**

## The Multi-Surface Map

```text
Surface                   │ Audience             │ "Proof" shown
──────────────────────────┼──────────────────────┼──────────────────────────────
VSCode Extension          │ Developers           │ What AI agents do on disk
JetBrains Plugin          │ Enterprise devs      │ Same — Java/Python shops
Chrome/Edge Extension     │ Developers + CISOs   │ AI session security posture
Claude.ai / MCP Server    │ AI-native teams      │ Ask Claude: "am I secure?"
OpenAI GPT Store          │ ChatGPT Pro users    │ Free security audit via GPT
Azure Marketplace         │ Enterprise IT/CISOs  │ One-click deploy from Azure
AWS Marketplace           │ Cloud-native teams   │ One-click deploy from AWS
GitHub Marketplace App    │ Dev teams            │ PR scanning for agent risk
Slack App                 │ Security teams       │ Real-time agent risk alerts
WhatsApp Business         │ CISOs (EMEA/LatAm)   │ CRITICAL alerts on mobile
Claude Code Skills        │ Claude Code users    │ Claude monitors itself
LinkedIn                  │ CISOs / VPs Security │ Viral score share + content
Raycast Extension         │ Power users / CTOs   │ One-command security scan
```

```text
Free VSCode extension → Viral "what did my agent do today?" moment
→ Risk event detected → Upgrade prompt
→ Enterprise demo call → "Show me our logs" → Platform deal
```

## Strategic Context

Wiz closed hundreds of millions in ARR by running free cloud scans that showed
CTOs their own exposed databases. Socket.dev went viral by showing developers
their npm packages were calling home. This sprint follows the same pattern:

- The **problem** (AI agents are unmonitored) is invisible until you show it
- The **free tool** makes the invisible visible — in 5 minutes
- The **enterprise platform** (OpenSyber) is the fix

## Dependencies

- No sprint dependencies — this is a **standalone** VSCode extension + npm CLI
- Does NOT require the OpenSyber platform to be installed
- Integrates with OpenSyber platform if user has an account (optional cloud sync)
- Uses existing `apps/api/src/routes/` for cloud sync endpoints (new routes added)

## Competitive Target

- **Differentiator:** No other security vendor monitors AI coding agents at the
  IDE level. Wiz monitors cloud. CyberArk monitors PAM. Nobody monitors the AI
  agent running on the developer's machine right now.
- **Viral vector:** Developers share "look what my AI agent read today"
  screenshots on X / HN. Security teams forward them to CISOs.
- **Sales motion:** The extension generates the demo data. Sales call starts
  with the prospect's own logs, not a hypothetical.

---

## ⚡ MVP PATH (10 days) — VSCode Extension + CLI

### MVP.1 — New Repository: `opensyber-agent-monitor` (Day 1)

> **NOTE:** This ships as a **separate open-source repo** — not inside the
> monorepo. Reasons: (1) VS Marketplace publishing requires a standalone
> extension, (2) open-source drives trust, (3) separate npm package for CLI.

```text
opensyber-agent-monitor/
├── packages/
│   ├── vscode-extension/   ← VS Marketplace package
│   └── cli/                ← `npx opensyber-scan` + `npx tokenforge-check`
├── LICENSE                 ← MIT
└── README.md               ← "See what your AI agent did today"
```

- [ ] Create GitHub repo: `opensyber/openagent`
- [ ] Set up Turborepo + pnpm workspace
- [ ] Add MIT license (critical for developer trust)
- [ ] Write README with GIF demo (use terminalizer for recording)
- [ ] Set up CI: lint + test + `vsce package` on PR

---

### MVP.2 — VSCode Extension Core: Activity Interception (Days 2–4)

**Package:** `packages/vscode-extension/`

```typescript
// src/interceptors/file-interceptor.ts
// Hook VSCode file system watcher to detect agent file access
import * as vscode from 'vscode'

export function watchFileActivity(
  logger: ActivityLogger,
  detector: AgentDetector
): vscode.Disposable {
  return vscode.workspace.onDidOpenTextDocument(doc => {
    const agentPID = detector.getActiveAgentPID()
    if (!agentPID) return

    const risk = assessFileRisk(doc.uri.fsPath)
    logger.log({
      type: 'file_read',
      path: doc.uri.fsPath,
      risk,                      // 'critical' | 'high' | 'medium' | 'low'
      agent: detector.getAgentName(agentPID),
      timestamp: Date.now()
    })
  })
}

// Risk assessment — what the agent accessed
function assessFileRisk(filePath: string): RiskLevel {
  if (/\.env(\.|$)/i.test(filePath)) return 'critical'       // .env files
  if (/\/(id_rsa|id_ed25519|.*\.pem)$/i.test(filePath)) return 'critical' // SSH keys
  if (/\/(secrets|credentials|\.aws\/credentials)/i.test(filePath)) return 'critical'
  if (/\/(package\.json|requirements\.txt|go\.mod)/i.test(filePath)) return 'medium'
  return 'low'
}
```

```typescript
// src/interceptors/terminal-interceptor.ts
// Hook VSCode terminal to detect agent bash commands
export function watchTerminalActivity(
  logger: ActivityLogger,
  detector: AgentDetector
): vscode.Disposable {
  return vscode.window.onDidWriteTerminalData(event => {
    if (!detector.isAgentTerminal(event.terminal)) return

    const risk = assessCommandRisk(event.data)
    logger.log({
      type: 'bash_exec',
      command: event.data.trim(),
      risk,
      agent: detector.getTerminalAgent(event.terminal),
      timestamp: Date.now()
    })
  })
}

function assessCommandRisk(command: string): RiskLevel {
  if (/git push.*--force/i.test(command)) return 'high'
  if (/curl|wget|fetch/i.test(command)) return 'high'    // outbound network
  if (/rm -rf|truncate|drop table/i.test(command)) return 'critical'
  if (/npm publish|pip upload/i.test(command)) return 'high'
  if (/ssh|scp|rsync/i.test(command)) return 'high'
  return 'low'
}
```

```typescript
// src/detectors/agent-detector.ts
// Detect which AI agent is active in VSCode
export class AgentDetector {
  private knownAgents: AgentSignature[] = [
    { name: 'Cursor',      processPatterns: ['cursor', 'cursor-agent'] },
    { name: 'Cline',       processPatterns: ['cline', 'anthropic-cline'] },
    { name: 'Claude Code', processPatterns: ['claude', 'claude-code'] },
    { name: 'Devin',       processPatterns: ['devin-agent'] },
    { name: 'Copilot',     processPatterns: ['copilot-agent', 'github.copilot'] },
    { name: 'Continue',    processPatterns: ['continue', 'continue-dev'] }
  ]

  getActiveAgentPID(): number | null { /* ps aux grep */ }
  getAgentName(pid: number): string { /* match against known agents */ }
  isAgentTerminal(terminal: vscode.Terminal): boolean { /* check terminal title/env */ }
}
```

- [ ] Create `src/extension.ts` (entry point, registers all watchers)
- [ ] Create `src/interceptors/file-interceptor.ts`
- [ ] Create `src/interceptors/terminal-interceptor.ts`
- [ ] Create `src/interceptors/network-interceptor.ts` (parse curl/wget in terminal)
- [ ] Create `src/detectors/agent-detector.ts` (6 known agents)
- [ ] Create `src/logger/activity-logger.ts` (write to local SQLite via `better-sqlite3`)
- [ ] All files < 200 lines; split by responsibility
- [ ] Write unit tests for `assessFileRisk` and `assessCommandRisk`

---

### MVP.3 — VSCode Extension UI: Activity Sidebar (Days 3–5)

**What the developer sees:**

```text
┌─────────────────────────────────────────────┐
│ ○ OpenAgent — AI Activity Monitor           │
├─────────────────────────────────────────────┤
│ Today  │  7d  │  30d                        │
├─────────────────────────────────────────────┤
│ 🔴 14:32 Cursor → READ  .env               │
│         /project/.env (AWS_SECRET_KEY ×3)   │
│                                             │
│ 🟡 14:32 Cursor → EXEC  curl external       │
│         curl https://api.example.com/upload │
│                                             │
│ 🔴 14:33 Claude → WRITE auth.ts            │
│         Removed JWT validation check        │
│                                             │
│ 🟡 14:35 Cursor → EXEC  git push --force   │
│                                             │
│ 🔴 14:38 Cursor → READ  ~/.ssh/id_rsa      │
├─────────────────────────────────────────────┤
│ ⚠  5 risk events today                     │
│ 2 CRITICAL · 3 HIGH                         │
│                                             │
│ [View Full Report]  [→ OpenSyber Enterprise]│
└─────────────────────────────────────────────┘
```

- [ ] Create `src/views/activity-panel.ts` — TreeView provider
- [ ] Create `src/views/risk-badge.ts` — status bar item with risk count
- [ ] Create `src/views/event-detail.ts` — click event to expand detail
- [ ] Color coding: red=critical, amber=high, blue=medium, gray=low
- [ ] Time grouping: "just now", "14:32", grouped by hour
- [ ] "View Full Report" opens local HTML report (generated from SQLite)
- [ ] "→ OpenSyber Enterprise" opens `https://opensyber.cloud?ref=extension&event=<eventType>`
- [ ] Write component tests

---

### MVP.4 — The Upgrade Hook: Risk Event Notifications (Day 5–6)

> This is the monetization trigger. Every CRITICAL event shows a non-blocking
> notification. Not a popup — a status bar message + sidebar highlight.

```typescript
// src/notifications/risk-notifier.ts
export class RiskNotifier {
  notifyCritical(event: ActivityEvent): void {
    // Status bar flash (red for 3s, then settles to count)
    this.statusBar.flash('⚠ CRITICAL: ' + event.summary)

    // Non-blocking information message (bottom right)
    vscode.window.showInformationMessage(
      `OpenAgent: ${event.agent} accessed ${event.riskLabel}`,
      'View Details',
      'Get Enterprise Monitoring'
    ).then(selection => {
      if (selection === 'Get Enterprise Monitoring') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://opensyber.cloud?ref=extension&event=critical')
        )
      }
    })
  }
}
```

**Critical events that trigger upgrade notification:**

- Agent read `.env` containing real secrets (regex detect `KEY=`, `SECRET=`, `TOKEN=`)
- Agent read SSH private key
- Agent executed `curl` / `wget` to external domain
- Agent ran `git push --force`
- Agent modified auth/security-related files (`auth.ts`, `middleware.ts`, `jwt.ts`)

- [ ] Create `src/notifications/risk-notifier.ts`
- [ ] Create `src/notifications/secret-detector.ts` — detect secrets in file content
  - Patterns: AWS keys (`AKIA`), GitHub tokens (`ghp_`), Stripe keys (`sk_live_`), generic (`_SECRET=`, `_KEY=`, `_TOKEN=`)
  - **IMPORTANT:** Detect presence only — never log the actual secret value
- [ ] Upgrade CTA links to `opensyber.cloud` with UTM params
- [ ] Config: `opensyber.notifications.criticalOnly` (default: false)
- [ ] Write tests for secret detection (with mock secrets — never real values)

---

### MVP.5 — Local Report Generation (Day 6–7)

When user clicks "View Full Report":

```html
<!-- Generated HTML report -->
<h1>AI Agent Security Report</h1>
<p>Cursor Agent — Last 7 days</p>

<div class="summary">
  <span class="critical">12 CRITICAL events</span>
  <span class="high">34 HIGH events</span>
</div>

<table>
  <tr class="critical">
    <td>Mar 1 14:32</td>
    <td>Cursor</td>
    <td>READ .env (3 secrets detected)</td>
    <td>🔴 CRITICAL</td>
  </tr>
</table>

<div class="cta">
  <h2>Get Enterprise-Grade Protection</h2>
  <p>OpenSyber: centralized audit logs, real-time alerting, container sandboxing.</p>
  <a href="https://opensyber.cloud?ref=report">Start Free Trial →</a>
</div>
```

- [ ] Create `src/reports/html-generator.ts` — generate HTML from SQLite log
- [ ] Includes: summary stats, timeline table, per-agent breakdown, CTA section
- [ ] Export as PDF option (use Puppeteer or `@electron/remote`)
- [ ] "Share with your security team" — generates shareable link IF cloud sync enabled
- [ ] Write tests for report generation (snapshot tests)

---

### MVP.6 — CLI Tools: `opensyber-scan` + `tokenforge-check` (Days 7–9)

**Package:** `packages/cli/`

```bash
# Tool 1: Cloud security scan (no account required)
npx opensyber-scan --provider aws

# Connecting to AWS using local credentials...
# Scanning 247 resources across us-east-1, eu-west-1...
#
# CRITICAL FINDINGS (3):
#   ✗ S3 bucket 'prod-customer-data' is publicly readable
#   ✗ IAM root user has active access keys
#   ✗ Security group 'sg-web' allows 0.0.0.0:22 (SSH open to world)
#
# Security Score: 34/100 — CRITICAL
# → Get continuous monitoring: opensyber.cloud/scan-results?token=abc123
```

```bash
# Tool 2: Session security check (for SaaS CTOs)
npx tokenforge-check --url https://app.yourcompany.com

# Checking session security for app.yourcompany.com...
#
# ✗ Session token is NOT device-bound
# ✗ Cookie flagged as extractable (no httpOnly + SameSite=None)
# ✗ No step-up auth detected on account deletion flow
# ✗ Estimated hijack risk: HIGH
#
# → Fix with TokenForge: tokenforge.dev/getting-started
```

- [ ] Create `packages/cli/src/commands/scan.ts` — AWS scan via `@aws-sdk/client-*`
  - Use local `~/.aws/credentials` — no credentials stored or transmitted
  - Runs subset of Prowler checks locally (no Hetzner VM needed for CLI)
  - Results POSTed to `api.opensyber.cloud/cli/scan-results` only if user opts in
- [ ] Create `packages/cli/src/commands/tokenforge-check.ts` — session analysis
  - Fetches login page, analyzes Set-Cookie headers, checks CSP headers
  - Detects SameSite, httpOnly, Secure flags
  - Detects TokenForge presence (via `X-TF-Session` header hint)
- [ ] Create `packages/cli/src/commands/agent-scan.ts` — scan local VSCode for agent activity log
  - Reads local SQLite from extension if installed
  - Pretty-prints last 24h of agent activity in terminal
- [ ] `package.json` bin entries: `opensyber-scan`, `tokenforge-check`, `agent-scan`
- [ ] Write tests (mock AWS SDK, mock HTTP responses)

---

### MVP.7 — Cloud Sync (Optional, Opt-In) (Day 9–10)

**When user signs up for OpenSyber account:**

```typescript
// Extension sends activity logs to OpenSyber API
// User must explicitly enable: opensyber.cloudSync.enabled = true

// POST /api/v1/agent-monitor/sync
// Authorization: Bearer <opensyber_api_key>
// {
//   "events": [{ "type": "file_read", "risk": "critical",
//                "secretsDetected": 3 }],  // count only — never values
//   "machineId": "<sha256 hash — no PII>"
// }
```

**New API routes in `apps/api/src/routes/agent-monitor.ts`:**

```text
POST   /api/v1/agent-monitor/sync     — receive activity from extension
GET    /api/v1/agent-monitor/activity — list activity (auth required)
GET    /api/v1/agent-monitor/summary  — 7d/30d summary stats
DELETE /api/v1/agent-monitor/activity — GDPR: delete all user data
```

**New DB table `agent_activity`:**

```sql
CREATE TABLE agent_activity (
  id            TEXT PRIMARY KEY,
  userId        TEXT NOT NULL,
  orgId         TEXT,
  agentName     TEXT NOT NULL,         -- 'Cursor' | 'Cline' | 'Claude Code'
  eventType     TEXT NOT NULL,         -- 'file_read' | 'bash_exec' | 'network_call'
  risk          TEXT NOT NULL,         -- 'critical' | 'high' | 'medium' | 'low'
  summary       TEXT NOT NULL,         -- human-readable (no secrets)
  secretsCount  INTEGER DEFAULT 0,     -- count only, never values
  machineHash   TEXT NOT NULL,         -- sha256(machineId) — no PII
  occurredAt    TEXT NOT NULL,
  createdAt     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] Create D1 migration `0023_agent_activity.sql`
- [ ] Create `apps/api/src/routes/agent-monitor.ts` (< 200 lines)
- [ ] Sync only on explicit user consent (checked in extension settings)
- [ ] All synced data: no file contents, no secret values, no PII — only metadata
- [ ] Write tests for all 4 routes
- [ ] Add to `apps/web/src/app/dashboard/agents/` — new dashboard page showing agent activity

---

### MVP DoD Gate

Before marking Sprint 23 MVP done:

```bash
# Extension builds cleanly
cd packages/vscode-extension && vsce package
# → produces opensyber-openagent-0.1.0.vsix

# CLI works
npx packages/cli opensyber-scan --provider aws --dry-run
npx packages/cli tokenforge-check --url https://httpbin.org

# Tests pass with coverage
pnpm vitest run --coverage
# → extension: >80% line coverage
# → cli: >80% line coverage
# → api routes: >80% line coverage

# Security: secret detector never logs real secret values
# grep -r "secretValue\|secretContent\|actualSecret" src/ → 0 results

# Privacy: no data transmitted without explicit opt-in
# grep -r "fetch\|axios\|http" src/ → only in cloud-sync.ts (gated by config)
```

---

## 🔵 FULL PATH (20 days) — Enterprise Integration + Viral Loop

### FULL.1 — Team Dashboard in OpenSyber Web (Days 11–13)

New page: `apps/web/src/app/dashboard/agents/page.tsx`

```text
┌─────────────────────────────────────────────────────────┐
│ AI Agent Activity Monitor                               │
│ 3 developers connected · Last sync: 2 minutes ago      │
├─────────────────────────────────────────────────────────┤
│ Critical Events (Last 7 Days)                           │
│                                                         │
│ developer@acme.com  Cursor    .env READ    Mar 1 14:32  │
│ cto@acme.com        Cline     SSH READ     Feb 28 09:15 │
│ eng@acme.com        Claude    git --force  Feb 27 16:44 │
├─────────────────────────────────────────────────────────┤
│ By Agent          │  By Developer  │  By Risk Type      │
│ Cursor   67%      │  John  45%     │  File READ  52%    │
│ Cline    21%      │  Sarah 32%     │  Bash EXEC  31%    │
│ Claude   12%      │  Mike  23%     │  Network    17%    │
└─────────────────────────────────────────────────────────┘
```

- [ ] Create `apps/web/src/app/dashboard/agents/page.tsx`
- [ ] Create `apps/web/src/app/dashboard/agents/[userId]/page.tsx` — per-developer detail
- [ ] Create `apps/web/src/components/dashboard/AgentActivityTable.tsx`
- [ ] Create `apps/web/src/components/dashboard/AgentRiskChart.tsx`
- [ ] Create `apps/web/src/app/api/proxy/agent-monitor/route.ts`
- [ ] Alert rule integration: "Notify me when any developer's agent reads .env"
- [ ] Requires `orgId` + `cloud sync` enabled on developer machines
- [ ] Write tests

### FULL.2 — GitHub App: Repository Agent Scan (Days 13–15)

- [ ] Register GitHub App: "OpenSyber Security Scanner"
- [ ] On PR open: scan diff for hardcoded secrets + vulnerable patterns
- [ ] Post inline PR comment: "AI agent introduced potential secret exposure at line 42"
- [ ] GitHub App webhook handler: `apps/api/src/routes/github-app.ts`
- [ ] Uses existing `secret-detector.ts` logic from VSCode extension
- [ ] Free for public repos; Pro required for private repos
- [ ] Write tests (mock GitHub webhook payloads)

### FULL.3 — Viral Shareable Report (Days 15–17)

- [ ] Extension "Share" button → POST activity summary to OpenSyber API
- [ ] Generates public URL: `opensyber.cloud/report/abc123` (no account required)
- [ ] Report page shows: agent name, risk counts, event timeline (redacted paths)
- [ ] Twitter/X card metadata for viral sharing
- [ ] "Is your team running AI agents unmonitored?" CTA on shared report
- [ ] Expiry: 7 days (then deleted — privacy-first)
- [ ] Write tests

### FULL.4 — SIEM Integration (Days 17–19)

When enterprise signs up, agent activity feeds into their SIEM:

```text
opensyber.cloud → Splunk / Datadog / Elastic / Sentinel
via:
- Webhook push (real-time)
- Syslog drain (batch)
- S3/R2 export (daily)
```

- [ ] Create `apps/api/src/services/siem-export.ts` — format agent events as CEF/JSON
- [ ] Add to existing webhook infrastructure (Sprint 19 webhook schema)
- [ ] Splunk HEC endpoint support
- [ ] Datadog Logs API support
- [ ] Test with mock SIEM endpoints

### FULL.5 — VS Marketplace Launch (Day 20)

- [ ] Publish to VS Marketplace as free extension
- [ ] Marketplace page: screenshots, GIF demo, "10,000+ developers trust OpenAgent"
- [ ] Product Hunt launch coordinated with VS Marketplace publish
- [ ] HN "Show HN" post prepared
- [ ] X/Twitter thread by Shachar showing personal agent logs (viral moment)
- [ ] README badges: marketplace installs, GitHub stars, license

---

## Distribution Playbook

### Week 1: Soft Launch (Extension Published)

1. Post in VSCode subreddit: "I built a tool to see what Cursor/Cline actually does on my machine"
2. X thread: "I installed OpenAgent and ran Cursor for a day. Here's what it accessed..."
3. HN Show HN: "OpenAgent – Open-source monitor for AI coding agents"
4. Dev.to article: "Your AI coding agent read your SSH key. Here's proof."

### Week 2–4: Security Community

1. Forward viral posts to CISO email lists and security newsletters
2. Sponsor a developer security newsletter (TLDR Sec, Unsupervised Learning)
3. "Enterprise Security" edition blog post with compliance angle
4. Reach out to 10 security podcasts with demo

### Week 4+: Enterprise Sales Motion

1. Sales deck slide 1: "Install our free extension. Run your AI agent for an hour."
2. Sales deck slide 2: *[Screenshot of their actual logs]*
3. Sales deck slide 3: "OpenSyber contains, audits, and alerts on all of this at scale."

---

## Connection to OpenSyber Platform

| Extension Feature | Platform Feature | Upgrade Trigger |
| --- | --- | --- |
| Local activity log | Centralized team dashboard | "Share with team" → requires account |
| Risk event notification | Real-time Slack/PagerDuty alert | "Set up alerts" → requires Pro |
| Local risk count | Compliance audit report (PDF) | "Export for audit" → requires Enterprise |
| Basic agent detection | Container sandboxing + auto-suspend | "Enforce containment" → requires Enterprise |
| File path logging | SIEM integration | "Send to Splunk" → requires Enterprise |
| CLI scan (one-time) | Continuous CSPM scanning (Sprint 11) | "Monitor continuously" → requires account |

---

## Security & Privacy Non-Negotiables

- **NEVER** log the content of files — only path + risk classification
- **NEVER** log actual secret values — only count of secrets detected (pattern match)
- **NEVER** transmit data without explicit user opt-in per session
- **ALWAYS** store local SQLite in `~/.opensyber/activity.db` (user-owned)
- **ALWAYS** provide `DELETE /api/v1/agent-monitor/activity` (GDPR right to erasure)
- **ALWAYS** open-source the extension code — security through transparency
- Secret detection patterns must be tested against mock secrets (never real credentials)

---

## File Size Budget

```text
packages/vscode-extension/src/
├── extension.ts               ← 80 lines (entry, registers watchers)
├── interceptors/
│   ├── file-interceptor.ts    ← 120 lines
│   ├── terminal-interceptor.ts ← 100 lines
│   └── network-interceptor.ts ← 80 lines
├── detectors/
│   └── agent-detector.ts      ← 150 lines
├── logger/
│   └── activity-logger.ts     ← 120 lines
├── notifications/
│   ├── risk-notifier.ts       ← 100 lines
│   └── secret-detector.ts     ← 150 lines
├── views/
│   ├── activity-panel.ts      ← 180 lines
│   ├── risk-badge.ts          ← 60 lines
│   └── event-detail.ts        ← 80 lines
├── reports/
│   └── html-generator.ts      ← 180 lines
└── sync/
    └── cloud-sync.ts          ← 120 lines

packages/cli/src/
├── index.ts                   ← 40 lines
└── commands/
    ├── scan.ts                ← 180 lines
    ├── tokenforge-check.ts    ← 150 lines
    └── agent-scan.ts          ← 100 lines

apps/api/src/routes/
└── agent-monitor.ts           ← 180 lines
```

All files < 200 lines. ✓

---

## Milestone

After Sprint 23 MVP:

- **VS Marketplace:** Extension published, free, open-source
- **npm:** `npx opensyber-scan` and `npx tokenforge-check` available
- **OpenSyber dashboard:** New "Agent Activity" page for Pro/Enterprise users
- **Sales motion:** Demo call script uses prospect's own extension data

After Sprint 23 Full:

- **GitHub App:** PR scanning for secrets
- **SIEM integration:** Splunk + Datadog pipeline
- **Viral loop:** Shareable reports with upgrade CTA
- **VS Marketplace ranking:** Target top 50 security extensions

---

## 🌐 Multi-Platform Expansion (Sprint 23b)

The VSCode extension is the **foundation**. These surfaces extend the same
"proof of insecurity" message to every audience that enterprise security
decisions touch — not just developers.

---

### Platform A — JetBrains Marketplace (IntelliJ / PyCharm / GoLand)

**Why:** Enterprise Java, Python, Kotlin, Go teams use JetBrains IDEs almost
exclusively. These are the developers inside banks, healthcare, and government.
Same product, different packaging.

**Effort:** ~3 days — reuse 80% of the VSCode extension core logic.
JetBrains plugins are Kotlin/Java but the activity detection logic is identical.

```text
opensyber-agent-monitor/
└── packages/
    ├── vscode-extension/     ← existing
    ├── jetbrains-plugin/     ← NEW — Kotlin wrapper, same ActivityLogger core
    └── shared-core/          ← extract shared TypeScript/Node detection logic
```

- [ ] Create `packages/jetbrains-plugin/` as a Gradle project
- [ ] Implement `OpenAgentFileListener` (IntelliJ VFS listener)
- [ ] Implement `OpenAgentConsoleFilter` (terminal command capture)
- [ ] Reuse `shared-core/secret-detector` (via Node.js subprocess call)
- [ ] Same sidebar UI pattern: risk events timeline + upgrade CTA
- [ ] Publish to JetBrains Marketplace — 15M+ users
- [ ] JetBrains-specific CTA: links to opensyber.cloud with `?ref=jetbrains`

---

### Platform B — Chrome / Edge / Firefox Browser Extension

**Why:** The browser is where developers use Claude.ai, ChatGPT, Perplexity,
and where CISOs review dashboards. A browser extension can monitor:

1. **What you share with AI tools** — detect if developers paste credentials
   into Claude.ai or ChatGPT (DLP for AI prompts)
2. **Session security** — TokenForge angle: is this SaaS app's session
   device-bound? Shows the "session hijack risk" score for any site you visit

**Two modes — same extension, toggle in settings:**

#### Mode 1: AI Prompt DLP (Data Loss Prevention)

```text
[OpenAgent] ⚠ Potential secret detected in ChatGPT prompt
           You appear to be pasting content that matches
           a secret pattern (API key format detected).

           [Cancel paste]  [Share anyway]  [Learn more]
```

Intercepts `paste` events on Claude.ai, ChatGPT, Perplexity, Gemini tabs.
Detects secret patterns in clipboard content before it's sent to the AI.
Logs: "User shared potential API key with Claude.ai" → CISO dashboard.

#### Mode 2: Session Security Inspector (TokenForge angle)

```text
[OpenAgent]  opensyber.cloud
            Session security: ⚠ NOT device-bound
            Cookie extractable: YES
            Risk level: HIGH

            → Protect with TokenForge
```

Shows a toolbar icon on every site with the session security grade (A–F).

```typescript
// content-script.ts — runs on every page
function checkSessionSecurity(): SessionReport {
  const cookies = document.cookie
  const headers = performance.getEntriesByType('navigation')

  return {
    isDeviceBound: hasTokenForgeHeader(),   // X-TF-Session present?
    cookieFlags: analyzeCookieFlags(cookies),
    hasSameSite: checkSameSite(cookies),
    hasHSTS: checkHSTSHeader(),
    riskLevel: computeRisk()
  }
}
```

- [ ] Create `packages/browser-extension/` (Chrome Manifest V3)
- [ ] Implement `src/content/prompt-dlp.ts` — paste interception on AI sites
- [ ] Implement `src/content/session-inspector.ts` — session security check
- [ ] Implement `src/popup/` — toolbar popup showing current site's security grade
- [ ] Implement `src/background/sync.ts` — optional cloud sync of DLP events
- [ ] Publish to Chrome Web Store (free)
- [ ] Publish to Edge Add-ons (same build — just resubmit)
- [ ] Publish to Firefox Add-ons (`browser` polyfill already available)
- [ ] Write tests (content script unit tests via vitest + jsdom)

**Monitored AI sites:** claude.ai, chatgpt.com, perplexity.ai, gemini.google.com,
copilot.microsoft.com, character.ai, poe.com

---

### Platform C — Anthropic MCP Server (Claude Integration)

**Why:** The Model Context Protocol (MCP) lets Claude query external data
sources mid-conversation. OpenSyber builds an MCP server so any Claude user
can ask: "What's my security posture?" and get real answers from their
OpenSyber account.

**Already planned in Sprint 16** — this is the distribution angle on top of it.

```text
User in Claude.ai desktop:
"Show me my critical cloud findings for this week"

Claude → MCP → opensyber-mcp-server → OpenSyber API
       ← Returns: 3 CRITICAL findings with remediation steps
```

**Distribution:** Anthropic publishes verified MCP servers to their directory.
OpenSyber gets listed as an official MCP integration.

```typescript
// Already in Sprint 16 plan — apps/api/src/routes/mcp.ts
// MCP Tools exposed:
const tools = [
  "get_risk_score",           // "What's my org's risk score?"
  "list_critical_findings",   // "Show me critical issues"
  "get_attack_paths",         // "What are my attack paths?"
  "get_compliance_status",    // "Am I SOC2 compliant?"
  "explain_finding",          // "Explain this finding"
  "trigger_remediation"       // "Fix the public S3 bucket"
]
```

- [ ] Register OpenSyber in Anthropic MCP directory (after Sprint 16 ships)
- [ ] Write MCP server README for developer discovery
- [ ] Add `mcp.json` manifest with capabilities declaration
- [ ] Test with Claude desktop app end-to-end
- [ ] Add MCP install snippet to OpenSyber onboarding flow

---

### Platform D — OpenAI GPT Store (Custom GPT)

**Why:** The ChatGPT Plus GPT Store has millions of users. A free "OpenSyber
Security Auditor" custom GPT drives signups without any engineering.

**What it does:**

```text
User: "Analyze my AWS security posture"
GPT:  "Please connect your OpenSyber account or paste your
       AWS config below. I'll run a security analysis..."

User: [pastes AWS config excerpt]
GPT:  "I found 3 critical issues:
       1. Root account has active access keys
       2. S3 bucket 'prod-data' is public
       3. No MFA on 4 IAM users

       Get continuous monitoring at opensyber.cloud →"
```

**Implementation:** Custom GPT with Actions that call `api.opensyber.cloud`.
Free tier: 3 scans/day. Requires account for more.

- [ ] Create Custom GPT in OpenAI platform
- [ ] Write GPT system prompt (security auditor persona)
- [ ] Create GPT Actions spec pointing to OpenSyber's API
- [ ] Add rate limiting: `POST /api/v1/gpt/analyze` (3 free/day, account required for more)
- [ ] Upgrade CTA in every GPT response
- [ ] Submit to GPT Store (review process takes ~1 week)
- [ ] Monitor: conversion rate from GPT → account signup

---

### Platform E — Azure Marketplace

**Why:** Enterprise IT procurement teams buy security tools from Azure
Marketplace using existing Azure credits. Being listed here gives instant
access to enterprise buyers who have budget pre-approved for Azure spend.

**Listing type:** SaaS offer (not container, not VM — keeps deployment on
OpenSyber's infra, billing routed through Azure).

**What it does:**

1. Enterprise buyer finds "OpenSyber" on Azure Marketplace
2. Clicks "Get it now"
3. Azure handles billing (charged to their Azure subscription)
4. User is redirected to `opensyber.cloud/azure-onboarding?token=xyz`
5. Account created, org provisioned, Azure billing linked

```text
Revenue split: Microsoft takes 3% on Azure Marketplace transactions.
Benefit: Enterprise sales cycle from 6 months → 2 weeks because
         IT already approved Azure spend.
```

- [ ] Register as Microsoft ISV partner (`partner.microsoft.com`)
- [ ] Create Azure Marketplace SaaS offer listing
- [ ] Implement `apps/api/src/routes/azure-marketplace.ts`:
  - `POST /azure/subscribe` — Azure subscription activation webhook
  - `POST /azure/unsubscribe` — cancellation webhook
  - `POST /azure/suspend` — payment failure
  - `GET  /azure/landing` — post-purchase redirect handler
- [ ] Azure-specific onboarding flow in `apps/web/src/app/onboarding/azure/`
- [ ] Add Azure billing as a LemonSqueezy alternative (pass-through)
- [ ] Write integration tests (mock Azure webhook payloads)

---

### Platform F — AWS Marketplace

**Why:** Same as Azure but for AWS-native organizations. Many security teams
at cloud-native companies have AWS credits/budgets that can be applied to
Marketplace purchases.

**Listing type:** SaaS subscription (same architecture as Azure).

- [ ] Register as AWS ISV partner (`aws.amazon.com/partners/`)
- [ ] Create AWS Marketplace SaaS listing
- [ ] Implement `apps/api/src/routes/aws-marketplace.ts` — similar to Azure routes
- [ ] AWS-specific onboarding flow
- [ ] Test with AWS Marketplace sandbox environment

---

### Platform G — Microsoft Teams App (+ Copilot Extension)

**Why:** Security teams live in Teams. Compliance alerts in Teams channels
close the loop on the "enterprise notification" story. Also: Microsoft 365
Copilot extensions are a new distribution channel inside enterprise M365
tenants — the same CTOs you're selling to already have Copilot.

#### Teams App (already partially built via Sprint 10 notification channels)

```text
Security Alert from OpenSyber
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CRITICAL: S3 bucket 'prod-data' publicly readable
   Risk Score: 94/100
   Affected: 3 compliance controls (SOC2 CC6.2, PCI 3.4)

   [View Details]  [Run Remediation]  [Mute 24h]
```

#### M365 Copilot Extension (new)

```text
Employee in Teams: "@Copilot, what's our security score?"
Copilot → OpenSyber M365 extension → api.opensyber.cloud
        ← "Your organization's risk score is 67/100.
            3 critical findings need attention. [View report]"
```

- [ ] Publish Teams App to Microsoft AppSource (Teams app store)
- [ ] Extend existing Teams webhook service to use Teams Adaptive Cards
- [ ] Create M365 Copilot extension manifest (`manifest.json` with capabilities)
- [ ] Implement `GET /api/v1/copilot/summary` — brief security status for Copilot
- [ ] Write tests (mock Teams webhook delivery)
- [ ] Submit to AppSource review (2–3 week review process)

---

### Platform H — Slack App Directory

**Why:** Already have Slack webhook support (Sprint 10). Formalizing it as a
listed Slack App gives discovery inside Slack's app directory — which many
security teams browse when setting up security tooling.

**Already built:** Slack notification channel in Sprint 10.

**What's new:** Official Slack App listing + OAuth install flow (vs. manual
webhook URL configuration today).

```text
Slack OAuth flow:
1. User clicks "Add to Slack" on opensyber.cloud
2. Slack OAuth → OpenSyber gets workspace + channel access
3. OpenSyber automatically configures notification channel
4. Welcome message: "OpenSyber is now monitoring your security posture"
```

- [ ] Register OpenSyber Slack App in Slack API console
- [ ] Implement Slack OAuth flow: `GET /api/v1/integrations/slack/oauth`
- [ ] Implement Slack event subscriptions (slash commands: `/opensyber status`)
- [ ] Submit to Slack App Directory (enterprise tier gets "Reviewed by Slack" badge)
- [ ] Write integration tests (mock Slack OAuth + event payloads)

---

### Platform I — Raycast Extension

**Why:** Raycast is the default power tool for CTOs and senior developers at
startups and scale-ups. A Raycast extension makes OpenSyber accessible from
the command bar — instant security check without opening a browser.

```text
User presses ⌘ Space → types "security"

OpenSyber: Risk Score
  ┌────────────────────────────────────┐
  │  Your Org Risk Score: 67/100       │
  │  3 CRITICAL · 12 HIGH              │
  │  Last scan: 4 minutes ago          │
  │                                    │
  │  → View Critical Findings          │
  │  → Run New Scan                    │
  │  → Open Dashboard                  │
  └────────────────────────────────────┘
```

- [ ] Create `packages/raycast-extension/` using `@raycast/api`
- [ ] Commands: `Security Score`, `Critical Findings`, `Run Scan`, `Agent Activity`
- [ ] Calls `api.opensyber.cloud` using stored API key (Raycast preferences)
- [ ] Publish to Raycast Store (free, instant approval)
- [ ] Write extension tests

---

### Platform J — WhatsApp Business API

**Why:** WhatsApp has 3 billion users. Enterprise CISOs in **Europe, Middle
East, Southeast Asia, and LatAm** use WhatsApp Business as their primary
business communication channel — markets where Slack penetration is low.
No other security vendor delivers alerts via WhatsApp. That is the moat.

**The alert format:**

```text
[OpenSyber] 🔴 CRITICAL ALERT — Acme Corp

S3 bucket 'prod-backups' has been publicly
readable for 6 hours.

Risk Score: 94/100
Affected: SOC2 CC6.2, PCI DSS 3.4

→ Remediate: opensyber.cloud/r/abc123
→ Mute 24h: reply MUTE
→ Assign: reply ASSIGN @john
```

**How the sales loop closes:**

The remediation link (`/r/abc123`) opens a **public finding page** — no login
required to read it. To take action (run remediation, mute, assign) the user
must create an account. CISO forwards the WhatsApp message to their security
team in one tap → team clicks link → 3 signups from one alert.

**Architecture:** Add `whatsapp` as a new notification channel type alongside
`slack`, `pagerduty`, `teams` (already built in Sprint 10).

```typescript
// apps/api/src/services/notifications/whatsapp.ts
// Uses Meta Business API (Cloud API) — no WhatsApp server hosting needed

export async function sendWhatsAppAlert(
  channel: NotificationChannel,
  event: SecurityEvent
): Promise<void> {
  // channel.config: { phoneNumberId, recipientPhone, accessToken }
  await fetch(
    `https://graph.facebook.com/v18.0/${channel.config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channel.config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: channel.config.recipientPhone,
        type: 'template',
        template: {
          name: 'opensyber_security_alert',
          language: { code: 'en_US' },
          components: [
            { type: 'header', parameters: [{ type: 'text', text: event.orgName }] },
            { type: 'body',   parameters: buildAlertParams(event) },
            { type: 'button', sub_type: 'url', parameters: [{ type: 'text', text: event.remediationToken }] }
          ]
        }
      })
    }
  )
}
```

**Inbound command handling:**

Users reply `MUTE`, `ASSIGN @name`, or `SNOOZE 4h` — the WhatsApp webhook
parses these and calls the appropriate OpenSyber API action. Same pattern as
existing Slack slash commands.

**DB — extend notification channel config:**

```sql
-- No schema change needed: channel.config JSON already stores provider config
-- New channel type: 'whatsapp'
-- config: { phoneNumberId, recipientPhone, accessToken, templateName }
```

- [ ] Register Meta Business Account + WhatsApp Business API access
- [ ] Create approved message templates (Meta requires pre-approval for business templates)
- [ ] Create `apps/api/src/services/notifications/whatsapp.ts` (< 200 lines)
- [ ] Add `'whatsapp'` to `NotificationChannelType` union in `packages/shared/`
- [ ] Handle inbound webhook: `POST /api/v1/webhooks/whatsapp` — parse replies
- [ ] Add WhatsApp channel option to `CreateNotificationChannelForm.tsx`
- [ ] Test with Meta WhatsApp API sandbox (free for testing)
- [ ] Write tests for send + inbound reply parsing

**Distribution bonus:** Build a public "Add OpenSyber to WhatsApp" QR code
page at `opensyber.cloud/whatsapp`. CISOs scan it, get a welcome message,
and receive a free 24h security scan report. This is the WhatsApp version of
the "free cloud scan" PLG hook.

---

### Platform K — Claude Code Skills Repo

**Why:** Claude Code's skill system lets users install reusable slash commands
and hooks from any GitHub URL. An official `opensyber` Claude Code skill is
**self-referential**: OpenSyber monitors AI agents, and the skill makes Claude
Code monitor *itself* — logging its own file edits, bash commands, and tool
calls to the OpenSyber activity dashboard.

HN headline: *"I made Claude Code report its own security behavior."*

**What the skill adds to Claude Code:**

```text
Slash commands:
  /security-report   → show today's risk events from this Claude session
  /agent-audit       → full activity log (file reads, bash commands, API calls)
  /check-secrets     → scan current working directory for exposed credentials

Hooks (automatic):
  PostToolUse:Edit   → log file path + risk classification
  PostToolUse:Bash   → log command + risk classification
  PostToolUse:Write  → log new file creation + secret scan
  SessionEnd         → POST summary to OpenSyber API (if cloud sync enabled)
```

**Install:** One command adds it to any Claude Code session:

```bash
# In Claude Code:
/skill-installer opensyber/openagent

# Or add manually to ~/.claude/settings.json:
# "skills": ["https://github.com/opensyber/claude-skills/main/openagent.md"]
```

**Skill file structure** (new public repo: `github.com/opensyber/claude-skills`):

```text
opensyber/claude-skills/
├── openagent.md          ← main skill: activity monitor + slash commands
├── security-scan.md      ← /security-scan: run opensyber-scan CLI in session
├── tokenforge-check.md   ← /tf-check: session security check on current site
└── README.md             ← "OpenSyber skills for Claude Code"
```

**`openagent.md` skill definition:**

```markdown
# OpenAgent — AI Activity Monitor for Claude Code

## Description
Monitor Claude Code's file edits, bash commands, and tool calls.
Log security events to OpenSyber (optional cloud sync).

## Slash Commands

### /security-report
Show today's security events from this Claude Code session.
Reads from ~/.opensyber/activity.db (local SQLite).

### /agent-audit
Full activity log for current session.
Format: timestamp | type | path | risk_level

### /check-secrets
Scan current working directory for exposed credentials.
Uses opensyber-scan CLI patterns: AKIA, ghp_, sk_live_, etc.

## Hooks

### PostToolUse:Edit
Log: file path, risk classification (critical/high/medium/low)
Never log: file contents, secret values

### PostToolUse:Bash
Log: command summary, risk classification
Never log: command output, environment variables

### SessionEnd
If OPENSYBER_API_KEY is set: POST session summary to API.
Summary includes: event counts by risk, no file contents.
```

- [ ] Create GitHub repo `opensyber/claude-skills` (public, MIT)
- [ ] Write `openagent.md` skill with all hooks + slash commands
- [ ] Write `security-scan.md` — wraps `npx opensyber-scan` in Claude context
- [ ] Write `tokenforge-check.md` — session security check
- [ ] Add install instructions to OpenSyber onboarding flow
- [ ] Add README with "Install in 30 seconds" GIF
- [ ] Submit to Claude Code community skills registry when available
- [ ] Hook `PostToolUse:Bash` reads from the same `activity-logger.ts` as VSCode extension
- [ ] Hook `SessionEnd` calls `POST /api/v1/agent-monitor/sync` (same endpoint as extension)
- [ ] Write integration tests (mock Claude Code hook payloads)

**The meta play:** Claude Code users who install the skill see OpenSyber in
their workflow every day. When they join a company with a security team, they
recommend OpenSyber. Bottom-up enterprise adoption via the individual developer.

---

### Platform L — LinkedIn

**Why:** LinkedIn is the platform where CISOs, VPs of Security, and security
architects make buying decisions. Security content goes viral on LinkedIn in a
way it does not on Twitter/X. One "I monitored my AI agent for a week and
found this" post from a respected CISO or security engineer can generate
hundreds of enterprise inbound leads — none of the other platforms reach this
audience as directly.

**The audience is already there:** 1 billion LinkedIn members, ~15M
self-identified security professionals. Every CISO you want to reach is on
LinkedIn and checks it daily.

**The key is the viral share loop — not ads.**

#### 1. "Share Your Security Score" Feature

Build a one-click "Share to LinkedIn" button on the OpenSyber security report
page and the free scan result page. When a user clicks it:

```text
User clicks "Share to LinkedIn" on their OpenSyber report
→ Opens LinkedIn Share dialog pre-filled with:

"Just ran @OpenSyber on my AI agent setup.

🔴 CRITICAL: Agent read .env files 47 times today
🟡 HIGH: 3 bash commands matched privilege escalation patterns
🟢 LOW: Network calls all went to expected endpoints

Security Score: 34/100

This is what AI agents are doing without monitoring.
Free scan → opensyber.cloud/scan  #AIAgentSecurity #CISO #AppSec"
```

The numbers make it real. CISOs share this because it makes them look sharp,
not because OpenSyber paid them. This is the Socket.dev / Wiz pattern for
LinkedIn.

**Technical implementation (tiny lift):**

```typescript
// apps/web/src/app/dashboard/report/share-linkedin.ts
// LinkedIn Share API — no OAuth required for basic share

export function buildLinkedInShareUrl(report: SecurityReport): string {
  const text = buildShareText(report)  // pre-filled post text
  const url  = `https://opensyber.cloud/r/${report.publicToken}`

  return (
    `https://www.linkedin.com/sharing/share-offsite/` +
    `?url=${encodeURIComponent(url)}` +
    `&summary=${encodeURIComponent(text)}`
  )
}
```

No LinkedIn developer account needed for the share URL pattern — it uses
LinkedIn's public share endpoint. Zero backend work required.

- [ ] Add "Share to LinkedIn" button on `SecurityReportPage` and `FreeScanResultPage`
- [ ] Write `buildShareText(report)` — generates punchy pre-filled post copy
- [ ] Track `?ref=linkedin-share` UTM on the inbound link for attribution
- [ ] Add LinkedIn icon to the existing ShareButtons component

#### 2. Content Playbook (Founder + Team Publishing)

LinkedIn's algorithm rewards consistent original content. The content strategy
is the same "proof of insecurity" concept applied as articles:

```text
Post cadence (2–3x per week):
  "What I found when I monitored Claude Code for 24 hours" → case study
  "The 3 ways AI coding agents leak secrets (with real patterns)" → education
  "We scanned 100 AI agent sessions. Here's what we found" → data drop
  "Your SOC2 auditor will ask about AI agents in 2026" → urgency
  "We built what CrowdStrike charges $200K/year for. It's free." → pricing shock
```

Each post ends with: "Free scan: opensyber.cloud/scan — no account required"

This is not an engineering task — but it belongs in the sprint doc because the
distribution surface requires coordinated content to activate it.

#### 3. LinkedIn Lead Gen Forms (Targeted Ads — Later Phase)

Once organic content is validated, run **LinkedIn Lead Gen ads** targeting:

```text
Job titles:   CISO, VP Security, Head of AppSec, Security Architect
Company size: 500–50,000 employees
Industry:     Financial Services, Healthcare, SaaS, Technology

Ad creative:  "What did your AI coding agent do today?
               Get a free 24-hour activity report — no account required."

Form fields:  First name, Last name, Work email, Company
→ Auto-creates OpenSyber account + triggers welcome email with scan link
```

LinkedIn Lead Gen forms convert 2–3× better than external landing pages for
B2B because members don't leave LinkedIn to fill them out. This is an enterprise
sales motion, not a developer adoption motion.

- [ ] Set up LinkedIn Company Page (opensyber.cloud/linkedin)
- [ ] Set up LinkedIn Campaign Manager (for later paid phase)
- [ ] Add LinkedIn share button to public report pages
- [ ] Add `?ref=linkedin-share` UTM tracking to all LinkedIn outbound links
- [ ] Write first 10 post drafts (founder publishes, tracks engagement)
- [ ] Define ICP (Ideal Customer Profile) targeting parameters for future ads

#### 4. LinkedIn as the CISO Outreach Channel

The free scan generates a report. The report is the conversation opener.

```text
Sales motion:
1. Prospect runs free scan → gets score (e.g. 34/100)
2. OpenSyber sales rep finds CISO of the prospect's company on LinkedIn
3. InMail: "Hi Sarah — saw you lead security at Acme. One of your team
   ran our free AI agent scan and got a score of 34/100. Thought you'd
   want to see the full report. 15 min call?"
4. CISO replies — they already have skin in the game (their team's data)
```

This converts because the conversation is not cold. It opens with the
prospect's own security data. LinkedIn Sales Navigator makes the CISO lookup
a 30-second task.

- [ ] Set up LinkedIn Sales Navigator (sales team tool — not engineering)
- [ ] Write InMail template library (triggered by scan → no account conversion)
- [ ] Track scan-to-InMail conversion in OpenSyber CRM integration (later Sprint)

---

## Platform Priority & Sequencing

**The key insight:** not all surfaces are equal effort-to-impact ratio.

| Platform | Effort | Audience Reach | Enterprise Impact | When |
| --- | --- | --- | --- | --- |
| VSCode Extension | 10 days | 20M devs | HIGH (devs → CTOs) | Sprint 23 MVP |
| npm CLI | 2 days | 10M devs | MEDIUM (engineers) | Sprint 23 MVP |
| LinkedIn Share Button | 0.5 days | 1B professionals | VERY HIGH (CISOs) | Sprint 23 MVP |
| Chrome Extension | 5 days | 3B users | HIGH (DLP + sessions) | Sprint 23 FULL |
| JetBrains Plugin | 3 days | 15M enterprise devs | HIGH (banks/healthcare) | Sprint 23 FULL |
| OpenAI GPT Store | 1 day | 100M ChatGPT users | MEDIUM (bottom-up) | Sprint 23 FULL |
| Anthropic MCP | 1 day | Claude users | HIGH (AI-native teams) | After Sprint 16 |
| Slack App | 3 days | 20M biz users | HIGH (security teams) | Sprint 23 FULL |
| WhatsApp Business | 3 days | 3B users (EMEA/LatAm) | HIGH (CISO mobile-first) | Sprint 23 FULL |
| Claude Code Skills | 1 day | Claude Code users | HIGH (bottom-up viral) | Sprint 23 FULL |
| Azure Marketplace | 5 days | Enterprise IT | VERY HIGH (pre-approved budget) | Sprint 24 |
| AWS Marketplace | 3 days | Cloud teams | VERY HIGH | Sprint 24 |
| Teams App | 4 days | 320M biz users | HIGH (enterprise) | Sprint 24 |
| Raycast Extension | 2 days | 1M power users | MEDIUM (influencers) | Sprint 24 |

**Rule:** Build surfaces in order of (enterprise impact × effort ratio).
LinkedIn share button is the highest ROI item — 0.5 days of effort, reaches
the exact buyer. VSCode + LinkedIn + Chrome + Slack first. Azure + AWS second.

---

## Updated Milestone

After Sprint 23 MVP (10 days):

- VSCode Extension live on VS Marketplace
- npm CLI tools published
- LinkedIn "Share Your Score" button live on all report pages
- OpenSyber dashboard "Agent Activity" page live
- Sales motion ready: demo call uses prospect's own logs

After Sprint 23 Full (20 days):

- Chrome/Edge/Firefox browser extension live
- JetBrains plugin published
- OpenAI Custom GPT in GPT Store
- Anthropic MCP server listed (after Sprint 16)
- Slack App Directory listing
- WhatsApp Business API channel live
- Claude Code Skills repo published (`opensyber/claude-skills`)
- GitHub Marketplace App (PR scanning)
- SIEM pipeline (Splunk + Datadog)
- LinkedIn content cadence launched (first 10 posts drafted)

After Sprint 24 (enterprise marketplaces):

- Azure Marketplace SaaS offer live
- AWS Marketplace SaaS listing live
- Microsoft Teams App + Copilot extension
- Raycast Extension published
- LinkedIn Lead Gen ad campaign live (paid amplification)
- LinkedIn Sales Navigator workflow live (scan-to-InMail pipeline)
- **Total addressable surface:** every surface where enterprise security
  decisions happen — IDE, browser, marketplace, AI platform, mobile, social
