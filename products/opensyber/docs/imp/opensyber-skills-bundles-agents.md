# OpenSyber — Skills & Bundles
> Claude Code Agent Prompts
> Run H, I, J, K in parallel
> Based on live audit of opensyber.cloud/marketplace

---

## WHAT'S WRONG RIGHT NOW

```
Categories shown:  Productivity | Developer Tools | Finance |
                   Communication | Home & Lifestyle | Security | Utilities
Should be:         Security | CI/CD | Compliance | AI Agents |
                   Runtime | Alerts | Infrastructure

Fake counts:       (312) reviews, 4824 installs — impossible pre-launch
Skill detail pages: ALL 404 — clicking any skill goes nowhere
Bundles page:      Doesn't exist at all
Source wizard:     Doesn't exist — install → nothing happens
Mission framing:   "Browse verified skills to enhance your AI agent"
                   Should be: every skill tied to a real attack
```

---

# ══════════════════════════════════════
# AGENT H — MARKETPLACE PAGE FULL REBUILD
# src/routes/marketplace/+page.svelte
# ══════════════════════════════════════

```prompt
You are rebuilding the OpenSyber marketplace page.
The current page has wrong categories, fake social proof,
and no mission framing. Replace it entirely.

FILE: src/routes/marketplace/+page.svelte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — PAGE HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the current hero with:

<section class="mp-hero">
  <div class="container">
    <div class="mp-eyebrow">Skill Marketplace</div>
    <h1 class="mp-title">
      15 skills.<br>
      <em>Every attack vector covered.</em>
    </h1>
    <p class="mp-sub">
      Each skill targets a specific attack documented in a real 2025–2026 incident.
      Every skill passes a 4-stage security audit before it reaches your agent.
      Install one. Connect a source. Protected in 60 seconds.
    </p>

    <div class="mp-stats">
      <div class="mp-stat">
        <span class="mp-stat-num">15</span>
        <span class="mp-stat-label">Verified skills</span>
      </div>
      <div class="mp-stat">
        <span class="mp-stat-num">4</span>
        <span class="mp-stat-label">Audit stages</span>
      </div>
      <div class="mp-stat">
        <span class="mp-stat-num">847+</span>
        <span class="mp-stat-label">IOCs in threat feed</span>
      </div>
      <div class="mp-stat">
        <span class="mp-stat-num">&lt;60s</span>
        <span class="mp-stat-label">Time to protection</span>
      </div>
    </div>
  </div>
</section>

Styles:
.mp-hero { padding: 80px 0 40px; }
.mp-eyebrow {
  font-size: 11px; font-weight: 600; letter-spacing: .1em;
  text-transform: uppercase; color: var(--blue2); margin-bottom: 14px;
}
.mp-title {
  font-family: var(--font-display);
  font-size: clamp(32px, 5vw, 54px);
  font-weight: 800; letter-spacing: -.04em;
  line-height: 1.05; margin-bottom: 16px; color: var(--text);
}
.mp-title em {
  font-style: normal;
  background: linear-gradient(135deg, var(--blue2), var(--cyan));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.mp-sub {
  font-size: 17px; color: var(--text2);
  max-width: 600px; font-weight: 300;
  line-height: 1.7; margin-bottom: 32px;
}
.mp-stats {
  display: flex; gap: 32px; flex-wrap: wrap;
}
.mp-stat { display: flex; flex-direction: column; gap: 4px; }
.mp-stat-num {
  font-family: var(--font-display);
  font-size: 28px; font-weight: 800;
  color: var(--text); letter-spacing: -.03em;
}
.mp-stat-label { font-size: 12px; color: var(--text3); }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — TABS (fix categories)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the current category tabs completely.

FROM:
  All | Productivity | Developer Tools | Finance |
  Communication | Home & Lifestyle | Security | Utilities

TO:
  <div class="mp-tabs">
    <button class="mp-tab active" data-filter="all">All Skills</button>
    <button class="mp-tab" data-filter="security">Security</button>
    <button class="mp-tab" data-filter="cicd">CI/CD</button>
    <button class="mp-tab" data-filter="compliance">Compliance</button>
    <button class="mp-tab" data-filter="ai">AI Agents</button>
    <button class="mp-tab" data-filter="runtime">Runtime</button>
    <button class="mp-tab" data-filter="alerts">Alerts</button>
    <a href="/marketplace/bundles" class="mp-tab mp-tab-bundles">
      Bundles — save 47% →
    </a>
  </div>

Tab click logic:
  Each skill card has a data-category attribute.
  On tab click: show only cards matching the filter.
  "all" shows everything.

Styles:
.mp-tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
  margin-bottom: 24px; align-items: center;
}
.mp-tab {
  padding: 8px 16px; border-radius: 8px;
  border: 1px solid var(--border2);
  background: var(--surface); color: var(--text2);
  font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all .2s;
  font-family: var(--font-body);
  text-decoration: none;
}
.mp-tab:hover { border-color: var(--border3); color: var(--text); }
.mp-tab.active {
  background: var(--blue); border-color: var(--blue);
  color: white;
}
.mp-tab-bundles {
  margin-left: auto;
  background: rgba(0,229,160,.08);
  border-color: rgba(0,229,160,.25);
  color: var(--green); font-weight: 600;
}
.mp-tab-bundles:hover {
  background: rgba(0,229,160,.14);
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — BUNDLES PROMO BANNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add between tabs and skill grid:

<a href="/marketplace/bundles" class="bundles-promo-bar">
  <div class="bundles-promo-left">
    <span class="bundles-promo-icon">⚡</span>
    <div>
      <div class="bundles-promo-title">
        Save up to 47% with skill bundles
      </div>
      <div class="bundles-promo-desc">
        Pre-packaged skill sets. One source connection activates everything.
        Supply Chain Defense · AI Agent Security · Compliance Ready · and 6 more.
      </div>
    </div>
  </div>
  <div class="bundles-promo-cta">View bundles →</div>
</a>

Styles:
.bundles-promo-bar {
  display: flex; justify-content: space-between; align-items: center;
  background: linear-gradient(120deg, rgba(27,111,255,.08), rgba(0,229,160,.05));
  border: 1px solid rgba(27,111,255,.2);
  border-radius: 12px; padding: 18px 24px;
  margin-bottom: 32px; text-decoration: none;
  transition: border-color .2s;
}
.bundles-promo-bar:hover { border-color: rgba(27,111,255,.35); }
.bundles-promo-left { display: flex; gap: 14px; align-items: flex-start; }
.bundles-promo-icon { font-size: 22px; flex-shrink: 0; }
.bundles-promo-title {
  font-family: var(--font-display);
  font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 3px;
}
.bundles-promo-desc { font-size: 13px; color: var(--text2); line-height: 1.5; }
.bundles-promo-cta {
  font-size: 14px; font-weight: 600; color: var(--blue2);
  white-space: nowrap; flex-shrink: 0; margin-left: 24px;
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — SKILL CARDS (complete rewrite)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace ALL 15 skill cards with this new data structure.
Each card shows: what attack it stops, what source it needs,
version badge, verified badge. NO review counts. NO install numbers.

Skill card component structure:

<a href="/marketplace/{skill.slug}" class="skill-card" data-category="{skill.category}">
  <div class="skill-card-top">
    <div class="skill-icon">{skill.icon}</div>
    <div class="skill-badges">
      <span class="verified-badge">✓ Verified</span>
      {#if skill.incidentTag}
        <span class="incident-tag {skill.incidentSeverity}">
          {skill.incidentTag}
        </span>
      {/if}
    </div>
  </div>

  <div class="skill-name">{skill.name}</div>
  <div class="skill-mission">{skill.missionLine}</div>
  <div class="skill-desc">{skill.description}</div>

  <div class="skill-footer">
    <div class="skill-meta">
      <span class="skill-version">v{skill.version}</span>
      <span class="skill-source-req">
        Needs: {skill.sourceLabel}
      </span>
    </div>
    <span class="skill-install-btn">Install →</span>
  </div>
</a>

Styles:
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.skill-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 14px; padding: 22px;
  text-decoration: none; display: flex;
  flex-direction: column; gap: 10px;
  transition: transform .2s, border-color .2s, box-shadow .2s;
  cursor: pointer;
}
.skill-card:hover {
  transform: translateY(-2px);
  border-color: rgba(27,111,255,.3);
  box-shadow: 0 8px 32px rgba(0,0,0,.25);
}
.skill-card-top {
  display: flex; justify-content: space-between; align-items: flex-start;
}
.skill-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(27,111,255,.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.skill-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.verified-badge {
  font-size: 11px; font-weight: 600;
  padding: 3px 8px; border-radius: 4px;
  background: rgba(0,229,160,.1);
  border: 1px solid rgba(0,229,160,.2);
  color: var(--green);
}
.incident-tag {
  font-size: 10px; font-weight: 700;
  padding: 3px 8px; border-radius: 4px;
  letter-spacing: .03em;
}
.incident-tag.critical {
  background: rgba(255,75,75,.1);
  border: 1px solid rgba(255,75,75,.2);
  color: var(--red);
}
.incident-tag.high {
  background: rgba(245,166,35,.1);
  border: 1px solid rgba(245,166,35,.2);
  color: var(--amber);
}
.incident-tag.new-skill {
  background: rgba(27,111,255,.1);
  border: 1px solid rgba(27,111,255,.2);
  color: var(--blue2);
}
.skill-name {
  font-family: var(--font-display);
  font-size: 16px; font-weight: 700; color: var(--text);
}
.skill-mission {
  font-size: 13px; font-weight: 600; color: var(--blue2);
  line-height: 1.4;
}
.skill-desc {
  font-size: 13px; color: var(--text3); line-height: 1.6; flex: 1;
}
.skill-footer {
  display: flex; justify-content: space-between;
  align-items: center; padding-top: 12px;
  border-top: 1px solid var(--border); margin-top: 4px;
}
.skill-meta { display: flex; flex-direction: column; gap: 3px; }
.skill-version {
  font-size: 11px; color: var(--text3);
  font-family: var(--font-mono);
}
.skill-source-req {
  font-size: 11px; color: var(--text3);
}
.skill-install-btn {
  font-size: 13px; font-weight: 600; color: var(--blue2);
}
@media (max-width: 700px) {
  .skill-grid { grid-template-columns: 1fr; }
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 15 SKILL DATA DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define this array in the page script and render it:

const skills = [
  {
    slug: 'secret-scanner',
    name: 'Secret Scanner',
    icon: '🔍',
    category: 'security',
    version: '1.2.0',
    missionLine: 'Stops credentials from leaving your codebase.',
    description: 'Scans every commit for 120+ secret patterns: AWS keys, GitHub tokens, Anthropic API keys, Stripe secrets, database passwords, SSH private keys. Reports with file, line, and one-command remediation.',
    incidentTag: 'Trivy attack vector',
    incidentSeverity: 'critical',
    sourceLabel: 'GitHub App or git hook',
    sourceType: 'github_app',
    planRequired: 'free',
  },
  {
    slug: 'slack-security-alerts',
    name: 'Slack Security Alerts',
    icon: '💬',
    category: 'alerts',
    version: '1.2.0',
    missionLine: 'Puts the right alert in front of the right person instantly.',
    description: 'Routes OpenSyber events to Slack channels with severity-based routing, thread grouping for related incidents, and one-click acknowledge and escalate buttons. Configurable quiet hours.',
    incidentTag: null,
    sourceLabel: 'Slack OAuth',
    sourceType: 'slack',
    planRequired: 'team',
  },
  {
    slug: 'dependency-auditor',
    name: 'Dependency Auditor',
    icon: '📦',
    category: 'security',
    version: '2.0.1',
    missionLine: 'Finds the CVE in your package.json before the attacker does.',
    description: 'Continuously monitors npm, pip, and Go modules against OSV and NVD databases. Generates SBOM in CycloneDX format. Flags critical vulnerabilities with upgrade paths.',
    incidentTag: 'CVE detection',
    incidentSeverity: 'high',
    sourceLabel: 'GitHub App',
    sourceType: 'github_app',
    planRequired: 'free',
  },
  {
    slug: 'git-guardian',
    name: 'Git Guardian',
    icon: '🔒',
    category: 'cicd',
    version: '1.5.0',
    missionLine: 'Enforces the rules your team agreed to but nobody checks.',
    description: 'Pre-commit and pre-push enforcement: blocks secrets, large binaries, and force-pushes to protected branches. Validates commit message format and branch naming conventions.',
    incidentTag: null,
    sourceLabel: 'Git hook (1 command)',
    sourceType: 'git_hook',
    planRequired: 'free',
  },
  {
    slug: 'supply-chain-guard',
    name: 'Supply Chain Guard',
    icon: '🛡',
    category: 'security',
    version: '1.3.0',
    missionLine: 'Blocks the CanisterWorm pattern before it installs.',
    description: 'Checks every npm, PyPI, and Go module install against Socket.dev threat feed and OpenSyber IOC database. Detects typosquatting, suspicious postinstall scripts, and unexpected network calls.',
    incidentTag: 'CanisterWorm / Clinejection',
    incidentSeverity: 'critical',
    sourceLabel: 'GitHub App or agent sidecar',
    sourceType: 'github_app',
    planRequired: 'team',
  },
  {
    slug: 'log-analyzer',
    name: 'Log Analyzer',
    icon: '📊',
    category: 'runtime',
    version: '2.1.0',
    missionLine: 'Finds the attack pattern buried in 2 million log lines.',
    description: 'Ingests syslog, JSON, and structured log formats. Uses statistical analysis to detect authentication spikes, unusual request volumes, and intrusion indicators. Learns your normal baseline.',
    incidentTag: null,
    sourceLabel: 'Agent sidecar or log file',
    sourceType: 'agent',
    planRequired: 'team',
  },
  {
    slug: 'container-hardening',
    name: 'Container Hardening',
    icon: '🐳',
    category: 'compliance',
    version: '1.4.0',
    missionLine: 'Finds the root container before your auditor does.',
    description: 'Audits Docker containers and Kubernetes pods against the CIS Docker Benchmark. Detects root user execution, excessive capabilities, missing seccomp profiles, and exposed ports.',
    incidentTag: 'CIS compliance',
    incidentSeverity: 'high',
    sourceLabel: 'GitHub App or Docker socket',
    sourceType: 'github_app',
    planRequired: 'team',
  },
  {
    slug: 'siem-forwarder',
    name: 'SIEM Forwarder',
    icon: '📤',
    category: 'alerts',
    version: '1.1.0',
    missionLine: 'Puts AI agent events where your SOC already looks.',
    description: 'Streams all OpenSyber events to Splunk HEC, Datadog Logs, or Elastic in real time. Maps severity levels to SIEM-native tiers and adds enrichment fields for correlation.',
    incidentTag: null,
    sourceLabel: 'SIEM API key',
    sourceType: 'api_key',
    planRequired: 'professional',
  },
  {
    slug: 'network-sentinel',
    name: 'Network Sentinel',
    icon: '📡',
    category: 'runtime',
    version: '1.1.0',
    missionLine: 'Blocked the TeamPCP exfiltration call in 12ms.',
    description: 'Real-time analysis of every outbound connection from your agent environment. Checks against 847+ IOC domains. Detects DNS exfiltration, beaconing patterns, and typosquatted destinations.',
    incidentTag: 'Trivy exfiltration vector',
    incidentSeverity: 'critical',
    sourceLabel: 'Agent sidecar (required)',
    sourceType: 'agent',
    planRequired: 'team',
  },
  {
    slug: 'compliance-reporter',
    name: 'Compliance Reporter',
    icon: '📋',
    category: 'compliance',
    version: '1.1.0',
    missionLine: 'Generates the report your auditor needs without the scramble.',
    description: 'Auto-generates PDF evidence packages for SOC 2, ISO 27001, HIPAA, and GDPR. Maps OpenSyber security data to specific framework controls with executive summaries.',
    incidentTag: null,
    sourceLabel: 'No source needed',
    sourceType: 'internal',
    planRequired: 'professional',
  },
  {
    slug: 'cursor-monitor',
    name: 'Cursor Monitor',
    icon: '👁',
    category: 'ai',
    version: '1.0.0',
    missionLine: 'Watches every file the AI touches — including the ones it shouldn\'t.',
    description: 'Cursor IDE telemetry that tracks file access patterns by the AI agent. Alerts when Cursor reads .env files, SSH keys, or production configs. Detects prompt injection attempts.',
    incidentTag: 'AI agent security',
    incidentSeverity: 'high',
    sourceLabel: 'Agent sidecar (required)',
    sourceType: 'agent',
    planRequired: 'team',
  },
  {
    slug: 'iac-scanner',
    name: 'IaC Security Scanner',
    icon: '🏗',
    category: 'compliance',
    version: '1.0.0',
    missionLine: 'Catches the public S3 bucket before it reaches production.',
    description: 'Static analysis for Terraform, CloudFormation, Pulumi, and Kubernetes manifests. Detects public storage, wildcard IAM policies, unencrypted databases, and open security groups.',
    incidentTag: null,
    sourceLabel: 'GitHub App',
    sourceType: 'github_app',
    planRequired: 'team',
  },
  {
    slug: 'pagerduty-escalation',
    name: 'PagerDuty Escalation',
    icon: '🚨',
    category: 'alerts',
    version: '1.0.0',
    missionLine: 'Makes sure the critical alert wakes the right person at 3am.',
    description: 'Automatic PagerDuty incident creation for critical security events. Maps OpenSyber severity to PagerDuty urgency tiers. Deduplicates alerts and auto-resolves when threats are contained.',
    incidentTag: null,
    sourceLabel: 'PagerDuty API key',
    sourceType: 'api_key',
    planRequired: 'professional',
  },
  {
    slug: 'api-fuzzer',
    name: 'API Fuzzer',
    icon: '⚡',
    category: 'security',
    version: '1.0.0',
    missionLine: 'Finds the auth bypass before the attacker does.',
    description: 'Automated API security testing against your staging environment. Tests OWASP API Top 10: injection flaws, authentication bypasses, rate limit evasion, IDOR, and mass assignment vulnerabilities.',
    incidentTag: null,
    sourceLabel: 'OpenAPI spec or manual endpoints',
    sourceType: 'api_target',
    planRequired: 'professional',
  },
  {
    slug: 'secret-vault-bridge',
    name: 'Secret Vault Bridge',
    icon: '🔐',
    category: 'security',
    version: '1.0.0',
    missionLine: 'Ensures agents never read secrets from flat files.',
    description: 'Monitors whether agents access secrets through HashiCorp Vault or AWS Secrets Manager vs reading directly from .env files or config files on disk. Flags policy violations and requests JIT tokens.',
    incidentTag: 'Clinejection vector',
    incidentSeverity: 'high',
    sourceLabel: 'Agent sidecar + Vault/AWS',
    sourceType: 'agent',
    planRequired: 'professional',
  },
]

Tab filter JavaScript:
  function filterSkills(category) {
    document.querySelectorAll('.mp-tab').forEach(t => t.classList.remove('active'))
    event.target.classList.add('active')
    document.querySelectorAll('.skill-card').forEach(card => {
      const show = category === 'all' || card.dataset.category === category
      card.style.display = show ? '' : 'none'
    })
  }

  // Wire up tabs
  document.querySelectorAll('.mp-tab[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => filterSkills(tab.dataset.filter))
  })


WHEN DONE: verify:
  ✓ Page hero shows "15 skills. Every attack vector covered."
  ✓ Tabs show: All | Security | CI/CD | Compliance | AI Agents | Runtime | Alerts | Bundles →
  ✓ Bundles promo banner shows above skill grid
  ✓ All 15 skill cards show with new data
  ✓ NO review counts or install numbers anywhere
  ✓ Each card shows: mission line, source requirement, plan required
  ✓ Incident tags on relevant skills (red for Trivy/CanisterWorm, amber for others)
  ✓ Tab filtering works
  ✓ Cards link to /marketplace/{slug}

Output: "AGENT H COMPLETE — marketplace rebuilt"
```

