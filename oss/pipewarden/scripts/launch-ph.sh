#!/usr/bin/env bash
# PipeWarden — Product Hunt Launch Script (PB-019)
# Usage: ./scripts/launch-ph.sh
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
printf "${BOLD}${GREEN}  PIPEWARDEN — PRODUCT HUNT LAUNCH  ${RESET}\n"
hr
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[1] TAGLINE (copy-paste into the tagline field — 60 chars max)${RESET}\n"
hr
printf "${YELLOW}"
cat <<'TAGLINE'
Security scanner for CI/CD pipelines — GitHub, GitLab, Bitbucket, Jenkins, Azure
TAGLINE
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[2] MAKER POST BODY (copy-paste into the first comment / maker post)${RESET}\n"
hr
printf "${YELLOW}"
cat <<'MAKER'
Hey Product Hunt 👋

I'm Shahar, and I built PipeWarden after spending too much time investigating CI/CD security incidents that existing tools completely missed.

**The problem:** Snyk, GitGuardian, and Semgrep scan your *code*. But the SolarWinds breach and xz-utils backdoor both happened at the *pipeline* level — in CI scripts, not source files.

**What PipeWarden does differently:**
- Watches pipeline definitions AND execution history across 6 platforms simultaneously
- Detects unpinned GitHub Actions (supply chain risk), secrets in environment variables, privileged self-hosted runners
- AI-powered triage via Claude — not just "found a secret" but "here's why it's risky and here's the 3-step fix"
- SARIF export plugs findings straight into GitHub's Security tab
- Embeddable widget so you can surface findings in your existing security portal

**Pricing:** Community tier is free forever (1 connection, 10 scans/day). Paid plans for teams start at $19/mo.

**Open source:** MIT license at github.com/finsavvyai/pipewarden — self-host with Docker in 5 minutes.

Would love your feedback — especially: what CI/CD platform causes you the most security headaches?
MAKER
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[3] GALLERY CAPTIONS (use these for each screenshot slot)${RESET}\n"
hr
printf "${CYAN}"
cat <<'GALLERY'
  Gallery image 1:
    "Dashboard — all connections, risk scores, finding counts at a glance"

  Gallery image 2:
    "Findings view — severity badges, DLP detections, policy violations filtered by platform"

  Gallery image 3:
    "AI analysis — Claude-powered remediation with step-by-step fix instructions"

  Gallery image 4:
    "SARIF export — upload findings directly to GitHub Security tab"

  Gallery image 5:
    "Embeddable widget — drop-in iframe for existing security dashboards"
GALLERY
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[4] LAUNCH-DAY TWEET SCHEDULE (copy each tweet at the time shown)${RESET}\n"
hr

printf "${CYAN}  ── Tweet 1 — 12:05 AM PT (right after PH post goes live) ──${RESET}\n"
printf "${YELLOW}"
cat <<'TWEET1'
Just launched PipeWarden on @ProductHunt 🚀

Most DevSecOps tools scan your code.
PipeWarden watches what your CI/CD pipelines *actually do*.

6 platforms. AI-powered analysis. MIT licensed.

👉 https://www.producthunt.com/posts/pipewarden

#DevSecOps #Security #OpenSource
TWEET1
printf "${RESET}"
echo ""

printf "${CYAN}  ── Tweet 2 — 9:00 AM PT (morning drive-by) ──${RESET}\n"
printf "${YELLOW}"
cat <<'TWEET2'
SolarWinds wasn't a code vulnerability.
The xz-utils backdoor wasn't in application source.

They happened in the pipeline.

PipeWarden detects:
✓ Secrets in build logs (13 patterns + live validity check)
✓ Unpinned GitHub Actions (SHA-pinning audit)
✓ OPA policy violations
✓ DLP leaks across 6 CI/CD platforms

Free tier at pipewarden.com 🔒
TWEET2
printf "${RESET}"
echo ""

printf "${CYAN}  ── Tweet 3 — 1:00 PM PT (afternoon peak) ──${RESET}\n"
printf "${YELLOW}"
cat <<'TWEET3'
Snyk Business: $25/engineer/month
→ 20 engineers = $6,000/year

GitGuardian Business: $400/month

PipeWarden Professional: $49/month
→ unlimited engineers, unlimited scans

Flat-rate pricing because security shouldn't be gated by headcount.

Launched today on @ProductHunt 👇
TWEET3
printf "${RESET}"
echo ""

printf "${CYAN}  ── Tweet 4 — 5:00 PM PT (end-of-day push) ──${RESET}\n"
printf "${YELLOW}"
cat <<'TWEET4'
Last few hours to vote for PipeWarden on @ProductHunt 🙏

Built in Go. Single binary. 5-minute Docker setup.

Ships with:
→ Heuristic scanner (5 categories)
→ DLP scanner (13 secret patterns)
→ Claude AI analysis
→ SARIF export
→ OPA policy engine

github.com/finsavvyai/pipewarden ⭐
TWEET4
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[5] ENGAGEMENT CHECKLIST${RESET}\n"
hr
printf "${CYAN}"
cat <<'CHECKLIST'
  Pre-launch (complete before 12:01 AM PT):
  [ ] Product Hunt listing is fully filled out (tagline, description, all 5 gallery images)
  [ ] Pricing tiers entered (Community Free / Starter $19 / Pro $49 / Enterprise $199)
  [ ] Topics tagged: Developer Tools, Security, DevOps, Open Source
  [ ] pipewarden.com is live and loads fast (check from mobile too)
  [ ] Demo account seeded with sample connections and findings

  Launch day:
  [ ] Post at 12:01 AM PT sharp (PH resets at midnight PT)
  [ ] Post maker comment IMMEDIATELY after listing goes live
  [ ] Schedule all 4 tweets (use Buffer or TweetDeck)
  [ ] Share in Slack communities: CNCF #security, DevSecOps Slack, Go Slack
  [ ] DM 10 developer contacts with a personal note (not mass blast)
  [ ] Reply to every PH comment within 2 hours during the day
  [ ] Upvote from personal account (NOT from multiple accounts — PH bans this)
  [ ] Post to r/netsec (genuine framing, no direct promotion language)

  End of day:
  [ ] Screenshot final PH position and vote count
  [ ] Reply to any unanswered comments
  [ ] DM interested commenters with a calendar link for demo
  [ ] Update SPRINT_TRACKER.md with PH results (votes, rank, signups)
CHECKLIST
printf "${RESET}"
echo ""

# ──────────────────────────────────────────────
printf "${GREEN}[6] Opening https://www.producthunt.com/posts/new in browser...${RESET}\n"
hr
echo ""
open "https://www.producthunt.com/posts/new"
printf "${CYAN}  Browser opened. Post at 12:01 AM PT for best results.${RESET}\n"
echo ""
