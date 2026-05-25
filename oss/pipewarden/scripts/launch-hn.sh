#!/usr/bin/env bash
# PipeWarden — Show HN Launch Script (PB-018)
# Usage: ./scripts/launch-hn.sh
set -euo pipefail

# ANSI colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

hr() { printf "${CYAN}%s${RESET}\n" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

echo ""
hr
printf "${BOLD}${GREEN}  PIPEWARDEN — SHOW HN LAUNCH  ${RESET}\n"
hr
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[1] POST TITLE (copy-paste this exactly)${RESET}\n"
hr
printf "${YELLOW}"
cat <<'TITLE'
Show HN: PipeWarden – monitor what your CI/CD pipelines actually do, not just what's in the code
TITLE
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[2] POST BODY (copy-paste this exactly)${RESET}\n"
hr
printf "${YELLOW}"
cat <<'BODY'
After SolarWinds and the xz backdoor, the attack surface shifted: your pipeline is now as dangerous as your code.

I built PipeWarden to give teams a single tool that watches all their CI/CD pipelines across GitHub Actions, GitLab CI, Bitbucket, Jenkins, Azure DevOps, and CircleCI simultaneously.

What it does:
- Heuristic scanner: 5 categories of pipeline-specific checks (secret exposure in logs, unpin action refs, privileged runners, etc.)
- AI analysis via Claude: structured severity ratings with remediation steps
- DLP scanner: 13 regex patterns for AWS keys, GitHub/GitLab tokens, SSH keys, JWTs
- SARIF 2.1.0 export for GitHub Security tab integration
- OPA-style policy engine: 8 default policies (require-tests, no-secrets-in-env, pin-actions, etc.)
- Embeddable findings widget: iframe drop-in for existing dashboards
- SIEM routing: Slack Block Kit, PagerDuty, Jira

The "CrowdStrike for CI/CD" framing: most tools scan your source code. PipeWarden scans what the pipeline *does* — which runners it uses, what secrets it touches, whether actions are SHA-pinned.

Self-host via Docker + Cloudflare Tunnel, or use the hosted version at pipewarden.com.

Open source (MIT): https://github.com/finsavvyai/pipewarden

Would love feedback on: (1) which platform matters most to you — GitHub vs GitLab vs Jenkins? (2) what compliance reports are blocking your team — SOC2, HIPAA, PCI-DSS?
BODY
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[3] FIRST COMMENT — post this immediately after submitting (copy-paste)${RESET}\n"
hr
printf "${YELLOW}"
cat <<'COMMENT'
Hi HN — author here.

A few things that might interest this audience:

**Why pipelines, not code?** Code scanners (Snyk, Semgrep, CodeQL) are excellent but they miss runtime pipeline behavior: a workflow that downloads and executes a shell script from a URL won't show as malicious in static analysis. PipeWarden watches the pipeline definition and execution history.

**The xz-utils incident** was my original motivation. The malicious code was injected via a CI script, not the source. Existing scanners didn't catch it at the pipeline level.

**Architecture:** Go 1.24 + SQLite (upgradeable to Postgres), single binary, ~15MB Docker image. The AI analysis uses Claude via ClawPipe routing — if you're air-gapped, it falls back to Ollama locally.

**Action pinning** is the most common finding we see. `uses: actions/checkout@v4` can be compromised via a tag reassignment. SHA-pinning (`@8ade135a...`) prevents that. We detect and alert on all unpinned action references.

Happy to answer questions on the implementation, threat model, or how to self-host.
COMMENT
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[4] POST-LAUNCH CHECKLIST${RESET}\n"
hr
printf "${CYAN}"
cat <<'CHECKLIST'
  [ ] Submit at 9:00 AM EST (Tuesday or Wednesday — avoid Monday)
  [ ] Post the first comment IMMEDIATELY after submitting (within 60 seconds)
  [ ] Set a 15-minute timer — reply to every comment within 15 min for first 2 hours
  [ ] Keep the browser tab open and refresh every few minutes
  [ ] Do NOT ask friends to upvote (HN penalizes coordinated voting)
  [ ] Respond to all "how is this different from Snyk?" questions with the pipeline-behavior framing
  [ ] Respond to "why Go?" — single binary, low memory, easy Jenkins sidecar deployment
  [ ] Respond to "false positives?" — DLP patterns have confidence scores; heuristic checks are tunable
  [ ] Respond to "SARIF support?" — yes, GitHub Security tab ready
  [ ] After 2 hours: share link in CNCF Slack #security, DevSecOps Slack, Go Slack #jobs
  [ ] Post to r/netsec and r/golang (genuine "built this" framing, not promotion)
  [ ] Record the final points / rank for metrics tracking
  [ ] Update SPRINT_TRACKER.md with HN results
CHECKLIST
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[5] Opening https://news.ycombinator.com/submit in browser...${RESET}\n"
hr
echo ""
open "https://news.ycombinator.com/submit"
printf "${CYAN}  Browser opened. Good luck — you've got this.${RESET}\n"
echo ""
