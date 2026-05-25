# User Journey: Yael Navon — Solo Security-Minded Developer

## AWARENESS (Week -2 to 0)

### Discovery Channel
- Reads Hacker News post about Trivy supply chain attack (March 19, 2026)
- Sees OpenSyber blog post `/blog/trivy-attack-inevitable` trending
- Clicks through to landing page, reads "Your AI agents have no sheriff. We watch them."

### Internal Trigger
- Realizes she runs Cursor and Copilot daily with full filesystem access
- Checks her `.env` — API keys for Stripe, AWS, and client databases all accessible
- Thinks: "If Trivy got 45 orgs, what's stopping the same thing in my IDE?"

### Emotional State
- **Fear**: "Am I already compromised?"
- **Curiosity**: "Can I actually monitor what Cursor does?"
- **Skepticism**: "Another security dashboard I'll never check?"

---

## CONSIDERATION (Day 0-2)

### Evaluation Criteria
1. Does it work with VS Code + Cursor? ✅ (IDE integration guide)
2. Is there a free tier? ✅ (Free forever, 1 instance, 3 skills)
3. How long does setup take? ✅ (Landing page promises 60 seconds)
4. Does it actually show what my AI agent is doing? → Needs to try demo

### Actions Taken
- Visits `/demo` — explores live security dashboard without signup
- Checks `/pricing` — confirms free tier exists, no credit card required
- Visits `/marketplace` — sees free skills (Credential Monitor, File Integrity)
- Reads `/blog/secure-ai-coding-agents` — technical credibility check

### Competitors Checked
- Snyk (only dependencies, not runtime agents)
- GitHub Advanced Security (only code scanning)
- Wiz (enterprise only, no AI agent focus)

### Decision
- "Free tier, 60-second setup, I'll try it. Worst case I uninstall."

---

## ONBOARDING (Day 1, first 15 minutes)

### Signup (2 min)
- `/sign-in` → clicks "Continue with GitHub" (OAuth)
- Account created, redirected to `/dashboard`
- Sees empty dashboard with security score of 0

### Getting Started (8 min)
- `/dashboard/getting-started` → onboarding checklist appears
- **Step 1**: VS Code integration — copies config snippet, installs hook
- **Step 2**: Cursor integration — auto-detected, one-click enable
- **Step 3**: Install first skill — goes to marketplace, installs "Credential Monitor" (free)

### First Data (5 min)
- Opens VS Code, starts coding with Cursor
- Agent activity starts flowing into `/dashboard`
- Security score jumps from 0 to 45 — "still work to do"
- Sees first event: "File read: .env (risk: medium)"

### Aha Moment
> "Holy shit, Cursor read my .env 14 times in the last hour. I had no idea."

### Drop-off Risks
- If IDE integration fails silently (no data flowing)
- If dashboard is empty for more than 5 minutes after setup
- If security score explanation is unclear

---

## ACTIVATION (Day 1-7)

### Key Activation Actions (predict 30-day retention)
1. ✅ Installs 2+ marketplace skills
2. ✅ Checks security score on 3+ different days
3. ✅ Receives first security alert (email or dashboard)
4. ✅ Shares scorecard badge (embeds in GitHub README)

### Daily Workflow
- Morning: opens `/dashboard`, glances at security score (takes 10 seconds)
- Sees any red alerts → clicks through to event detail
- Checks achievement progress (motivated by "Guardian" badge — 80+ score for 30 days)

### Milestones
- **Day 2**: Installs 2nd skill (File Integrity Checker)
- **Day 3**: Security score reaches 72 — feels progress
- **Day 4**: First credential access alert — Copilot tried to read `~/.aws/credentials`
- **Day 5**: Installs 3rd skill (hits free tier limit) — "Supply Chain Guard"
- **Day 7**: Shares scorecard badge on GitHub — first social proof moment

---

## RETENTION (Week 2-12)

### Weekly Routine
- 30 seconds/day checking score dashboard
- 5 minutes/week reviewing agent activity summary
- Marketplace check every 2 weeks for new free skills

### Feature Discovery
- **Week 3**: Discovers API key generation → integrates with GitHub Actions CI
- **Week 5**: Discovers achievement system → targets "Fortress" badge (95+ score for 7 days)
- **Week 8**: Discovers scorecard sharing → adds badge to portfolio website

### Engagement Pattern
- Steady but shallow — uses as a passive monitoring tool
- Engagement spikes when an alert fires (credential access or suspicious install)

---

## EXPANSION (Month 3+)

### Upgrade Triggers
- **Trigger 1** (Month 2): Wants to install 4th skill → hits 3-skill limit → considers Personal ($49/mo)
- **Trigger 2** (Month 3): Client asks for security compliance evidence → needs more than 7-day audit retention
- **Trigger 3** (Month 4): Starts second project → needs 2nd agent instance → must upgrade

### Upgrade Decision
- Upgrades to Personal ($49/mo) for: 10 skills, 30-day retention, 3 agents
- Justifies to herself: "It's less than one hour of my freelance rate"

### Referral Behavior
- Posts about OpenSyber score in developer Discord
- Shares referral code (earns referral credits)
- Mentions in blog post about AI coding security practices

### Long-term Value
- Stays on Personal for 12-24 months
- If she joins a company, becomes internal champion for team adoption
- LTV: $588-1,176/yr
