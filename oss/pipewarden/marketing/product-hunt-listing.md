## Product Hunt Listing — PipeWarden

**Name:** PipeWarden

**Tagline:** Security scanner for CI/CD pipelines — GitHub, GitLab, Bitbucket, Jenkins, Azure

**Topics:** Developer Tools, Security, DevOps, Open Source

---

**Description (250 chars):**
PipeWarden monitors what your CI/CD pipelines actually do. AI-powered security scanning across GitHub Actions, GitLab CI, Bitbucket, Jenkins, Azure DevOps. Secret detection, action pinning audits, SARIF export. Self-host free.

---

**Gallery captions:**
1. Dashboard — all connections, risk scores, finding counts at a glance
2. Findings view — severity badges, DLP detections, policy violations filtered by platform
3. AI analysis — Claude-powered remediation with step-by-step fix instructions
4. SARIF export — upload findings directly to GitHub Security tab
5. Embeddable widget — drop-in iframe for existing security dashboards

---

**First comment (maker post):**

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

---

**Pricing tiers (for listing):**
- Community — Free — 1 connection, 10 scans/day
- Starter — $19/mo — 5 connections, 100 scans/day, SIEM integrations
- Professional — $49/mo — 15 connections, 500 scans/day, DLP + policy engine
- Enterprise — $199/mo — 50 connections, unlimited scans, SSO, audit logs
- Enterprise+ — $499/mo — Unlimited everything, SLA, dedicated support

---

**Hunter note:**
Best time to hunt: Tuesday 12:01 AM PT (first on the day list).
Schedule tweets at 12:05 AM, 9 AM, 1 PM, 5 PM PT on launch day.