---

# ══════════════════════════════════════
# AGENT I — 15 SKILL DETAIL PAGES
# src/routes/marketplace/[slug]/+page.svelte
# Currently ALL 404 — most urgent fix
# ══════════════════════════════════════

```prompt
You are building the individual skill detail pages for OpenSyber.
Currently every skill link (e.g. /marketplace/secret-scanner) returns 404.
This is the most urgent fix — it breaks every skill card click.

FILE: src/routes/marketplace/[slug]/+page.svelte
FILE: src/routes/marketplace/[slug]/+page.server.ts (load function)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATA LOADING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create the load function in +page.server.ts:

import { error } from '@sveltejs/kit'
import { SKILLS } from '$lib/data/skills'  // the skills array from Agent H

export const load = ({ params }) => {
  const skill = SKILLS.find(s => s.slug === params.slug)
  if (!skill) throw error(404, 'Skill not found')
  return { skill }
}

Move the skills array to: src/lib/data/skills.ts
Export it as: export const SKILLS = [...]
Import it in both the marketplace page and the detail page.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — DETAIL PAGE LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The detail page has 6 sections:
  1. Header (breadcrumb + skill name + badges + install button)
  2. Mission statement (what attack does this stop?)
  3. How it works (3-step flow: connect source → configure → detect)
  4. What it detects (specific findings with examples)
  5. Quick start (copy-paste setup)
  6. Related skills + back to marketplace

Build it as:

<script>
  export let data  // { skill }
  $: skill = data.skill
</script>

<svelte:head>
  <title>{skill.name} | OpenSyber</title>
  <meta name="description" content="{skill.missionLine} {skill.description}" />
</svelte:head>

<!-- BREADCRUMB -->
<div class="breadcrumb">
  <a href="/marketplace">← Marketplace</a>
  <span>/</span>
  <span>{skill.name}</span>
</div>

<!-- SKILL HEADER -->
<section class="skill-header">
  <div class="skill-header-left">
    <div class="skill-detail-icon">{skill.icon}</div>
    <div>
      <div class="skill-badges-row">
        <span class="category-tag">{skill.category}</span>
        <span class="verified-badge">✓ Verified</span>
        <span class="version-tag">v{skill.version}</span>
        {#if skill.incidentTag}
          <span class="incident-tag {skill.incidentSeverity}">{skill.incidentTag}</span>
        {/if}
      </div>
      <h1 class="skill-detail-name">{skill.name}</h1>
      <p class="skill-detail-mission">{skill.missionLine}</p>
    </div>
  </div>
  <div class="skill-header-right">
    <div class="skill-source-info">
      <span class="source-label">Requires:</span>
      <span class="source-value">{skill.sourceLabel}</span>
    </div>
    <div class="skill-plan-info">
      <span class="plan-label">Included in:</span>
      <span class="plan-value plan-{skill.planRequired}">
        {skill.planRequired === 'free' ? 'Free plan' :
         skill.planRequired === 'team' ? 'Team ($299/mo)' :
         'Professional ($799/mo)'}
      </span>
    </div>
    <a href="/sign-up" class="install-btn-large">Install this skill →</a>
  </div>
</section>

<!-- MISSION SECTION (what attack does this stop?) -->
{#if skill.incidentTag}
<section class="skill-incident">
  <div class="skill-incident-inner">
    <span class="skill-incident-badge {skill.incidentSeverity}">
      Real incident
    </span>
    <p class="skill-incident-text">
      {getIncidentContext(skill.slug)}
    </p>
    <a href="/blog/trivy-supply-chain-attack" class="skill-incident-link">
      Read the full incident breakdown →
    </a>
  </div>
</section>
{/if}

<!-- FULL DESCRIPTION -->
<section class="skill-description">
  <h2>What it does</h2>
  <p>{skill.description}</p>
  <div class="skill-detail-features">
    {#each getDetailFeatures(skill.slug) as feature}
      <div class="detail-feature">
        <span class="detail-feature-icon">✓</span>
        <span>{feature}</span>
      </div>
    {/each}
  </div>
</section>

<!-- HOW IT WORKS (3 steps) -->
<section class="skill-howto">
  <h2>How to get protected</h2>
  <div class="howto-steps">
    <div class="howto-step">
      <div class="step-num">01</div>
      <div class="step-title">Connect {skill.sourceLabel}</div>
      <div class="step-desc">{getSourceInstructions(skill.sourceType)}</div>
    </div>
    <div class="howto-step">
      <div class="step-num">02</div>
      <div class="step-title">Configure alerts</div>
      <div class="step-desc">
        Set severity thresholds and route alerts to Slack, PagerDuty, or email.
        Defaults work for most teams.
      </div>
    </div>
    <div class="howto-step">
      <div class="step-num">03</div>
      <div class="step-title">Run a test</div>
      <div class="step-desc">
        Click "Run Simulation" to verify the skill is working.
        Takes 10 seconds. Shows exactly what an alert looks like.
      </div>
    </div>
  </div>
</section>

<!-- QUICK START CODE BLOCK -->
<section class="skill-quickstart">
  <h2>Quick start</h2>
  <div class="quickstart-code">
    <div class="code-header">
      <span class="code-label">{getQuickStartLabel(skill.sourceType)}</span>
      <button class="copy-btn" onclick="copyCode(this)">Copy</button>
    </div>
    <pre class="code-block">{getQuickStartCode(skill.slug, skill.sourceType)}</pre>
  </div>
</section>

<!-- PLAN CTA -->
<section class="skill-plan-cta">
  <div class="plan-cta-inner">
    <div>
      <div class="plan-cta-label">Available on</div>
      <div class="plan-cta-name">
        {skill.planRequired === 'free' ? 'Free plan — no credit card' :
         skill.planRequired === 'team' ? 'Team plan — $299/month' :
         'Professional plan — $799/month'}
      </div>
    </div>
    <a href="/sign-up" class="btn btn-primary">
      Start free → install {skill.name}
    </a>
  </div>
</section>

<!-- RELATED SKILLS -->
<section class="skill-related">
  <h2>Often installed together</h2>
  <div class="related-grid">
    {#each getRelatedSkills(skill.slug) as related}
      <a href="/marketplace/{related.slug}" class="related-card">
        <span class="related-icon">{related.icon}</span>
        <div>
          <div class="related-name">{related.name}</div>
          <div class="related-mission">{related.missionLine}</div>
        </div>
      </a>
    {/each}
  </div>
</section>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HELPER FUNCTIONS (add to page script)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getIncidentContext(slug: string): string {
  const contexts = {
    'secret-scanner': 'During the Trivy attack, stolen credentials were used to poison GitHub Action tags. A single leaked PAT with write access enabled TeamPCP to redirect 76 version tags to malicious commits. Secret Scanner prevents the credential leak that starts this chain.',
    'supply-chain-guard': 'The CanisterWorm campaign spread through 47 npm packages using stolen publish tokens. Each package had a malicious postinstall script. Supply Chain Guard intercepts postinstall execution before a single line runs.',
    'network-sentinel': 'TeamPCP exfiltrated stolen credentials to scan.aquasecurtiy[.]org — a typosquatted domain that bypassed most DNS filters. Network Sentinel checks every outbound call against the IOC feed. That domain would have been blocked in 12ms.',
    'cursor-monitor': 'Compromised AI coding agents are being used to read .env files and production credentials. Cursor Monitor watches every file the AI touches and alerts when it accesses anything outside its expected scope.',
    'secret-vault-bridge': 'The Clinejection attack exploited an AI workflow that had direct access to npm publish tokens. Secret Vault Bridge ensures agents always retrieve credentials through Vault — never from files on disk.',
    'container-hardening': 'Containers running as root with writable filesystems are one of the most exploited patterns in supply chain attacks. Once an attacker has code execution in your CI, they need a misconfigured container to escalate.',
  }
  return contexts[slug] || ''
}

function getSourceInstructions(sourceType: string): string {
  const instructions = {
    'github_app': 'Click "Connect GitHub" to install the OpenSyber GitHub App. Select which repos to monitor. Takes 60 seconds.',
    'git_hook': 'Run one command in your terminal: curl -fsSL https://opensyber.cloud/install/hook | sh — installs into your current repo.',
    'agent': 'Add one step to your GitHub Actions workflow or install the agent locally: brew install opensyber && opensyber start',
    'slack': 'Click "Connect Slack" to authorize OpenSyber. Select the channel for alerts. Takes 30 seconds.',
    'api_key': 'Paste your API key in the configuration panel. We store it encrypted in the credential vault.',
    'api_target': 'Paste your OpenAPI spec URL or enter endpoint URLs manually in the configuration panel.',
    'internal': 'No external source needed. This skill uses data already collected by your other active skills.',
  }
  return instructions[sourceType] || 'Connect a source in the setup wizard.'
}

function getQuickStartCode(slug: string, sourceType: string): string {
  const codes = {
    'secret-scanner': `# GitHub Actions — add to any workflow
