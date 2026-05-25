# PipeWarden Enterprise Outreach

> **Goal**: 10 qualified conversations/week → 3 demos → 1 close/month
> **Target**: Series B/C companies (50-500 engineers), DevSecOps/Platform leads

---

## Ideal Customer Profile

**Company signals** (any 2 = qualified):
- 50-500 engineers on LinkedIn
- Active GitHub org with 10+ repositories
- CI/CD job postings in last 90 days ("DevOps Engineer", "Platform Engineer", "Security Engineer")
- Recent security incident in TechCrunch/Hacker News
- SOC2 Type II or ISO27001 certification in progress (LinkedIn, company blog)
- Uses GitHub Actions + any of: GitLab, Jenkins, Azure DevOps (multi-platform signal)

**Persona** (decision maker):
- Director/VP Engineering or CTO at Series B/C
- Head of Platform, Head of DevSecOps, Security Lead
- NOT: individual contributors (they champion but don't buy)

**Anti-ICP** (skip):
- Pre-seed/seed startups (no budget cycle yet)
- >1000 engineers (long sales cycle, requires enterprise contracts)
- Government/defense (compliance complexity)
- Companies already on Cycode or Apiiro (budget committed)

---

## Outreach Sequence (5 touches over 14 days)

### Touch 1 — Day 1: LinkedIn Connection Request
```
Hi [Name], I've been following [Company]'s engineering blog — the post about 
your CI/CD migration was interesting. I built a pipeline security tool that 
might be relevant. Would be happy to connect.
```
*(no pitch in connection request — just genuine reason to connect)*

### Touch 2 — Day 3: First message after connect
```
Subject: CI/CD pipeline security at [Company]

Hi [Name],

Thanks for connecting.

Quick context: I built PipeWarden — it monitors what CI/CD pipelines actually 
*do* at runtime, not just what's in the code. Most DevSecOps tools miss this 
entirely.

For a [Company]-sized team using [GitHub Actions / Jenkins / etc.], it usually 
finds:
- 2-3 exposed secrets in pipeline logs (most are stale, but some aren't)
- Unpinned third-party actions (SolarWinds-style risk)
- Missing required security steps in 40-60% of pipelines

Takes 5 minutes to connect your first pipeline. Free tier, no credit card.

Worth a look? pipewarden.com

Happy to do a 20-minute walkthrough if you'd rather see it in context.
```

### Touch 3 — Day 7: Value-add follow-up (not a bump)
```
Hi [Name],

Not sure if you had a chance to look at PipeWarden — no worries if not.

I came across [relevant news about their company or a competitor's incident] 
and thought of you. [One sentence connecting the news to the problem PipeWarden 
solves.]

Still happy to do a quick demo if useful. No pressure either way.
```

### Touch 4 — Day 10: Social proof / case study angle
```
One thing I should have mentioned earlier: the pricing is flat-rate — 
unlimited engineers for $49/month.

For a [team size] team, that's [math: vs Snyk/GitGuardian at per-seat rates].

Happy to share a breakdown of what we typically find in the first scan if 
that would help make the case internally.
```

### Touch 5 — Day 14: Breakup email
```
Hi [Name],

Last note from me — I don't want to be noise in your inbox.

If pipeline security isn't a priority right now, totally understood. 
I'll check back in a quarter.

If it ever becomes relevant, you know where to find me: pipewarden.com

Good luck with [something specific from their company/role].
```

---

## Week 1 Prospect List (Template)

Research these signals: GitHub org activity, LinkedIn headcount, DevOps job postings, recent funding.

| Company | Stage | Engineers (est.) | CI/CD Stack | Contact | LinkedIn | Signal |
|---------|-------|-----------------|-------------|---------|----------|--------|
| [Company A] | Series C | ~150 | GitHub Actions | Head of Platform | [URL] | SOC2 in progress |
| [Company B] | Series B | ~80 | Jenkins + GitHub | VP Engineering | [URL] | Security engineer JD posted |
| [Company C] | Series C | ~200 | GitLab + Jenkins | Security Lead | [URL] | Multiple CI/CD repos visible |
| [Company D] | Series B | ~60 | Azure DevOps | Director of Engineering | [URL] | Recent funding, hiring DevOps |
| [Company E] | Series C | ~120 | GitHub Actions | CTO | [URL] | Complex workflow files in public repos |

### Sourcing Channels

**LinkedIn Sales Navigator queries** (use Boolean search):
- `"Director of Engineering" OR "VP Engineering" OR "Head of Platform" AND "CI/CD" AND [city]`
- `"DevSecOps" AND Series B OR Series C`

**GitHub**:
- Search for companies with complex `.github/workflows/` directories
- Companies with 10+ workflow files are likely feeling the pain
- Look for unpinned actions as a signal (means they haven't audited pipelines yet)

**Crunchbase**:
- Filter: Series B/C, raised in last 18 months, software/fintech/healthtech
- 50-500 employees range

**TechCrunch/SecurityWeek**:
- Companies that disclosed security incidents in last 12 months are high-intent
- They have budget allocated and leadership attention

**Job boards**:
- `site:greenhouse.io "DevSecOps" OR "Platform Security"` 
- Active hiring = active budget = right time to talk

---

## Demo Script (20 minutes)

### Minutes 0-2: Discovery
- "Tell me about your current CI/CD setup — how many pipelines, which platforms?"
- "What's your current security coverage on the pipeline side specifically?"
- "Have you had any incidents or near-misses in the last year?"

### Minutes 2-8: Demo
1. Dashboard — show clean state, add a GitHub connection (demo token)
2. Run a scan — show findings appearing in real time
3. Click into a Critical finding — show validity confirmation + AI remediation
4. Show SIEM routing (Slack preview)
5. Show SARIF export → GitHub Security tab

### Minutes 8-15: Tailored value
- Map findings from demo to their specific stack
- If they use Jenkins: show Jenkins plugin bridge (post-build trigger)
- If they care about compliance: show SOC2/HIPAA mapping in reports
- If they're GitHub-heavy: show SARIF → Security tab integration

### Minutes 15-18: Pricing
- "With a team of [N] engineers, here's what per-seat tools cost vs. PipeWarden"
- Walk through tiers: Professional ($49/month) or Enterprise ($199/month)
- Note: flat-rate, unlimited engineers, unlimited scans

### Minutes 18-20: Next steps
- "What would you need to see to feel comfortable starting a trial?"
- If yes: "I can set up a free Professional trial for 30 days — no credit card"
- If hesitant: "Would it help to bring in your security lead for a second call?"

---

## Objection Handling

**"We already use Snyk / GitGuardian"**
> "Both are great tools — they scan your code and detect secret commits. PipeWarden watches what your pipelines *do* at runtime. It's complementary. Snyk finds the vulnerable library. PipeWarden finds the pipeline that has write access to your production database without needing it."

**"We're small — is this overkill?"**
> "Actually the opposite. A 50-person team with 3 engineers on DevOps doesn't have bandwidth to manually audit every workflow YAML. PipeWarden does it automatically. The biggest risk for smaller teams is exactly this: one compromised third-party action in a workflow that nobody's reviewed in 18 months."

**"We handle security in-house"**
> "That's great — PipeWarden actually makes your in-house security team faster. Instead of manual reviews, you get structured findings with remediation suggestions. The SARIF export goes straight into whatever tool your security team uses. More signal, less noise."

**"The pricing is too high"**
> "What's your current cost for security tooling per engineer? If you're on Snyk Business at $25/engineer/month and you have 50 engineers, that's $15,000/year. PipeWarden Professional is $5,988/year, unlimited engineers. We can also start with a 30-day free trial so you can validate the value before committing."

**"We need to evaluate this with procurement"**
> "Understood. A few things that typically help procurement: we offer a W-9, SOC2 report on request, and we can do a 30-day trial on the Professional tier before any contract is signed. I can send you a one-pager with security posture, data handling, and SLA details."

---

## Tracking (Weekly)

| Week | Outreach Sent | Responses | Demos Booked | Trials Started | Closes |
|------|--------------|-----------|--------------|---------------|--------|
| W1   | 10 | | | | |
| W2   | 10 | | | | |
| W3   | 10 | | | | |
| W4   | 10 | | | | |

**Target conversion**: 10 outreach → 3 responses → 1-2 demos → 0.5 trials → 0.1 closes
**Target by month 3**: 3 paid Enterprise customers ($4,500 MRR)
