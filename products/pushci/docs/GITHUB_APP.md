# PushCI GitHub App — Marketplace Listing

## App Name
PushCI — AI-Native CI/CD

## Short Description (140 chars)
Zero-config AI CI/CD that runs on your machine. Auto-detects your stack, 19 languages, 69 skills, $0 forever.

## Full Description
PushCI replaces GitHub Actions with AI-powered CI/CD that runs on your infrastructure — no cloud minutes, no YAML, no vendor lock-in.

### What PushCI Does
- **Auto-detects** your stack (19 languages, 40+ frameworks)
- **Runs locally** on your machine or self-hosted runners
- **AI-powered** diagnostics, auto-fix, code review, and pipeline generation
- **Blast radius analysis** shows what's affected before you merge
- **69 marketplace skills** — security scanners, deploy targets, test frameworks
- **Tailscale mesh** for secure, encrypted runner networking
- **MCP server** for Claude Code, Cursor, and Windsurf integration

### How It Works
1. Install: `npm i -g pushci && pushci init`
2. Push code → pre-push hook runs your pipeline
3. Webhook sends results to dashboard at app.pushci.dev

### Pricing
- **Free**: Local runs, 1 repo, community support
- **Pro ($9/mo)**: Cloud API, AI features, unlimited repos
- **Team ($29/mo)**: SSO, organizations, SLA, 25 members

## Permissions Required

### Repository
- **Contents**: Read — to detect stack and generate pipeline
- **Pull requests**: Read/Write — to post CI status checks
- **Checks**: Read/Write — to report check results
- **Webhooks**: Read/Write — to auto-install push/PR webhooks

### Organization
- **Members**: Read — for SSO import feature

## Webhook Events
- `push` — trigger CI pipeline on push
- `pull_request` — trigger CI on PR open/sync
- `check_run` — update check status
- `installation` — handle app install/uninstall

## Setup URL
https://app.pushci.dev/auth/callback

## Callback URL
https://app.pushci.dev/auth/callback

## Webhook URL
https://api.pushci.dev/webhook/github

## Categories
- Continuous integration
- Code quality
- Security
- Deployment

## Logo
Use the PushCI logo: emerald green "RL" on dark background.

## Screenshots
1. Dashboard — runs list with status, duration, commit info
2. Pipeline Flow — animated step visualization
3. Skill Market — 69 skills with install flow
4. Impact Analysis — blast radius graph
5. Terminal — pushci init auto-detection

## Support
- Documentation: https://pushci.dev
- Email: support@pushci.dev
- GitHub: https://github.com/finsavvyai/pushci