- name: OpenSyber Secret Scanner
  uses: opensyber/secret-scanner-action@abc123sha
  with:
    token: \${{ secrets.OPENSYBER_TOKEN }}
    fail_on: HIGH`,

    'network-sentinel': `# Add to GitHub Actions workflow
- name: OpenSyber Network Sentinel
  uses: opensyber/agent-action@abc123sha
  with:
    token: \${{ secrets.OPENSYBER_TOKEN }}
    mode: network-sentinel
    block_mode: true`,

    'git-guardian': `# Install git hook (run in your repo)
curl -fsSL https://opensyber.cloud/install/hook | sh

# Or install globally (all repos)
opensyber hook install --global`,

    'supply-chain-guard': `# GitHub Actions — scans every PR
- name: OpenSyber Supply Chain Guard
  uses: opensyber/supply-chain-action@abc123sha
  with:
    token: \${{ secrets.OPENSYBER_TOKEN }}
    block_on_critical: true`,

    'cursor-monitor': `# Install OpenSyber agent locally
brew install opensyber  # macOS
# or: curl -fsSL https://get.opensyber.cloud | sh

# Start monitoring
opensyber start --token=YOUR_TOKEN
opensyber enable cursor-monitor`,

    'dependency-auditor': `# Automatic on GitHub push
