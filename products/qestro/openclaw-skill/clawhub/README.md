# Qestro QA Agent — OpenClaw Skill

🧪 **AI-Powered Test Automation at your fingertips.** Control Qestro's test platform directly from WhatsApp, Telegram, Slack, Discord, or any channel OpenClaw supports.

## What it does

- 📊 **Dashboard** — Get real-time QA metrics: test counts, coverage, pass rate, AI healing stats
- 🚀 **Run Suite** — Trigger test suites: `qestro run-suite login-regression`
- ❌ **Failures** — View recent test failures with details
- 🤖 **AI Analyze** — Get AI analysis of test failures and suggested fixes
- 🧬 **Generate** — Create new test cases from natural language descriptions
- 🔧 **Self-Heal** — Trigger AI self-healing for broken tests
- 📋 **Daily Summary** — Get your daily QA digest

## Quick Start

```bash
# One-command install
curl -sSL https://raw.githubusercontent.com/finsavvyai/qestro-openclaw-skill/main/install.sh | bash
```

Or manually:

```bash
# Copy to OpenClaw skills directory
cp -r qestro-skill/ ~/.openclaw/skills/qestro/

# Set your Qestro API URL
export QESTRO_API_URL=http://localhost:8000

# Test the skill
openclaw run qestro dashboard
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `dashboard` | Show QA overview | `qestro dashboard` |
| `run-suite [name]` | Run a test suite | `qestro run-suite checkout` |
| `failures` | View recent failures | `qestro failures` |
| `analyze [test-id]` | AI failure analysis | `qestro analyze TC-001` |
| `generate [desc]` | Generate test from description | `qestro generate "login with 2FA"` |
| `self-healing` | Trigger self-healing | `qestro self-healing` |
| `daily-summary` | Get daily digest | `qestro daily-summary` |

## Configuration

Set these environment variables or add to your `.env`:

```bash
QESTRO_API_URL=http://localhost:8000    # Your Qestro backend URL
QESTRO_API_KEY=                         # API key (optional for local)
QESTRO_PROJECT_ID=default               # Default project
```

## Screenshots

### Dashboard View
```
📊 Qestro QA Dashboard
━━━━━━━━━━━━━━━━━━━━━━
Tests: 156 total | 132 active
Coverage: 89% | Grade: A+
AI Healed: 42 tests | Generated: 28
System: ✅ OPTIMAL (99.97% uptime)
```

### Failure Report
```
❌ Recent Failures (3)
━━━━━━━━━━━━━━━━━━━━━━
1. Login Flow - 2FA Timeout
   Error: SMS delivery delay >30s
   Suggested: Increase timeout to 45s

2. Checkout - Payment Gateway
   Error: Stripe webhook timeout
   Suggested: Add retry mechanism
```

## Requirements

- OpenClaw v0.1+
- Python 3.9+ (for the skill client)
- Qestro backend running

## License

MIT — Free for personal and commercial use.

## About

Built by the [Qestro](https://qestro.com) team — AI-Powered QA for teams that ship fast.

**Tags:** qa, testing, automation, playwright, cypress, ai, test-generation, self-healing
