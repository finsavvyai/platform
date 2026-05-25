# OpenAgent — AI Agent Activity Monitor

**See exactly what your AI coding agent does to your filesystem and terminal — in real time.**

Cursor, Cline, Claude Code, GitHub Copilot, and Devin are powerful. But they run autonomously, reading sensitive files, executing shell commands, and touching credentials you didn't know about. OpenAgent makes the invisible visible.

---

## Features

- **Real-time file monitoring** — Flags every file your AI agent opens, classified by risk (CRITICAL / HIGH / MEDIUM / LOW)
- **Terminal command interception** — Detects dangerous commands: `curl | bash`, `cat .env`, `printenv`, `sudo`, `aws iam`, `kubectl exec`, and more
- **Secret pattern detection** — Counts AWS keys, GitHub tokens, OpenAI keys, Stripe secrets, and private key blocks in files read — values are never logged
- **Per-agent breakdown** — Separates activity by Cursor, Cline, Claude Code, Copilot, and custom agents
- **Security risk score** — 0–100 score per session with contextual risk narrative
- **One-click HTML report** — Full audit report with activity timeline, score card, and shareable LinkedIn scorecard image
- **Zero cloud required** — All data stays in `~/.opensyber/activity.jsonl` on your machine

---

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open any project — the **OpenAgent** panel appears in the sidebar
3. Use Cline, Cursor Agent, or any AI coding assistant as normal
4. Watch activity appear in real time; get notified on CRITICAL events
5. Click **View Report →** to generate a full security audit HTML report

---

## Risk Levels

| Level | Examples |
|---|---|
| 🔴 **CRITICAL** | `.env`, `.aws/credentials`, SSH keys, `.pem`, `secrets.yaml`, `printenv`, `curl \| bash` |
| 🟠 **HIGH** | `.npmrc`, `kubeconfig`, `terraform.tfvars`, `sudo`, `aws iam`, `kubectl exec`, `gpg` |
| 🟡 **MEDIUM** | `package.json`, `Dockerfile`, `docker-compose.yml`, `npm install`, `docker run` |
| ⚪ **LOW** | `.ts`, `.tsx`, `.md`, `git status`, `ls`, `tsc` — suppressed by default |

---

## Security Report

Click **View Report** in the sidebar to open a full HTML report in your browser:

- **Risk score ring** (0–100) with color-coded verdict
- **Per-agent breakdown** showing critical/high counts per tool
- **Activity timeline** — last 200 events with risk level, type, summary, and timestamp
- **LinkedIn share card** — downloadable SVG scorecard + pre-written post text for one-click sharing

---

## Privacy

- **No file contents are ever read, stored, or transmitted.** Only file paths and command strings are analyzed.
- **Secret values are never logged.** Only the count and category of detected patterns are recorded.
- All activity is stored locally at `~/.opensyber/activity.jsonl` (auto-pruned to 2,000 lines).
- Cloud sync is opt-in and requires an explicit API key in settings.

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `openagent.enableCloudSync` | `false` | Sync anonymised metadata to OpenSyber dashboard |
| `openagent.apiKey` | `""` | API key from opensyber.cloud/settings |
| `openagent.notifyCritical` | `true` | Show notification on CRITICAL risk events |

---

## Requirements

- VS Code **1.93.0** or later (required for shell integration command interception)
- macOS, Linux, or Windows

---

## Team Visibility

Want to see every agent across your entire team? Set security policies, get Slack alerts, and export for SOC2/ISO compliance?

**[Start a free trial at opensyber.cloud →](https://opensyber.cloud?ref=extension-readme)**

---

## Publishing

### First-time setup

Store your Azure DevOps PAT in macOS Keychain:

```bash
security add-generic-password -a "opensyber" -s "vsce-pat" -w "YOUR_PAT_HERE"
```

### Publish to VS Code Marketplace

```bash
cd packages/vscode-extension
./publish.sh
```

Or manually:

```bash
VSCE_PAT=$(security find-generic-password -a "opensyber" -s "vsce-pat" -w) npx vsce publish
```

---

## License

MIT — © 2026 OpenSyber