# Connects via GitHub App — no workflow changes needed
# Or run manually:
opensyber scan deps --repo=your-org/your-repo`,

    'compliance-reporter': `# Generate SOC 2 report from dashboard
# Or via API:
curl -X POST https://api.opensyber.cloud/reports/soc2 \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"period": "2026-Q1", "format": "pdf"}'`,

    'siem-forwarder': `# Configure in dashboard: Settings → Integrations → SIEM
# Or via API:
curl -X POST https://api.opensyber.cloud/integrations/siem \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"type": "splunk", "url": "https://splunk.your-co.com:8088", "token": "HEC_TOKEN"}'`,
  }
  return codes[slug] || `# Install via dashboard or CLI
opensyber skill install ${slug} --token=YOUR_TOKEN`
}

function getQuickStartLabel(sourceType: string): string {
  const labels = {
    'github_app': 'GitHub Actions',
    'git_hook': 'Terminal',
    'agent': 'Terminal or GitHub Actions',
    'slack': 'Dashboard',
    'api_key': 'API',
    'api_target': 'API',
    'internal': 'Dashboard',
  }
  return labels[sourceType] || 'Terminal'
}

function getDetailFeatures(slug: string): string[] {
  const features = {
    'secret-scanner': [
      '120+ secret patterns: AWS, GCP, Azure, GitHub, Anthropic, OpenAI, Stripe, Twilio, database URIs',
      'Detects secrets in: source code, config files, .env files, and commit diffs',
      'Reports: file path, line number, secret type, and one-command remediation',
      'Pre-commit hook mode: blocks the commit before the secret enters git history',
      'Historical scan: check the last 90 days of commits for already-committed secrets',
    ],
    'network-sentinel': [
      'Checks every outbound domain against 847+ IOC entries in real time',
      'Detects DNS exfiltration attempts (long subdomains, hex-encoded data)',
      'Identifies beaconing patterns (calls at fixed intervals — C2 indicator)',
      'Flags domains registered < 30 days ago (typosquatting indicator)',
      'Learning mode: first 7 days, learns your normal traffic before alerting',
      'Block mode: can terminate CI jobs when unauthorized calls are detected',
    ],
    'supply-chain-guard': [
      'Intercepts every npm install, pip install, and go get at runtime',
      'Checks package names for typosquatting (edit distance from popular packages)',
      'Analyzes postinstall scripts for: network calls, global installs, file writes',
      'Matches packages against Socket.dev threat feed (4,600+ known-bad packages)',
      'Detects: new packages (<7 days old), packages with sudden ownership changes',
    ],
    'git-guardian': [
      'Blocks force-pushes to protected branches (main, master, release/*)',
      'Enforces commit message format: feat/fix/chore/docs/refactor prefix',
      'Blocks large binary files (configurable size threshold)',
      'Validates branch naming conventions',
      'Integrates with Secret Scanner to block secrets on commit',
    ],
    'cursor-monitor': [
      'Tracks every file Cursor AI reads, edits, or creates',
      'Alerts when Cursor accesses: .env, .ssh/*, credentials, production configs',
      'Detects prompt injection attempts in AI completions',
      'Correlates file access with sensitivity classification',
      'Session timeline: see exactly what the AI did in each coding session',
    ],
    'dependency-auditor': [
      'Monitors package.json, requirements.txt, go.mod, pom.xml, Cargo.toml',
      'Databases: OSV, NVD, GitHub Advisory Database — updated hourly',
      'Generates SBOM in CycloneDX format (required for many enterprise contracts)',
      'Shows upgrade path for every finding: "upgrade to lodash@4.17.21"',
      'Blocks PR merge on CRITICAL vulnerabilities (configurable)',
    ],
  }
  return features[slug] || [
    'Verified through 4-stage security audit',
    'Integrates with OpenSyber alert pipeline',
    'Configurable severity thresholds',
    'Audit log of all findings',
  ]
}

function getRelatedSkills(slug: string): any[] {
  const related = {
    'secret-scanner': ['git-guardian', 'network-sentinel', 'supply-chain-guard'],
    'network-sentinel': ['supply-chain-guard', 'secret-scanner', 'siem-forwarder'],
    'supply-chain-guard': ['network-sentinel', 'dependency-auditor', 'secret-scanner'],
    'git-guardian': ['secret-scanner', 'dependency-auditor', 'cursor-monitor'],
    'cursor-monitor': ['secret-vault-bridge', 'network-sentinel', 'secret-scanner'],
    'dependency-auditor': ['supply-chain-guard', 'iac-scanner', 'compliance-reporter'],
    'compliance-reporter': ['container-hardening', 'dependency-auditor', 'siem-forwarder'],
    'container-hardening': ['iac-scanner', 'compliance-reporter', 'network-sentinel'],
    'slack-security-alerts': ['pagerduty-escalation', 'siem-forwarder', 'network-sentinel'],
    'pagerduty-escalation': ['slack-security-alerts', 'siem-forwarder', 'network-sentinel'],
    'siem-forwarder': ['slack-security-alerts', 'pagerduty-escalation', 'compliance-reporter'],
    'secret-vault-bridge': ['cursor-monitor', 'secret-scanner', 'network-sentinel'],
    'iac-scanner': ['container-hardening', 'compliance-reporter', 'dependency-auditor'],
    'api-fuzzer': ['secret-scanner', 'network-sentinel', 'dependency-auditor'],
    'log-analyzer': ['network-sentinel', 'siem-forwarder', 'slack-security-alerts'],
  }
  const relatedSlugs = related[slug] || []
  return relatedSlugs.map(s => SKILLS.find(sk => sk.slug === s)).filter(Boolean)
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLES FOR DETAIL PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

.breadcrumb {
  display: flex; gap: 8px; align-items: center;
  font-size: 13px; color: var(--text3); margin-bottom: 32px;
  padding-top: 24px;
}
.breadcrumb a { color: var(--blue2); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }

.skill-header {
  display: flex; justify-content: space-between;
  align-items: flex-start; gap: 32px;
  margin-bottom: 48px; flex-wrap: wrap;
}
.skill-header-left { display: flex; gap: 20px; align-items: flex-start; }
.skill-detail-icon {
  width: 56px; height: 56px; border-radius: 14px;
  background: rgba(27,111,255,.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; flex-shrink: 0;
}
.skill-badges-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.category-tag {
  font-size: 11px; font-weight: 600; padding: 3px 8px;
  border-radius: 4px; text-transform: capitalize;
  background: var(--surface2); border: 1px solid var(--border2);
  color: var(--text2);
}
.version-tag {
  font-size: 11px; color: var(--text3);
  font-family: var(--font-mono); padding: 3px 8px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 4px;
}
.skill-detail-name {
  font-family: var(--font-display);
  font-size: 32px; font-weight: 800;
  letter-spacing: -.03em; color: var(--text); margin-bottom: 6px;
}
.skill-detail-mission {
  font-size: 16px; color: var(--blue2); font-weight: 500;
}
.skill-header-right {
  display: flex; flex-direction: column;
  gap: 10px; min-width: 220px;
}
.skill-source-info, .skill-plan-info {
  display: flex; flex-direction: column; gap: 3px;
}
.source-label, .plan-label {
  font-size: 11px; color: var(--text3); text-transform: uppercase;
  letter-spacing: .06em;
}
.source-value, .plan-value {
  font-size: 13px; font-weight: 500; color: var(--text2);
}
.plan-value.plan-free { color: var(--green); }
.plan-value.plan-team { color: var(--blue2); }
.plan-value.plan-professional { color: var(--amber); }
.install-btn-large {
  display: inline-flex; align-items: center;
  padding: 13px 24px; border-radius: 10px;
  background: var(--blue); color: white;
  text-decoration: none; font-weight: 600;
  font-size: 15px; transition: all .2s; text-align: center;
  justify-content: center;
}
.install-btn-large:hover {
  background: var(--blue2);
  box-shadow: 0 6px 20px rgba(27,111,255,.4);
}

.skill-incident {
  background: rgba(255,75,75,.05);
  border: 1px solid rgba(255,75,75,.2);
  border-radius: 12px; padding: 20px 24px;
  margin-bottom: 40px;
}
.skill-incident-inner { display: flex; flex-direction: column; gap: 8px; }
.skill-incident-badge {
  font-size: 10px; font-weight: 700;
  padding: 3px 8px; border-radius: 4px;
  width: fit-content; letter-spacing: .06em;
}
.skill-incident-badge.critical {
  background: rgba(255,75,75,.15); color: var(--red);
}
.skill-incident-badge.high {
  background: rgba(245,166,35,.12); color: var(--amber);
}
.skill-incident-text { font-size: 14px; color: var(--text2); line-height: 1.65; }
.skill-incident-link { font-size: 13px; color: var(--red); font-weight: 600; text-decoration: none; }
.skill-incident-link:hover { text-decoration: underline; }

.skill-description { margin-bottom: 48px; }
.skill-description h2, .skill-howto h2, .skill-quickstart h2, .skill-related h2 {
  font-family: var(--font-display); font-size: 22px;
  font-weight: 700; color: var(--text); margin-bottom: 16px;
}
.skill-description p { font-size: 15px; color: var(--text2); line-height: 1.7; margin-bottom: 20px; }
.skill-detail-features { display: flex; flex-direction: column; gap: 10px; }
.detail-feature {
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 14px; color: var(--text2);
}
.detail-feature-icon { color: var(--green); font-weight: 700; flex-shrink: 0; }

.howto-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.howto-step {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: 12px; padding: 20px;
}
.step-num {
  font-family: var(--font-display); font-size: 28px;
  font-weight: 800; color: var(--blue2); margin-bottom: 8px;
}
.step-title { font-weight: 600; font-size: 15px; color: var(--text); margin-bottom: 8px; }
.step-desc { font-size: 13px; color: var(--text3); line-height: 1.6; }

.skill-quickstart { margin: 48px 0; }
.quickstart-code {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 12px; overflow: hidden;
}
.code-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.code-label { font-size: 12px; color: var(--text3); font-weight: 500; }
.copy-btn {
  font-size: 12px; color: var(--blue2); background: none;
  border: 1px solid rgba(27,111,255,.3); border-radius: 4px;
  padding: 4px 10px; cursor: pointer; font-family: var(--font-body);
}
.code-block {
  padding: 20px; margin: 0;
  font-family: var(--font-mono); font-size: 13px;
  color: var(--text2); line-height: 1.7; overflow-x: auto;
  white-space: pre;
}

.skill-plan-cta {
  background: linear-gradient(120deg, rgba(27,111,255,.08), rgba(0,229,160,.04));
  border: 1px solid rgba(27,111,255,.2);
  border-radius: 14px; padding: 28px 32px; margin: 48px 0;
}
.plan-cta-inner {
  display: flex; justify-content: space-between; align-items: center;
}
.plan-cta-label { font-size: 12px; color: var(--text3); margin-bottom: 4px; }
.plan-cta-name {
  font-family: var(--font-display); font-size: 20px;
  font-weight: 700; color: var(--text);
}

.related-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
}
.related-card {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 14px 16px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 10px;
  text-decoration: none; transition: border-color .2s;
}
.related-card:hover { border-color: var(--border2); }
.related-icon { font-size: 18px; flex-shrink: 0; }
.related-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
.related-mission { font-size: 12px; color: var(--text3); }

@media (max-width: 768px) {
  .skill-header { flex-direction: column; }
  .howto-steps { grid-template-columns: 1fr; }
  .related-grid { grid-template-columns: 1fr; }
  .plan-cta-inner { flex-direction: column; gap: 16px; }
}


WHEN DONE: verify by visiting each URL:
  ✓ /marketplace/secret-scanner — loads with full content
  ✓ /marketplace/network-sentinel — loads, shows Trivy incident context
  ✓ /marketplace/supply-chain-guard — loads, shows CanisterWorm context
  ✓ /marketplace/cursor-monitor — loads
  ✓ /marketplace/nonexistent — returns proper 404 page
  ✓ All skill detail pages: breadcrumb, header, description, quickstart, related
  ✓ "Install this skill" button present on all pages
  ✓ Quick start code block has copy button

Output: "AGENT I COMPLETE — 15 skill detail pages live"
```

---

# ══════════════════════════════════════
# AGENT J — BUNDLES PAGE (NEW PAGE)
# src/routes/marketplace/bundles/+page.svelte
# This page does not exist yet
# ══════════════════════════════════════

```prompt
You are creating the OpenSyber bundles page from scratch.
This page does not exist yet.
The bundles concept: curated skill sets + single source connection
+ discount vs individual skills. Mission-first framing.

FILE TO CREATE: src/routes/marketplace/bundles/+page.svelte

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<svelte:head>
  <title>Skill Bundles — One click. Full protection. | OpenSyber</title>
</svelte:head>

<section class="bundles-hero">
  <div class="container">
    <a href="/marketplace" class="back-link">← All skills</a>
    <div class="bundles-eyebrow">Skill Bundles</div>
    <h1 class="bundles-title">
      One click.<br><em>Full protection.</em>
    </h1>
    <p class="bundles-sub">
      Pre-packaged skill sets that solve a complete security problem.
      One source connection activates the whole bundle.
      Save up to 47% vs installing skills individually.
    </p>

    <div class="bundles-filter-tabs">
      <button class="filter-tab active" data-filter="all">All</button>
      <button class="filter-tab" data-filter="cicd">CI/CD</button>
      <button class="filter-tab" data-filter="compliance">Compliance</button>
      <button class="filter-tab" data-filter="runtime">Runtime</button>
      <button class="filter-tab" data-filter="ai">AI Agents</button>
    </div>
  </div>
</section>


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FREE STARTER BANNER (always visible)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<div class="container">
  <div class="free-starter-banner">
    <div class="free-starter-left">
      <span class="free-starter-icon">🎁</span>
      <div>
        <div class="free-starter-title">
          Free Starter Bundle — active on every account
        </div>
        <div class="free-starter-desc">
          Secret Scanner + Git Guardian + Dependency Auditor.
          Free forever. No credit card. Activate in 60 seconds.
        </div>
      </div>
    </div>
    <a href="/sign-up" class="free-starter-cta">Get started free →</a>
  </div>
</div>

Styles:
.free-starter-banner {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(0,229,160,.06); border: 1px solid rgba(0,229,160,.2);
  border-radius: 12px; padding: 18px 24px; margin-bottom: 32px;
}
.free-starter-left { display: flex; gap: 14px; align-items: center; }
.free-starter-icon { font-size: 24px; }
.free-starter-title { font-weight: 600; font-size: 14px; color: var(--text); margin-bottom: 3px; }
.free-starter-desc { font-size: 13px; color: var(--text2); }
.free-starter-cta {
  font-size: 13px; font-weight: 600; color: var(--green);
  text-decoration: none; white-space: nowrap; margin-left: 16px;
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUNDLE DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define this in the script:

const bundles = [
  {
    id: 'supply-chain-defense',
    name: 'Supply Chain Defense',
    category: 'cicd',
    icon: '🛡',
    accentColor: '#1B6FFF',
    featured: true,
    tagline: 'Complete protection against Trivy-class supply chain attacks.',
    incidentRef: 'Stops the Trivy / TeamPCP attack pattern',
    incidentSeverity: 'critical',
    sourceLabel: 'GitHub App',
    sourceDesc: 'One connection activates all 4 skills across all your repos.',
    priceMonthly: 49,
    priceIndividual: 79,
    skills: [
      { name: 'CI/CD Supply Chain Guardian', tag: 'new', desc: 'SHA pinning + IOC blocking' },
      { name: 'Supply Chain Guard', tag: 'core', desc: 'npm/pip/Go runtime protection' },
      { name: 'Network Sentinel', tag: 'core', desc: 'IOC domain blocking' },
      { name: 'Dependency Auditor', tag: 'core', desc: 'CVE scanning on push' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Simulating Trivy attack against your repos...' },
      { cls: 't-dim',  text: '  Scanning for aquasecurity/trivy-action references...' },
      { cls: 't-fail', text: '  ⚠ 3 repos use mutable tag @v0.32.0 (vulnerable)' },
      { cls: 't-pass', text: '  ✓ CI/CD Guardian would have blocked all 3 pushes' },
      { cls: 't-info', text: '▸ Simulating CanisterWorm npm install...' },
      { cls: 't-pass', text: '  ✓ Supply Chain Guard: typosquatted package blocked' },
      { cls: 't-info', text: '▸ Simulating call to scan.aquasecurtiy[.]org...' },
      { cls: 't-pass', text: '  ✓ Network Sentinel: IOC domain blocked in 12ms' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  ALL TESTS PASSED — you are protected ✓' },
    ],
  },
  {
    id: 'ai-agent-security',
    name: 'AI Agent Security',
    category: 'ai',
    icon: '🤖',
    accentColor: '#9B6DFF',
    featured: false,
    tagline: 'Protect Claude Code, Cursor, and Windsurf from prompt injection and credential theft.',
    incidentRef: 'Stops the Clinejection / CLAUDE.md poisoning pattern',
    incidentSeverity: 'high',
    sourceLabel: 'Agent + GitHub App',
    sourceDesc: 'Install local agent + connect GitHub. Takes 5 minutes.',
    priceMonthly: 59,
    priceIndividual: 89,
    skills: [
      { name: 'AI Prompt Guard', tag: 'new', desc: 'Injection detection in CI workflows' },
      { name: 'Agent Instruction File Guardian', tag: 'new', desc: 'CLAUDE.md poisoning protection' },
      { name: 'Cursor Monitor', tag: 'core', desc: 'File access telemetry' },
      { name: 'Secret Vault Bridge', tag: 'core', desc: 'Vault-only secret access' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Simulating CLAUDE.md poisoning attack (hackerbot-claw)...' },
      { cls: 't-dim',  text: '  PR opened with modified CLAUDE.md containing injection payload' },
      { cls: 't-pass', text: '  ✓ Instruction Guardian: payload detected, PR merge blocked' },
      { cls: 't-info', text: '▸ Simulating Cursor reading .env.production...' },
      { cls: 't-pass', text: '  ✓ Cursor Monitor: HIGH alert fired, access logged' },
      { cls: 't-info', text: '▸ Simulating agent reading secret from disk (not Vault)...' },
      { cls: 't-pass', text: '  ✓ Vault Bridge: unapproved access blocked and logged' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  ALL TESTS PASSED — AI agents secured ✓' },
    ],
  },
  {
    id: 'compliance-ready',
    name: 'Compliance Ready',
    category: 'compliance',
    icon: '📋',
    accentColor: '#00E5A0',
    featured: false,
    tagline: 'SOC 2, HIPAA, GDPR evidence collected automatically. Audit without the scramble.',
    incidentRef: null,
    sourceLabel: 'GitHub App',
    sourceDesc: 'GitHub App activates 3 skills. Add agent for runtime log analysis.',
    priceMonthly: 49,
    priceIndividual: 84,
    skills: [
      { name: 'Compliance Reporter', tag: 'core', desc: 'SOC2 / HIPAA / GDPR PDFs' },
      { name: 'Log Analyzer', tag: 'core', desc: 'Anomaly detection in logs' },
      { name: 'Container Hardening', tag: 'core', desc: 'CIS Docker Benchmark' },
      { name: 'SIEM Forwarder', tag: 'hot', desc: 'Splunk / Datadog / Elastic' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Generating SOC 2 sample report...' },
      { cls: 't-dim',  text: '  Collecting evidence from last 30 days of agent activity...' },
      { cls: 't-pass', text: '  ✓ 19/27 controls passing' },
      { cls: 't-warn', text: '  ⚠ 5 controls partially met — details in report' },
      { cls: 't-pass', text: '  ✓ Report generated: 24 pages, PDF ready' },
      { cls: 't-info', text: '▸ Container hardening scan...' },
      { cls: 't-pass', text: '  ✓ 6/8 containers passing CIS benchmark' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  COMPLIANCE BUNDLE WORKING ✓' },
    ],
  },
  {
    id: 'cicd-hardening',
    name: 'CI/CD Hardening',
    category: 'cicd',
    icon: '⚡',
    accentColor: '#F5A623',
    featured: false,
    tagline: 'Lock down every GitHub Actions misconfiguration exploited in 2025–2026.',
    incidentRef: 'Stops pull_request_target abuse (hackerbot-claw pattern)',
    incidentSeverity: 'critical',
    sourceLabel: 'GitHub App',
    sourceDesc: 'One OAuth connection scans all your workflow files automatically.',
    priceMonthly: 39,
    priceIndividual: 69,
    skills: [
      { name: 'Workflow Trigger Auditor', tag: 'new', desc: 'Detects 7 dangerous trigger patterns' },
      { name: 'Workflow Permissions Auditor', tag: 'new', desc: 'Finds over-permissioned workflows' },
      { name: 'CI/CD Supply Chain Guardian', tag: 'new', desc: 'SHA pinning enforcement' },
      { name: 'Git Guardian', tag: 'core', desc: 'Pre-push hook enforcement' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Scanning your workflows for dangerous patterns...' },
      { cls: 't-fail', text: '  ✗ backend-api: pull_request_target + checkout (CRITICAL)' },
      { cls: 't-fail', text: '  ✗ frontend: permissions: write-all (HIGH)' },
      { cls: 't-warn', text: '  ⚠ infra: schedule with secrets, no approval gate' },
      { cls: 't-pass', text: '  ✓ mobile-app: all patterns safe' },
      { cls: 't-info', text: '▸ SHA pinning coverage...' },
      { cls: 't-warn', text: '  22/93 actions use mutable tags — auto-fix PR ready' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  CI/CD HARDENING BUNDLE WORKING ✓' },
    ],
  },
  {
    id: 'runtime-defense',
    name: 'Runtime Defense',
    category: 'runtime',
    icon: '🔥',
    accentColor: '#FF4B4B',
    featured: false,
    tagline: 'Watch what your agents actually do — in real time, every action.',
    incidentRef: 'Stops runtime exfiltration (Trivy / TeamPCP pattern)',
    incidentSeverity: 'critical',
    sourceLabel: 'Agent sidecar (required)',
    sourceDesc: 'Install the agent in your CI pipeline or dev machine — 2 minutes.',
    priceMonthly: 49,
    priceIndividual: 79,
    skills: [
      { name: 'Network Sentinel', tag: 'core', desc: 'Every outbound call monitored' },
      { name: 'Log Analyzer', tag: 'core', desc: 'Auth spikes and anomalies' },
      { name: 'Secret Scanner', tag: 'core', desc: 'Pre-commit credential blocking' },
      { name: 'Secret Vault Bridge', tag: 'core', desc: 'Vault-only access enforcement' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Agent connection test...' },
      { cls: 't-pass', text: '  ✓ Agent heartbeat received (12ms latency)' },
      { cls: 't-info', text: '▸ Simulating TeamPCP exfiltration call...' },
      { cls: 't-pass', text: '  ✓ Network Sentinel: IOC domain blocked (8ms)' },
      { cls: 't-info', text: '▸ Simulating secret in commit...' },
      { cls: 't-pass', text: '  ✓ Secret Scanner: AWS key detected, commit blocked' },
      { cls: 't-info', text: '▸ Simulating auth spike in logs (50 failures / 30s)...' },
      { cls: 't-pass', text: '  ✓ Log Analyzer: brute force pattern detected — alert fired' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  RUNTIME BUNDLE FULLY ACTIVE ✓' },
    ],
  },
  {
    id: 'alert-response',
    name: 'Alert & Response',
    category: 'runtime',
    icon: '🔔',
    accentColor: '#00E5A0',
    featured: false,
    tagline: 'The right person gets paged the right way. No more missed 3am alerts.',
    incidentRef: null,
    sourceLabel: 'Slack + PagerDuty + SIEM',
    sourceDesc: 'Connect each destination with one OAuth or API key — 5 minutes total.',
    priceMonthly: 29,
    priceIndividual: 54,
    skills: [
      { name: 'Slack Security Alerts', tag: 'hot', desc: 'Rich messages + action buttons' },
      { name: 'PagerDuty Escalation', tag: 'hot', desc: 'On-call paging for criticals' },
      { name: 'SIEM Forwarder', tag: 'core', desc: 'Splunk / Datadog / Elastic' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Sending test alert to Slack #security-alerts...' },
      { cls: 't-pass', text: '  ✓ Message delivered in 0.4s' },
      { cls: 't-pass', text: '  ✓ Acknowledge button functional' },
      { cls: 't-info', text: '▸ Sending test page to PagerDuty...' },
      { cls: 't-pass', text: '  ✓ Incident INC-00001 created (test mode)' },
      { cls: 't-pass', text: '  ✓ Auto-resolved after 30s' },
      { cls: 't-info', text: '▸ Forwarding test event to Splunk...' },
      { cls: 't-pass', text: '  ✓ Event received in 0.3s' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  ALL ALERT CHANNELS VERIFIED ✓' },
    ],
  },
  {
    id: 'everything',
    name: 'Everything Bundle',
    category: 'all',
    icon: '⚔️',
    accentColor: '#9B6DFF',
    featured: false,
    tagline: 'All 15 skills. All future skills as they ship. One source wizard covers everything.',
    incidentRef: null,
    sourceLabel: 'GitHub App + Agent',
    sourceDesc: 'Bundle wizard connects both in one 5-minute flow.',
    priceMonthly: 149,
    priceIndividual: 279,
    skills: [
      { name: 'All 15 current skills', tag: 'core', desc: 'Every attack vector covered' },
      { name: 'All future skills — free', tag: 'new', desc: 'Ships to your account automatically' },
      { name: 'Priority beta access', tag: 'new', desc: 'First to get new protections' },
      { name: 'Roadmap influence calls', tag: 'new', desc: 'Quarterly product calls' },
    ],
    testLines: [
      { cls: 't-info', text: '▸ Running full bundle test (15 skills)...' },
      { cls: 't-pass', text: '  ✓ Supply chain skills:    4/4 passing' },
      { cls: 't-pass', text: '  ✓ CI/CD skills:           3/3 passing' },
      { cls: 't-pass', text: '  ✓ Runtime skills:         4/4 passing' },
      { cls: 't-pass', text: '  ✓ Compliance skills:      3/3 passing' },
      { cls: 't-pass', text: '  ✓ Alert routing:          3/3 passing' },
      { cls: 't-pass', text: '' },
      { cls: 't-pass', text: '  FULL STACK PROTECTION ACTIVE ✓' },
      { cls: 't-dim',  text: '  Security score: 94/100 (+31 from baseline)' },
    ],
  },
]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUNDLE CARD COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Render each bundle as a card with:

<div class="bundle-card {bundle.featured ? 'featured' : ''}"
     data-category="{bundle.category}"
     onclick="openBundleModal('{bundle.id}')">

  <!-- Accent bar at top -->
  <div class="bundle-accent" style="background: linear-gradient(90deg, {bundle.accentColor}, {bundle.accentColor}88)"></div>

  {#if bundle.featured}
    <div class="bundle-featured-badge">Most popular</div>
  {/if}

  <div class="bundle-head">
    <div class="bundle-icon">{bundle.icon}</div>
    <div class="bundle-name">{bundle.name}</div>
    <div class="bundle-tagline">{bundle.tagline}</div>

    {#if bundle.incidentRef}
      <div class="bundle-incident-ref {bundle.incidentSeverity}">
        🛡 {bundle.incidentRef}
      </div>
    {/if}
  </div>

  <div class="bundle-skills">
    {#each bundle.skills as skill}
      <div class="bundle-skill-chip">
        <span class="bundle-skill-dot" style="background: {bundle.accentColor}"></span>
        <span class="bundle-skill-name">{skill.name}</span>
        {#if skill.tag === 'new'}
          <span class="chip-tag new-tag">New</span>
        {:else if skill.tag === 'hot'}
          <span class="chip-tag hot-tag">Popular</span>
        {:else}
          <span class="chip-tag core-tag">Core</span>
        {/if}
      </div>
    {/each}
  </div>

  <div class="bundle-footer">
    <div class="bundle-pricing">
      <div class="bundle-was">${bundle.priceIndividual}/mo individually</div>
      <div class="bundle-price">
        <span class="bundle-price-num">${bundle.priceMonthly}</span>
        <span class="bundle-price-period">/mo</span>
      </div>
      <div class="bundle-save">
        Save ${bundle.priceIndividual - bundle.priceMonthly}/mo —
        {Math.round(((bundle.priceIndividual - bundle.priceMonthly) / bundle.priceIndividual) * 100)}% off
      </div>
    </div>
    <button class="bundle-activate-btn" style="background: {bundle.accentColor}">
      Activate Bundle
    </button>
  </div>
</div>

Grid: 3 columns desktop, 2 tablet, 1 mobile:
.bundle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUNDLE MODAL (5-step activation wizard)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a modal that opens when any bundle is clicked.
5 steps: Review → Connect → Configure → Test → Live

State:
  let modalOpen = false
  let activeBundle = null
  let currentStep = 1
  let testLines = []
  let testRunning = false

Steps indicator:
  Show 5 dots/circles at top of modal
  Active step: filled blue circle
  Completed step: green check
  Future step: empty circle

STEP 1 — REVIEW:
  Show bundle name + tagline
  List all skills with:
    - Icon placeholder
    - Name
    - One-line description
    - Status chip: "Activates with GitHub App" or "Requires agent sidecar"
  Bottom: price + "Continue →"

STEP 2 — CONNECT SOURCE:
  Show the source requirement for this bundle
  Two options:
    [A] Primary source (GitHub App for most bundles)
        Button: "Connect GitHub →" (opens OAuth)
        After connect: "✓ Connected — 14 repos selected"
    [B] Upload files (one-time scan, no ongoing monitoring)
  Show code snippet for CLI alternative:
    opensyber bundle activate {bundle.id} --token=YOUR_TOKEN
  Bottom: source connected → "Continue →" activates

STEP 3 — CONFIGURE ALERTS:
  Three destination cards (multi-select):
    💬 Slack → "#security-alerts"
    🚨 PagerDuty → "CI Security service"
    📧 Email → "shachar@example.com"
  Severity routing (shown below):
    CRITICAL → immediate (all channels)
    HIGH → immediate (all channels)
    MEDIUM → daily digest
    LOW → weekly digest
  Bottom: "Continue →"

STEP 4 — TEST:
  "Run Bundle Test" button (large, blue)
  When clicked: animate test lines from bundle.testLines
  Each line appears with 180ms delay
  Terminal-style panel: dark bg, monospace font, colored text:
    t-pass → var(--green)
    t-fail → var(--red)
    t-warn → var(--amber)
    t-info → var(--blue2)
    t-dim → var(--text3)
  After all lines: "Activate →" button activates
  Bottom: Back | "Activate →"

STEP 5 — LIVE:
  Large green circle (🟢)
  "{bundle.name} is live"
  Three stat cards:
    +N pts security score
    N skills active
    Real-time monitoring
  Share badge prompt:
    "Share your security posture:"
    opensyber.cloud/trust/your-org  [Copy]
  Button: "Go to Dashboard →" → /dashboard

Test animation JavaScript:
  async function runTest(bundle) {
    testRunning = true
    testLines = []
    for (const line of bundle.testLines) {
      await new Promise(r => setTimeout(r, 180))
      testLines = [...testLines, line]
    }
    testRunning = false
  }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILTER FUNCTIONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  let activeFilter = 'all'

  $: filteredBundles = activeFilter === 'all'
    ? bundles
    : bundles.filter(b => b.category === activeFilter || b.category === 'all')

  function setFilter(f) {
    activeFilter = f
  }


WHEN DONE: verify:
  ✓ Page loads at /marketplace/bundles
  ✓ Free starter banner visible
  ✓ All 7 bundle cards render with correct data
  ✓ Filter tabs work (CI/CD shows only CI/CD bundles)
  ✓ Featured badge on Supply Chain Defense
  ✓ Bundle modal opens on card click
  ✓ All 5 wizard steps work: Review → Connect → Configure → Test → Live
  ✓ Test animation runs when "Run Bundle Test" clicked
  ✓ Lines animate with delay and correct colors
  ✓ Step 5 shows "live" state with stats
  ✓ Mobile: cards stack to 1 column, modal fills screen

Output: "AGENT J COMPLETE — bundles page live"
```

---

# ══════════════════════════════════════
# AGENT K — SKILL SETUP WIZARD
# The source connection flow
# src/lib/components/skills/SkillSetupWizard.svelte
# ══════════════════════════════════════

```prompt
You are building the skill setup wizard for OpenSyber.
Currently: install a skill → nothing happens → no source connected.
This wizard closes that gap. It runs AFTER a skill is installed.

FILE: src/lib/components/skills/SkillSetupWizard.svelte
FILE: src/routes/dashboard/skills/+page.svelte (minor additions)

The wizard has 4 steps:
  1. SOURCE — connect data input
  2. CONFIGURE — set rules and thresholds
  3. TEST — run simulation
  4. LIVE — monitoring active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRIGGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The wizard opens when:
  A) User installs a skill for the first time → auto-open wizard
  B) User clicks "Set up" on a skill card with status "No source"
  C) User clicks "Reconfigure" on an active skill

Props:
  export let skill = null    // the skill object from SKILLS array
  export let open = false
  export let onClose = () => {}
  export let onComplete = () => {}


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — SOURCE CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Different UI for each source type.
Use skill.sourceType to determine which UI to show.

SOURCE TYPE: github_app
  Show:
    "Connect your GitHub organization to activate {skill.name}"
    [Connect GitHub →]  ← OAuth redirect button
    After connect: repo picker (all / specific repos)
    "This scans N repos on every push automatically"

  Already connected (GitHub App exists):
    Show: "✓ Connected — shacharorynkar-org (14 repos)"
    Repo scope: [All repos ▾] or [Select repos]
    "Continue →" immediately available

SOURCE TYPE: agent
  Show:
    "Install the OpenSyber agent to activate {skill.name}"
    This skill monitors runtime activity and needs an agent running
    in your environment.

    Choose where:
      [A] GitHub Actions (CI/CD monitoring)
          Code block:
          - name: OpenSyber Agent
            uses: opensyber/agent-action@abc123sha
            with:
              token: ${{ secrets.OPENSYBER_TOKEN }}
          Copy token button: [OSYB_****] [Copy]

      [B] Local machine (developer tool monitoring)
          Code block:
          brew install opensyber && opensyber start --token=YOUR_TOKEN
          or: curl -fsSL https://get.opensyber.cloud | sh

      [C] Self-hosted runner
          [View server guide →]

    Polling indicator:
      "Waiting for agent heartbeat..."
      [●●●] animated dots
      When heartbeat received: "✓ Agent connected — demo-machine-01"

SOURCE TYPE: git_hook
  Show:
    "Install the git hook to activate {skill.name}"
    Run this in your repository:
    [code block: curl -fsSL https://opensyber.cloud/install/hook | sh]
    [Copy] button
    "Or install globally (all repos):
     opensyber hook install --global"
    "Verify: opensyber hook status"
    Poll for hook installation confirmation

SOURCE TYPE: slack
  Show:
    "Connect Slack to activate {skill.name}"
    [Add to Slack →]  ← Slack OAuth button
    After OAuth: channel picker dropdown
    "Send alerts to: [#security-alerts ▾]"
    "Critical alerts also to: [#oncall ▾] (optional)"

SOURCE TYPE: api_key
  Show: (for PagerDuty, SIEM, etc.)
    Field: "API Key or Integration Key"
    [text input with show/hide toggle]
    Helper text: "Where to find this: [link to docs]"
    [Test connection] button
    On success: "✓ Connected successfully"

SOURCE TYPE: internal
  Show: (for Compliance Reporter — uses existing data)
    "✓ No external source needed"
    "This skill uses data already collected by your active skills."
    "Active skills providing data:"
    [list of user's active skills that feed this one]
    "Continue →" available immediately

SOURCE TYPE: api_target
  Show: (for API Fuzzer)
    "Point the fuzzer at your staging API"
    Option A: Upload OpenAPI/Swagger spec
      [Choose file] or [Enter URL]
    Option B: Manual endpoints
      [+ Add endpoint] rows (method + path)
    Warning: "⚠ Only target APIs you own. Never point at production."


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CONFIGURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Shared configuration across all skills:

  SEVERITY ROUTING (always shown):
    What should happen for each severity level?
    CRITICAL: ● Block/terminate ○ Alert only
    HIGH:     ● Alert immediately ○ Daily digest
    MEDIUM:   ○ Alert immediately ● Daily digest
    LOW:      ○ Alert ● Ignore

  ALERT DESTINATIONS (always shown):
    ☐ Slack [Connect Slack →] or [#security-alerts ▾ if connected]
    ☐ Email [enter email]
    ☐ PagerDuty [connect PD →] or [service ▾ if connected]
    ☐ SMS [enter phone] (CRITICAL only, Weekend Shield)

Skill-specific config (show below shared config):

  secret-scanner:
    Which secret types to scan? (toggles, all on by default)
    ☑ AWS credentials  ☑ GitHub tokens  ☑ Anthropic/OpenAI keys
    ☑ Stripe keys  ☑ Database URIs  ☑ SSH private keys  ☑ Generic passwords
    Ignore paths (optional): .env.example, tests/fixtures/

  network-sentinel:
    Protection mode: ○ Alert only  ● Block suspicious calls
    Learning mode: ☑ Learn normal traffic for 7 days first
    Always block (IOC feed): [toggle — always on]
    Additional blocked domains: [text input]

  supply-chain-guard:
    Protection level: ○ PR scanning only  ● Runtime (requires agent)
    Block on: ☑ Typosquatting  ☑ Malicious postinstall  ☑ IOC package

  git-guardian:
    Protected branches: main ✓ | master ✓ | release/* ✓  [+ Add]
    Block force-push: ☑
    Commit message format: ○ No rules  ● feat|fix|chore|docs  ○ Custom
    Max file size: [50 MB ▾]

  compliance-reporter:
    Frameworks: ☑ SOC 2  ☑ GDPR  ☐ HIPAA  ☐ ISO 27001
    Report schedule: ○ Monthly  ● Quarterly  ○ On demand
    Auditor email (optional): [input]

  All others: just show the shared config.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Three test modes, shown as tabs:

  Tab 1: Simulation (default)
    "Run a synthetic attack and verify the skill fires correctly."
    Button: [▶ Run Test]
    Terminal panel: dark bg, DM Mono font
    Lines animate in with 180ms delay
    Colors: green/red/amber/blue/gray per class
    After complete: ✓ Test Passed or ✗ Test Failed with specific reason

  Tab 2: Dry Run
    "Scan the last 30 days without sending any alerts."
    Button: [Run Dry Run]
    Shows what WOULD have been flagged
    Result table: file/event | severity | what skill would have done

  Tab 3: Replay — [incident name]
    "Would the [Trivy / Clinejection] attack have affected you?"
    Button: [Check my exposure]
    Checks user's connected repos/configs against the incident pattern
    Result: "You would have been affected" (red) or "You were safe" (green)
    Shows: which repos, what credentials at risk, what stage would stop it

  Simulation data per skill (use these exactly):

  secret-scanner:
    t-info "▸ Creating synthetic commit with fake AWS key..."
    t-dim  "  File: config/settings.py line 14"
    t-dim  "  AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE"
    t-pass "  ✓ Pattern detected: AWS Access Key ID (AKIA[A-Z]{16})"
    t-pass "  ✓ Commit blocked before push"
    t-pass "  ✓ Alert sent to configured channels"
    t-pass ""
    t-pass "  SECRET SCANNER WORKING ✓"

  network-sentinel:
    t-info "▸ Simulating call to scan.aquasecurtiy[.]org (TeamPCP IOC)..."
    t-dim  "  Checking against IOC feed (847 entries)..."
    t-pass "  ✓ IOC match found: TeamPCP exfiltration domain"
    t-pass "  ✓ Connection blocked in 12ms"
    t-pass "  ✓ CRITICAL alert fired"
    t-info "▸ Simulating safe call to api.github.com..."
    t-pass "  ✓ Allowlisted domain — passed silently, no alert"
    t-pass ""
    t-pass "  NETWORK SENTINEL WORKING ✓"

  supply-chain-guard:
    t-info "▸ Simulating: npm install expres (typosquatted)"
    t-dim  "  Checking against Socket.dev threat feed..."
    t-warn "  ⚠ Typosquatting detected: expres → express?"
    t-fail "  Package flagged: known typosquat in IOC feed"
    t-pass "  ✓ Install blocked before execution"
    t-info "▸ Simulating: npm install cline@2.3.0 (Clinejection)"
    t-warn "  ⚠ Suspicious postinstall: npm install -g openclaw@latest"
    t-pass "  ✓ Postinstall blocked — global install attempt stopped"
    t-pass ""
    t-pass "  SUPPLY CHAIN GUARD WORKING ✓"

  git-guardian:
    t-info "▸ Simulating force-push to main branch..."
    t-pass "  ✓ BLOCKED: Force-push to protected branch denied"
    t-info "▸ Simulating bad commit message: 'fixed stuff'"
    t-pass "  ✓ BLOCKED: Must start with feat|fix|chore|docs|refactor"
    t-info "▸ Simulating normal commit to feature/new-api..."
    t-pass "  ✓ ALLOWED: Normal commit to feature branch"
    t-pass ""
    t-pass "  GIT GUARDIAN WORKING ✓"

  cursor-monitor:
    t-info "▸ Simulating Cursor AI reading .env.production..."
    t-dim  "  File classified: environment configuration (HIGH sensitivity)"
    t-warn "  ⚠ HIGH: Cursor accessed sensitive file"
    t-pass "  ✓ Alert sent: Cursor read .env.production"
    t-pass "  ✓ Access logged in audit trail"
    t-info "▸ Simulating Cursor reading src/api/routes.ts (normal)..."
    t-pass "  ✓ Normal file access — no alert"
    t-pass ""
    t-pass "  CURSOR MONITOR WORKING ✓"

  dependency-auditor:
    t-info "▸ Scanning connected repos for vulnerable packages..."
    t-dim  "  Checking 847 packages across 14 repos..."
    t-fail "  ✗ CRITICAL: lodash@4.17.20 — CVE-2021-23337 (RCE)"
    t-fail "  ✗ HIGH: minimist@1.2.5 — CVE-2021-44906 (prototype pollution)"
    t-pass "  ✓ Upgrade path: lodash@4.17.21 (1 command)"
    t-pass "  ✓ 845 packages clean"
    t-pass ""
    t-pass "  DEPENDENCY AUDITOR WORKING ✓"

  (For all other skills, generate similar appropriate simulation)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — LIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Large 🟢 indicator
  "{skill.name} is active"
  "Monitoring: {skill.sourceLabel}"
  Score impact: "+N points to your security score"
  "Go to Dashboard →"
  "Set up another skill →"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DASHBOARD SKILLS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update src/routes/dashboard/skills/+page.svelte to show:

  Section 1: ACTIVE SKILLS (green status)
    Each skill card: icon + name + "🟢 Active" + source + events today
    [Configure] [Test] buttons

  Section 2: NEEDS SETUP (amber status)
    Each skill card: icon + name + "⚠ No source connected"
    [Set up →] button → opens SkillSetupWizard

  Section 3: AVAILABLE TO INSTALL
    Link to /marketplace: "Browse 15+ verified skills →"

  Empty state (no skills installed):
    "Start with the free bundle"
    [Activate Free Starter Bundle →]
    "Or browse individual skills →"


WHEN DONE: verify:
  ✓ Wizard opens when skill has no source
  ✓ GitHub App source shows repo selector
  ✓ Agent source shows install command with copy button
  ✓ Git hook source shows 1-command install
  ✓ Slack source shows OAuth button + channel picker
  ✓ Simulation test runs with animated terminal lines
  ✓ Each of the 6 tested skills has correct simulation output
  ✓ Step 4 shows green active state
  ✓ Dashboard skills page shows Active / Needs Setup sections

Output: "AGENT K COMPLETE — skill setup wizard ready"
```

---

# ══════════════════════════════════════
# MERGE AGENT — SKILLS & BUNDLES
# Run after H, I, J, K all complete
# ══════════════════════════════════════

```prompt
Agents H, I, J, K are complete. Verify the skills and bundles system.

CRITICAL ROUTES TO CHECK:

  /marketplace
    ✓ Hero: "15 skills. Every attack vector covered."
    ✓ Tabs: All | Security | CI/CD | Compliance | AI Agents | Runtime | Alerts | Bundles →
    ✓ Bundles promo bar above skill grid
    ✓ 15 skill cards with new data
    ✗ NO "(312)" or "4824" or any review/install counts
    ✓ Each card has missionLine (consequence framing)
    ✓ Each card shows sourceLabel
    ✓ Incident tags on: secret-scanner, supply-chain-guard, network-sentinel, cursor-monitor
    ✓ Tab filter works (click Security → shows only security skills)

  /marketplace/secret-scanner
    ✓ Page loads (was 404 before)
    ✓ Breadcrumb: Marketplace / Secret Scanner
    ✓ Incident context: Trivy attack paragraph
    ✓ 5 detailed features listed
    ✓ Quick start code block with copy button
    ✓ 3 related skills at bottom
    ✓ "Install this skill" CTA

  /marketplace/network-sentinel
    ✓ Loads with "TeamPCP exfiltration" incident context
    ✓ Quick start shows agent installation

  /marketplace/nonexistent-skill
    ✓ Returns 404 page (not crash)

  /marketplace/bundles
    ✓ Page exists and loads
    ✓ Free starter banner visible
    ✓ 7 bundle cards render
    ✓ Filter tabs: All | CI/CD | Compliance | Runtime | AI Agents
    ✓ Supply Chain Defense has "Most popular" badge
    ✓ CI/CD filter shows only: Supply Chain Defense, CI/CD Hardening
    ✓ Bundle card click opens wizard modal
    ✓ Wizard modal: 5 steps work
    ✓ Test animation runs with colored lines
    ✓ Step 5 shows live state

  Dashboard skills page (if accessible):
    ✓ Sections: Active | Needs Setup | Available
    ✓ "Set up →" button opens SkillSetupWizard
    ✓ Wizard step 1 shows correct source UI for each skill type
    ✓ Simulation tests run with terminal animation

COPY CHECKS — must NOT exist anywhere:
  ✗ "(312)" or "(289)" or "(248)" (fake review counts)
  ✗ "4824" or "4102" or "3655" (fake install counts)
  ✗ "Home & Lifestyle" category
  ✗ "Finance" category
  ✗ "Productivity" category (wrong framing for security)

If all pass, output:

════════════════════════════════════════
✅ SKILLS & BUNDLES SYSTEM COMPLETE
════════════════════════════════════════

MARKETPLACE:
  ✓ 15 skills with mission framing and consequence language
  ✓ Categories corrected: Security | CI/CD | Compliance | AI | Runtime | Alerts
  ✓ No fake social proof anywhere
  ✓ Incident reference tags on relevant skills
  ✓ Bundles promo integrated

SKILL DETAIL PAGES:
  ✓ All 15 /marketplace/{slug} routes return 200
  ✓ Each has: incident context, features, quick start, related skills
  ✓ Code blocks with copy buttons
  ✓ Install CTA on every page

BUNDLES PAGE:
  ✓ /marketplace/bundles loads and shows 7 bundles
  ✓ Free starter banner always visible
  ✓ Filter tabs work
  ✓ Wizard modal with 5-step activation flow
  ✓ Animated test simulation per bundle

SKILL SETUP WIZARD:
  ✓ Opens for skills without source
  ✓ 5 source type UIs (GitHub App, agent, git hook, Slack, API key)
  ✓ Simulation tests for all 6 primary skills
  ✓ 4 steps: Source → Configure → Test → Live

NEXT:
  → Publish Trivy blog post to HN immediately
  → Tweet: "We just fixed every skill detail page (was 404)"
  → Post: "Show HN: OpenSyber bundles — one click, full protection"
════════════════════════════════════════
```

---

## PARALLEL MAP

```
Run simultaneously (fully independent):
  Agent H — Marketplace page rebuild
  Agent I — 15 skill detail pages
  Agent J — Bundles page (new)
  Agent K — Skill setup wizard

Run after all 4 confirm complete:
  Merge Agent — Verification

Estimated parallel time: 45 minutes
```

## WHY THIS ORDER MATTERS

```
Agent H and I share the skills data array.
Create src/lib/data/skills.ts FIRST in Agent I
and import it in Agent H.
Or have Agent H define it inline and Agent I
import from Agent H's location — coordinate this.

The simplest approach:
  Agent H defines the array at the top of its page
  Agent I creates src/lib/data/skills.ts from the same data
  Both import from src/lib/data/skills.ts

Tell both agents to use: import { SKILLS } from '$lib/data/skills'
```

## THE SINGLE MOST BROKEN THING

Every skill card on the current marketplace links to a page that 404s.
A visitor who clicks any skill hits a dead end.
**Agent I** (skill detail pages) fixes this.
Run it in parallel with H but if you can only run one — run I first.
A marketplace where clicking does something is infinitely better
than a marketplace where clicking works but the pages look wrong.
