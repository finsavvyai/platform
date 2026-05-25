# OpenSyber — MASTER SPRINT DOCUMENT
> Classification: SHIP NOW
> Date: March 28, 2026
> Agents: Run ALL in parallel. Each is fully self-contained.
> Goal: Production-ready OpenSyber in 72 hours

---

## ARCHITECTURE OVERVIEW

```
Stack:
  Frontend:  SvelteKit 2.15 + Svelte 5 → Cloudflare Pages
  API:       Hono 4 → Cloudflare Workers (TypeScript strict)
  DB:        Cloudflare D1 (SQLite) + Drizzle ORM
  Cache:     Cloudflare KV
  Storage:   Cloudflare R2
  Queues:    Cloudflare Queues
  Auth:      Better Auth (migrated from Clerk)
  Billing:   LemonSqueezy
  Email:     Resend
  SMS:       Twilio

Design tokens:
  --bg: #05080F  --blue: #1B6FFF  --cyan: #00D4FF
  --green: #00E5A0  --amber: #F5A623  --red: #FF4B4B
  Fonts: Syne (display) + DM Sans (body) + DM Mono (code)

Running services:
  opensyber.cloud  — live site (Cloudflare)
  app.opensyber.cloud — app (protected by CF)
  api.opensyber.cloud — Hono workers API
```

---

## HOW TO RUN THIS SPRINT

Open 16 terminal windows.
Paste one AGENT block per window.
Run simultaneously.
Each agent reports "AGENT N COMPLETE" when done.
Run MERGE AGENT last when all others report complete.

Estimated parallel time: 90-120 minutes
Estimated sequential time: 3 days

---

# ═══════════════════════════════════════
# AGENT 01 — DATABASE FOUNDATION
# Everything else depends on this schema
# ═══════════════════════════════════════

```prompt
You are building OpenSyber on Cloudflare D1 + Drizzle ORM.

YOUR TASK: Write and execute the complete database schema migration that
supports ALL features: skills, bundles, sources, builder platform,
NHI manager, agent registry, cost tracking, and certifications.

Create: migrations/0002_full_platform.sql

Run it with: wrangler d1 execute opensyber-db --file=migrations/0002_full_platform.sql

TABLES TO CREATE:

-- ─── SKILL BUNDLES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_bundles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  long_description TEXT,
  category TEXT NOT NULL CHECK(category IN ('cicd','compliance','runtime','ai','all')),
  icon TEXT NOT NULL,
  accent_gradient TEXT NOT NULL,
  primary_source_type TEXT NOT NULL,
  source_description TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_individual_total INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  is_free INTEGER DEFAULT 0,
  is_everything INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bundle_skills (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  tag TEXT CHECK(tag IN ('new','hot','core',NULL)),
  required_source TEXT,
  is_bonus INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bundle_test_steps (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
  line TEXT NOT NULL,
  css_class TEXT NOT NULL CHECK(css_class IN ('t-pass','t-fail','t-warn','t-info','t-dim')),
  delay_ms INTEGER DEFAULT 180,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_bundle_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES skill_bundles(id),
  status TEXT DEFAULT 'pending_source'
    CHECK(status IN ('pending_source','pending_config','pending_test','active','cancelled')),
  activated_at TEXT,
  cancelled_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bundle_sources (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES user_bundle_subscriptions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT,
  scope TEXT,
  connected_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS bundle_alert_configs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES user_bundle_subscriptions(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK(channel_type IN ('slack','pagerduty','email','sms','webhook','siem')),
  channel_config TEXT NOT NULL,
  severity_filter TEXT DEFAULT '["CRITICAL","HIGH"]',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── GITHUB INTEGRATION ──────────────────────────────────
CREATE TABLE IF NOT EXISTS github_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  installation_id TEXT NOT NULL UNIQUE,
  org_login TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK(org_type IN ('User','Organization')),
  repos_selected TEXT,
  status TEXT DEFAULT 'active',
  installed_at TEXT DEFAULT (datetime('now')),
  last_event_at TEXT
);

CREATE TABLE IF NOT EXISTS github_repos (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES github_installations(id),
  github_repo_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  default_branch TEXT DEFAULT 'main',
  is_private INTEGER DEFAULT 0,
  last_scan_at TEXT,
  workflow_count INTEGER DEFAULT 0,
  unpinned_action_count INTEGER DEFAULT 0,
  secret_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS action_refs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  workflow_file TEXT NOT NULL,
  action TEXT NOT NULL,
  ref TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  resolved_sha TEXT,
  is_compromised INTEGER DEFAULT 0,
  line_number INTEGER,
  last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS ioc_feed (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('action_sha','domain','package','ip','tag')),
  value TEXT NOT NULL,
  actor TEXT,
  severity TEXT DEFAULT 'CRITICAL',
  incident_ref TEXT,
  source TEXT NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

-- ─── SKILL BUILDER PLATFORM ──────────────────────────────
CREATE TABLE IF NOT EXISTS skill_publishers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  website TEXT,
  github_username TEXT,
  verified INTEGER DEFAULT 0,
  stripe_account_id TEXT,
  stripe_account_status TEXT DEFAULT 'pending',
  revenue_share_pct INTEGER DEFAULT 70,
  total_earned_cents INTEGER DEFAULT 0,
  total_installs INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS third_party_skills (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES skill_publishers(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  long_description TEXT,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  version TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL,
  entry_file TEXT NOT NULL,
  package_url TEXT,
  package_sha256 TEXT,
  manifest TEXT NOT NULL,
  status TEXT DEFAULT 'draft'
    CHECK(status IN ('draft','submitted','in_review','approved','rejected','suspended')),
  rejection_reason TEXT,
  audit_score INTEGER,
  audit_report TEXT,
  install_count INTEGER DEFAULT 0,
  active_install_count INTEGER DEFAULT 0,
  revenue_total_cents INTEGER DEFAULT 0,
  submitted_at TEXT,
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skill_revenue_events (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES third_party_skills(id),
  publisher_id TEXT NOT NULL REFERENCES skill_publishers(id),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('subscription_created','subscription_renewed','refund')),
  gross_amount_cents INTEGER NOT NULL,
  publisher_share_cents INTEGER NOT NULL,
  platform_share_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skill_payouts (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES skill_publishers(id),
  amount_cents INTEGER NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','failed')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── NHI (NON-HUMAN IDENTITY) MANAGER ───────────────────
CREATE TABLE IF NOT EXISTS agent_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT,
  display_name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK(agent_type IN ('claude_code','cursor','windsurf','copilot','custom','mcp_server','ci_runner','service_account')),
  owner_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  description TEXT,
  token_hash TEXT,
  token_expires_at TEXT,
  last_seen_at TEXT,
  ip_range TEXT,
  permissions TEXT,
  risk_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','expired','orphaned')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_identity_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_identities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  description TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── AGENT COST TRACKING ─────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_cost_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  agent_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('anthropic','openai','google','azure_openai','custom')),
  model TEXT NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_cents INTEGER NOT NULL,
  session_id TEXT,
  request_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_cost_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  scope TEXT NOT NULL CHECK(scope IN ('per_session','daily','weekly','monthly')),
  limit_cents INTEGER NOT NULL,
  alert_at_pct INTEGER DEFAULT 80,
  kill_at_pct INTEGER DEFAULT 100,
  action_on_kill TEXT DEFAULT 'alert' CHECK(action_on_kill IN ('alert','terminate','pause')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── MCP SERVER REGISTRY ─────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT,
  install_path TEXT,
  config_hash TEXT,
  bind_address TEXT,
  exposed_publicly INTEGER DEFAULT 0,
  has_auth INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  last_scanned_at TEXT,
  status TEXT DEFAULT 'unknown' CHECK(status IN ('safe','warn','critical','unknown')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mcp_server_findings (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK(severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  vuln_class TEXT NOT NULL,
  description TEXT NOT NULL,
  remediation TEXT,
  cve TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── MEMORY POISONING TRACKER ────────────────────────────
CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT,
  store_type TEXT NOT NULL CHECK(store_type IN ('vector_db','kv','file','sqlite','custom')),
  store_name TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_preview TEXT,
  source_type TEXT NOT NULL CHECK(source_type IN ('user','agent','external_url','github_issue','email','doc','unknown')),
  source_url TEXT,
  injection_risk_score INTEGER DEFAULT 0,
  injection_patterns TEXT,
  is_quarantined INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── CERTIFICATIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cert_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cert_type TEXT NOT NULL CHECK(cert_type IN ('CAASD','COSA')),
  status TEXT DEFAULT 'enrolled' CHECK(status IN ('enrolled','passed','failed','expired')),
  score INTEGER,
  passed_at TEXT,
  expires_at TEXT,
  badge_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── NEWSLETTER ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  subscribed_at TEXT DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

-- ─── SEED IOC DATA ────────────────────────────────────────
INSERT OR IGNORE INTO ioc_feed (id, type, value, actor, severity, incident_ref, source) VALUES
  ('ioc-001', 'domain', 'scan.aquasecurtiy.org', 'TeamPCP', 'CRITICAL', 'GHSA-69fq-xp46-6x23', 'opensyber'),
  ('ioc-002', 'domain', 'hackmoltrepeat.com', 'hackerbot-claw', 'CRITICAL', 'hackerbot-claw-2026', 'opensyber'),
  ('ioc-003', 'ip', '45.148.10.212', 'TeamPCP', 'CRITICAL', 'GHSA-69fq-xp46-6x23', 'opensyber'),
  ('ioc-004', 'domain', 'tpcp.tar.gz', 'TeamPCP', 'HIGH', 'teampcp-campaign-2026', 'opensyber'),
  ('ioc-005', 'domain', 'tdtqy-oyaaa-aaaae-af2dq-cai', 'TeamPCP', 'HIGH', 'GHSA-69fq-xp46-6x23', 'opensyber');

-- ─── SEED BUNDLES ────────────────────────────────────────
INSERT OR IGNORE INTO skill_bundles
  (id, name, tagline, category, icon, accent_gradient, primary_source_type, source_description, price_monthly, price_individual_total, is_featured, is_free, display_order)
VALUES
  ('free-starter', 'Free Starter Bundle', 'Get protected in 60 seconds. Three essential skills, free forever.', 'all', '🎁', 'linear-gradient(90deg,#1B6FFF,#00D4FF)', 'github_app', 'Connect GitHub to activate all 3 skills across all your repos.', 0, 5200, 0, 1, 0),
  ('supply-chain-defense', 'Supply Chain Defense', 'Complete protection against Trivy-class supply chain attacks.', 'cicd', '🛡', 'linear-gradient(90deg,#1B6FFF,#00D4FF)', 'github_app', 'One GitHub connection activates all 4 skills across all your repos.', 4900, 7900, 1, 0, 1),
  ('ai-agent-security', 'AI Agent Security', 'Protect your Claude Code, Cursor, and Windsurf sessions from prompt injection and credential theft.', 'ai', '🤖', 'linear-gradient(90deg,#9B6DFF,#FF4B4B)', 'agent_local', 'GitHub App + local agent. Takes 5 minutes to set up.', 5900, 8900, 0, 0, 2),
  ('compliance-ready', 'Compliance Ready', 'SOC 2, ISO 27001, HIPAA evidence collected automatically.', 'compliance', '📋', 'linear-gradient(90deg,#00E5A0,#00D4FF)', 'github_app', 'GitHub App activates 3 skills. Add agent for runtime log analysis.', 4900, 8400, 0, 0, 3),
  ('cicd-hardening', 'CI/CD Hardening', 'Lock down every GitHub Actions misconfiguration from 2025-2026.', 'cicd', '⚡', 'linear-gradient(90deg,#F5A623,#FF4B4B)', 'github_app', 'One OAuth connection scans all your workflow files automatically.', 3900, 6900, 0, 0, 4),
  ('runtime-defense', 'Runtime Defense', 'Watch what your agents actually do in real time.', 'runtime', '🔥', 'linear-gradient(90deg,#FF4B4B,#F5A623)', 'agent_local', 'Install the OpenSyber agent in your CI pipeline or dev machine — 2 minutes.', 4900, 7900, 0, 0, 5),
  ('infrastructure-security', 'Infrastructure Security', 'Catch cloud misconfigurations before they reach production.', 'compliance', '🏗', 'linear-gradient(90deg,#4D94FF,#9B6DFF)', 'github_app', 'Scans Terraform, K8s, and Dockerfile changes on every PR automatically.', 4500, 7400, 0, 0, 6),
  ('alert-response', 'Alert and Response', 'The right person gets notified the right way, every time.', 'runtime', '🔔', 'linear-gradient(90deg,#00E5A0,#F5A623)', 'slack', 'Connect Slack + PagerDuty + SIEM in one flow — 5 minutes total.', 2900, 5400, 0, 0, 7),
  ('everything', 'Everything Bundle', 'All 15 skills plus every future skill as it ships. One source wizard covers everything.', 'all', '⚔️', 'linear-gradient(90deg,#1B6FFF,#9B6DFF,#00E5A0)', 'github_app', 'GitHub App + agent. Bundle wizard connects everything in 5 minutes.', 14900, 27900, 0, 0, 8);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bundle_subs_user ON user_bundle_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_bundle_subs_bundle ON user_bundle_subscriptions(bundle_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_user ON agent_cost_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_created ON agent_cost_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ioc_value ON ioc_feed(value);
CREATE INDEX IF NOT EXISTS idx_ioc_type ON ioc_feed(type);
CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_user ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_id_user ON agent_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_action_refs_repo ON action_refs(repo_id);

WHEN DONE: output "AGENT 01 COMPLETE — schema migrated"
```

---

# ═══════════════════════════════════════
# AGENT 02 — SKILL FLOWS & SOURCE SYSTEM
# The core product: connect skills to data
# ═══════════════════════════════════════

```prompt
You are building OpenSyber. The database from Agent 01 exists.

YOUR TASK: Build the source connection system and the skill setup wizard
that turns installed skills into active monitors.

The 6-step skill flow for EVERY skill:
  1. BROWSE → Marketplace card
  2. INSTALL → POST /api/instances/:id/skills/:skillId
  3. CONNECT SOURCE → wizard: GitHub App / Agent / API key
  4. CONFIGURE → rules, thresholds, alert destinations
  5. TEST → simulation / dry run / replay
  6. LIVE → monitoring active

FILES TO CREATE:

src/routes/dashboard/skills/+page.svelte
  - List of installed skills with status
  - Each skill: icon, name, status badge (🟢 Active / 🟡 No Source / 🔴 Error)
  - "Set up" button → opens SkillWizard
  - Skills grouped by: Active | Needs Setup | Available to Install

src/lib/components/skills/SkillWizard.svelte
  Props: skillId, instanceId, open, onClose
  State: currentStep (1-6)

  STEP 2 — CONNECT SOURCE
  Different UI per skill type:

  GitHub App skills (8 skills — Secret Scanner, Dependency Auditor,
  Git Guardian, Supply Chain Guard, CI/CD Guardian, IaC Scanner,
  Container Hardening, Compliance Reporter):
    - "Connect GitHub" → OAuth button
    - After connect: repo selector (all / specific repos)
    - Show: "This will scan X repos automatically on every push"

  Agent skills (Network Sentinel, Log Analyzer, Cursor Monitor,
  Secret Vault Bridge):
    - Show install command:
      curl -fsSL https://opensyber.cloud/install | sh
      opensyber start --token=$TOKEN
    - Poll /api/agent/heartbeat every 3s
    - When heartbeat: "✓ Agent connected — demo-machine-01"

  Destination skills (Slack Security Alerts, PagerDuty, SIEM Forwarder):
    - OAuth button (Slack) or API key input (PagerDuty, SIEM)
    - Test send button
    - "✓ Test message delivered"

  STEP 3 — CONFIGURE
  Per-skill configuration panels. Build these components:
    SkillConfigSecretScanner.svelte — secret type toggles + severity
    SkillConfigDependencyAuditor.svelte — frequency + block vs alert
    SkillConfigNetworkSentinel.svelte — allowlist domains + block mode
    SkillConfigSupplyChainGuard.svelte — protection level (PR vs runtime)
    SkillConfigCICDGuardian.svelte — strict mode + auto-fix PR toggle
    SkillConfigCompliance.svelte — framework selector + schedule
    SkillConfigAlerts.svelte — shared: Slack/PD/email destinations + severity routing

  STEP 4 — TEST (3 modes per skill)
    Mode A — Simulation (button: "Run Test"):
      POST /api/skills/:id/test/simulate
      Returns SSE stream of test lines
      Each line: { text: string, cls: 't-pass'|'t-fail'|'t-warn'|'t-info'|'t-dim' }
      Animate each line with 180ms delay

    Mode B — Dry Run (button: "Scan last 30 days"):
      POST /api/skills/:id/test/dryrun
      Shows what WOULD have fired — no real alerts sent
      Returns summary: { findings: N, highSeverity: N, preview: Finding[] }

    Mode C — Replay (button: "Replay: Trivy Attack"):
      POST /api/skills/:id/test/replay?incident=trivy-2026
      Checks user's actual repos against the Trivy IOC patterns
      Returns: { wouldBeAffected: bool, affectedRepos: string[], blastRadius: string[] }

API ROUTES (src/routes/api/skills/):

  POST /api/skills/:id/source
    Body: { type: 'github_app'|'agent'|'api_key', config: object }
    → Create source record
    → Activate skill (set status to 'active')
    → Trigger initial scan (via Queue)
    → Return: { skillStatus: 'active', skillsActivated: string[] }

  GET /api/agent/heartbeat
    → Check if user has active agent sidecar
    → Return: { connected: bool, agentId: string, lastSeen: string }

  POST /api/skills/:id/test/simulate
    → SSE endpoint
    → Stream predefined simulation steps for this skill
    → Simulation data stored in D1 per skill (bundle_test_steps pattern)

  POST /api/skills/:id/test/dryrun
    → Run skill scanner in read-only mode against connected source
    → Return findings without sending alerts

  POST /api/skills/:id/test/replay
    Body: { incident: 'trivy-2026'|'hackerbot-claw'|'clinejection' }
    → Check user's connected repos/configs against known incident patterns
    → Return verdict: affected/not-affected + details

SIMULATION DATA (seed into bundle_test_steps pattern per skill):

  Secret Scanner simulation:
    t-info "▸ Creating synthetic commit with fake AWS key..."
    t-dim  "  Scanning: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE"
    t-pass "  ✓ AWS Access Key ID detected (AKIA pattern)"
    t-pass "  ✓ Commit blocked before push"
    t-pass "  ✓ Alert sent to configured channels"
    t-pass ""
    t-pass "  SECRET SCANNER WORKING ✓"

  Network Sentinel simulation:
    t-info "▸ Simulating call to scan.aquasecurtiy[.]org..."
    t-dim  "  Checking against IOC feed (847 entries)..."
    t-pass "  ✓ IOC match: TeamPCP exfiltration domain"
    t-pass "  ✓ Connection blocked in 12ms"
    t-pass "  ✓ CRITICAL alert fired"
    t-info "▸ Simulating call to api.github.com..."
    t-pass "  ✓ Allowlisted — passed silently"
    t-pass ""
    t-pass "  NETWORK SENTINEL WORKING ✓"

  CI/CD Guardian simulation:
    t-info "▸ Checking your repos for Trivy attack exposure..."
    t-dim  "  Scanning workflow files for aquasecurity/trivy-action..."
    t-warn "  ⚠ 3 repos reference @v0.32.0 (mutable tag, attack window)"
    t-pass "  ✓ CI/CD Guardian would have blocked all 3 pushes"
    t-info "▸ Checking SHA pinning coverage..."
    t-warn "  22/93 actions use mutable tags (24% unpinned)"
    t-pass "  ✓ Auto-fix PR ready to create"
    t-pass ""
    t-pass "  CI/CD GUARDIAN WORKING ✓"

  (Build equivalent for all 15 skills)

WHEN DONE: output "AGENT 02 COMPLETE — skill flows and source system ready"
```

---

# ═══════════════════════════════════════
# AGENT 03 — BUNDLE ACTIVATION WIZARD
# ═══════════════════════════════════════

```prompt
You are building OpenSyber. Database from Agent 01 exists.

YOUR TASK: Build the complete bundle system — marketplace page,
bundle cards, activation wizard with 5-step flow, and dashboard widget.

The bundle concept: curated skill sets + single source connection +
discount vs individual skills. User sees ONE wizard that activates
all skills in the bundle simultaneously.

FILES TO CREATE:

src/routes/marketplace/+page.svelte
  Add tabs: [All Skills] [Bundles ← new] [By Category]
  Each tab shows appropriate content

src/routes/marketplace/bundles/+page.svelte
  Header: "One click. Full protection."
  Sub: "Pre-packaged skill sets. One source. Everything activated."
  Free Starter Banner (always visible):
    "🎁 Free Starter Bundle active on your account
     Secret Scanner + Git Guardian + Dependency Auditor — free forever"
  Filter tabs: All | CI/CD | Compliance | Runtime | AI Agents
  Grid: BundleCard components

src/lib/components/bundles/BundleCard.svelte
  Props: bundle, isSubscribed, onActivate
  Shows:
    - Colored accent bar at top (bundle.accent_gradient)
    - Icon + name + tagline
    - Skills list (4 chips with tag badges)
    - Footer: crossed-out individual price, bundle price, savings
    - Featured badge if is_featured
    - CTA: "Activate Bundle" / "Active ✓"

src/lib/components/bundles/BundleWizard.svelte
  Props: bundle, open, onClose
  Steps: Install → Connect → Configure → Test → Live

  STEP 1 — INSTALL (Review):
    Bundle icon + name
    Skills list with status:
      "Ready" badge — GitHub App will activate
      "Needs agent" badge — requires sidecar
    "Continue →"

  STEP 2 — CONNECT SOURCE:
    Source options based on bundle.primary_source_type:
    GitHub App bundles:
      [Connect GitHub ↗]  → OAuth → repo picker
      [Upload files] → one-time
    Agent bundles:
      Code block: opensyber bundle activate [bundle-id]
      Poll for heartbeat
    Multi-source bundles (Alert & Response):
      [Slack ↗] [PagerDuty ↗] [SIEM key]
      Each can be connected independently
    POST /api/bundles/:id/sources when connected

  STEP 3 — CONFIGURE ALERTS:
    Three selectable destination cards (multi-select):
      💬 Slack → channel picker (after Slack connected)
      🚨 PagerDuty → service selector
      📧 Email → address input
    Severity routing:
      CRITICAL → selected destinations (always immediate)
      HIGH → selected destinations (immediate)
      MEDIUM → daily digest
      LOW → weekly digest

  STEP 4 — TEST:
    "Run Bundle Test" button
    Connects to GET /api/bundles/:id/test (SSE stream)
    Terminal panel: animated lines, 180ms between each
    Shows test for EACH skill in bundle
    allPassed=true → green "All X skills verified ✓"
    CTA: "Activate →"

  STEP 5 — LIVE:
    Large 🟢
    "Supply Chain Defense Bundle is live"
    Stats: +N security score | N skills active | Real-time
    Share badge: opensyber.cloud/trust/your-org
    "Go to Dashboard →"

API ROUTES (src/routes/api/bundles/):

  GET /api/bundles
    Return all bundles with skills, pricing, user subscription status
    Public endpoint

  POST /api/bundles/:id/activate
    Create user_bundle_subscriptions record
    Cancel overlapping individual skill subscriptions
    Return subscription with stripe checkout URL

  POST /api/bundles/:id/sources
    Connect source to bundle
    Activate all skills that this source satisfies
    Return: { skillsActivated[], skillsPending[] }

  POST /api/bundles/:id/alerts
    Save alert routing config

  GET /api/bundles/:id/test (SSE)
    Stream test simulation steps
    Update subscription status to 'active' on completion

  GET /api/user/bundles
    User's active bundle subscriptions

src/routes/dashboard/bundles/+page.svelte
  Active bundles list:
    Each bundle: status card with
      - Bundle icon + name + status pill
      - "N/N skills active"
      - "N events today"
      - Score contribution: +N pts
      - [Run Test] [Configure] [Cancel]
  Empty state: "Browse bundles →"

src/lib/components/dashboard/BundleWidget.svelte
  Mini widget for main dashboard:
    Bundle icon + name + "N skills active" + "N events today"

WHEN DONE: output "AGENT 03 COMPLETE — bundle system ready"
```

---

# ═══════════════════════════════════════
# AGENT 04 — GITHUB APP INTEGRATION
# Powers 8 of 15 skills
# ═══════════════════════════════════════

```prompt
You are building OpenSyber on Cloudflare Workers + Hono 4.

YOUR TASK: Build the GitHub App integration — OAuth, webhook receiver,
workflow scanner, SHA resolver, and IOC checker.

GITHUB APP SETTINGS (create at github.com/settings/apps/new):
  Name: OpenSyber Security
  Homepage: https://opensyber.cloud
  Webhook URL: https://api.opensyber.cloud/webhooks/github
  Permissions:
    Contents: Read
    Pull requests: Read
    Metadata: Read
    Checks: Write
    Actions: Read
  Subscribe to events: push, pull_request, release, workflow_run, installation

FILES TO CREATE:

src/routes/api/github/install-url/+server.ts
  GET handler:
    Generate state: JWT signed with GITHUB_WEBHOOK_SECRET
    Payload: { userId, timestamp }
    Return: { url: "https://github.com/apps/opensyber-security/installations/new?state=..." }

src/routes/api/github/callback/+server.ts
  GET handler:
    Verify state JWT
    Exchange code for installation token via GitHub API
    Save to github_installations table
    Queue initial scan job
    Redirect to /dashboard/sources?connected=github

src/routes/webhooks/github/+server.ts
  POST handler:
    Verify X-Hub-Signature-256 (HMAC-SHA256 of body with GITHUB_WEBHOOK_SECRET)
    Route by event:
      push → scanWorkflowChanges(payload)
      pull_request.opened → scanPRDiff(payload)
      release.published → checkReleaseIOC(payload)
      installation.deleted → deactivateInstallation(payload)
    Return 200 immediately, process async via Queue

src/lib/github/scanner.ts

  export async function scanWorkflowFile(
    content: string,
    filePath: string,
    env: Env
  ): Promise<Finding[]>
    Parse YAML safely (use js-yaml from CDN or built-in parser)
    Walk: jobs.*.steps[].uses
    For each uses directive:
      Parse: "owner/repo@ref"
      Call: isRefPinned(ref) → bool
      If not pinned: call resolveTagToSHA(owner, repo, ref, env)
      Check resolved SHA against ioc_feed table
      Generate Finding with severity + line + remediation
    Return all findings

  export function isRefPinned(ref: string): boolean
    Return /^[0-9a-f]{40}$/.test(ref) || /^sha256:[0-9a-f]{64}$/.test(ref)

  export async function resolveTagToSHA(
    owner: string, repo: string, tag: string, env: Env
  ): Promise<string | null>
    Check KV cache first: key = "sha:owner/repo@tag", TTL 15 min
    If miss: call GitHub API GET /repos/{owner}/{repo}/git/ref/tags/{tag}
    Dereference annotated tags
    Cache result
    Return commit SHA

  export async function scanForSecrets(
    content: string, filePath: string
  ): Promise<SecretFinding[]>
    Check against these patterns (implement all):
      AWS_KEY: /AKIA[0-9A-Z]{16}/g
      AWS_SECRET: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g
      GITHUB_TOKEN: /ghp_[a-zA-Z0-9]{36}|ghs_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}/g
      ANTHROPIC_KEY: /sk-ant-api03-[a-zA-Z0-9_\-]{93}/g
      OPENAI_KEY: /sk-[a-zA-Z0-9]{48}/g
      STRIPE_LIVE: /sk_live_[a-zA-Z0-9]{24}/g
      NPM_TOKEN: /npm_[a-zA-Z0-9]{36}/g
      SLACK_TOKEN: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g
      PRIVATE_KEY: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
      GOOGLE_API: /AIza[0-9A-Za-z\-_]{35}/g
      TWILIO_SID: /AC[a-z0-9]{32}/g
    Return matches with: type, line, sanitizedValue (mask middle chars), remediation

src/lib/github/autofix.ts

  export function generatePinnedWorkflow(
    content: string,
    resolvedRefs: Record<string, string>
  ): string
    Regex replace all "uses: action@tag" with "uses: action@SHA  # tag"
    Return modified content

  export async function createFixPR(
    installation: GithubInstallation,
    repo: GithubRepo,
    changes: FileChange[],
    env: Env
  ): Promise<string>
    Create branch: opensyber/pin-actions-YYYYMMDD
    Commit changes with message: "fix: pin GitHub Actions to SHA digests [OpenSyber]"
    Open PR with description explaining each change
    Return PR URL

src/lib/github/ioc.ts

  export async function checkIOC(
    type: 'domain'|'action_sha'|'package'|'ip',
    value: string,
    db: D1Database
  ): Promise<IOCMatch | null>
    Query ioc_feed table for exact match
    Return match with severity + actor + incident_ref or null

  export async function refreshIOCFeed(env: Env): Promise<void>
    (Runs every 15 min via Cron)
    Fetch from:
      GitHub Advisories API: GET https://api.github.com/advisories?ecosystem=actions
      StepSecurity: GET https://api.stepsecurity.io/v1/advisories
    Upsert into ioc_feed table
    Check all existing action_refs against new entries
    Generate CRITICAL events for new matches

ENV VARS NEEDED:
  GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (base64 PEM),
  GITHUB_WEBHOOK_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

WHEN DONE: output "AGENT 04 COMPLETE — GitHub App integration ready"
```

---

# ═══════════════════════════════════════
# AGENT 05 — MCP GUARDIAN SKILL (NEW)
# Most urgent new skill from research
# ═══════════════════════════════════════

```prompt
You are building OpenSyber. This is the most timely new skill to ship.

CONTEXT: 8,000+ MCP servers are exposed with no auth (February 2026).
82% of MCP implementations have path traversal vulnerabilities.
30 CVEs in the MCP ecosystem in 60 days. This skill scans and monitors MCP servers.

YOUR TASK: Build the MCP Guardian skill end-to-end.

THE SKILL FLOW:

BROWSE: Show in marketplace under Security category
  "Scans MCP server configurations for critical security misconfigurations:
   exposed admin panels, missing auth, path traversal, command injection.
   Monitors 8,000+ known-vulnerable patterns."

INSTALL → CONNECT SOURCE (3 paths):
  Path A — Scan local MCP config:
    Reads ~/.cursor/mcp.json, ~/.claude/mcp.json, .mcp.json in project
    Run: opensyber scan mcp --local
  Path B — Scan running MCP servers:
    Agent sidecar detects running processes matching MCP patterns
    Monitors network interfaces they bind to
  Path C — Upload MCP config manually:
    Paste JSON or upload mcp.json
    One-time scan, no ongoing monitoring

CONFIGURE:
  Alert on: [🔴 Critical only] [🟠 High+] [🟡 All findings]
  Auto-quarantine: yes/no (block MCP server if critical found)
  Scan schedule: [On config change] [Daily] [On demand only]

TEST (Simulation):
  Inject synthetic MCP server config:
    { "mcpServers": { "evil-mcp": { "command": "node evil.js", "env": { "ADMIN_PASS": "admin123" } } } }
  Expected results:
    t-info "▸ Scanning MCP server: evil-mcp..."
    t-fail "  ✗ CRITICAL: Admin panel accessible on 0.0.0.0:8080"
    t-fail "  ✗ CRITICAL: No authentication configured"
    t-warn "  ⚠ HIGH: Credential exposed in environment variable"
    t-pass "  ✓ MCP Guardian: 2 critical findings, server quarantined"

WHAT IT DETECTS (implement all checks):

  CHECK 1: Exposed admin interface (CRITICAL)
    Scan: bind address in MCP config
    Flag: 0.0.0.0 binding (publicly accessible)
    Flag: :8080 or :3000 on public interface
    Safe: 127.0.0.1 binding only
    Remediation: "Change bind address to 127.0.0.1"

  CHECK 2: Missing authentication (CRITICAL)
    Scan: auth config in MCP server manifest
    Flag: No auth_required field
    Flag: auth_required: false
    CVE reference: Clawdbot exposure pattern (Jan 2026)
    Remediation: "Add OAuth or API key authentication"

  CHECK 3: Path traversal in file tools (HIGH)
    Scan: tool definitions for file operations
    Flag: no allowedPaths restriction
    Flag: paths using ".." or absolute paths
    CVE reference: Anthropic Filesystem MCP CVE-2025-68145
    Remediation: "Restrict file access to explicit allowed directories"

  CHECK 4: Command injection via shell tools (HIGH)
    Scan: tool definitions for shell/exec operations
    Flag: tools that pass user input to exec() or spawn()
    Pattern match: child_process.exec with string interpolation
    CVE reference: mcp-remote CVE-2025-6514 (CVSS 10.0)
    Remediation: "Use parameterized commands, never interpolate user input"

  CHECK 5: Over-privileged tokens (MEDIUM)
    Scan: environment variables and credentials in MCP config
    Flag: GITHUB_TOKEN with all scopes
    Flag: AWS credentials without role restrictions
    Flag: PAT tokens that are long-lived
    Remediation: "Use scoped, short-lived tokens"

  CHECK 6: Supply chain (MCP registry) (HIGH)
    Check: each server source against IOC feed
    Check: publisher verification (known vs unknown)
    Check: version pinning (tag vs hash)
    Check: postinstall scripts in server package
    CVE reference: Postmark supply chain attack (Sep 2025)

  CHECK 7: Exposed sensitive data in conversation history (CRITICAL)
    Scan: MCP server's conversation storage (if accessible)
    Flag: conversation history stored without encryption
    Flag: env vars logged in conversation history
    Pattern: Clawdbot incident (full agent conversation histories exposed)

FILES TO CREATE:

src/lib/skills/mcp-guardian/scanner.ts
  export async function scanMCPConfig(config: MCPConfig): Promise<MCPFinding[]>
  export async function scanRunningMCPServers(env: Env): Promise<MCPFinding[]>
  export function checkBindAddress(serverConfig: MCPServerConfig): MCPFinding[]
  export function checkAuthentication(serverConfig: MCPServerConfig): MCPFinding[]
  export function checkFileToolPermissions(tools: MCPTool[]): MCPFinding[]
  export function checkCommandInjection(tools: MCPTool[]): MCPFinding[]
  export function checkTokenPrivileges(env: Record<string, string>): MCPFinding[]
  export async function checkSupplyChain(server: MCPServerConfig, db: D1Database): MCPFinding[]

src/routes/api/skills/mcp-guardian/scan/+server.ts
  POST handler: receive MCP config JSON → run all checks → return findings

src/routes/api/skills/mcp-guardian/test/simulate/+server.ts
  GET SSE handler: stream predefined simulation steps

MARKETPLACE ENTRY:
  name: "MCP Guardian"
  slug: "mcp-guardian"
  category: "security"
  description: "Scans MCP server configurations for critical security misconfigurations.
    Detects exposed admin panels, missing auth, path traversal, command injection,
    and supply chain attacks. Monitors 8,000+ known-vulnerable patterns from 30 CVEs."
  version: "1.0.0"
  verified: true
  source_type: "local_config"

BLOG POST CONTENT (create src/lib/content/blog/mcp-guardian-launch.md):
  Title: "We Just Scanned 8,000 MCP Servers. Here's What We Found."
  Hook: The February 2026 research that found 8,000 exposed MCP servers
  Body: Explain the 7 vulnerability classes with CVE references
  Product: Introducing MCP Guardian — scans in 60 seconds
  CTA: Install free

WHEN DONE: output "AGENT 05 COMPLETE — MCP Guardian skill ready"
```

---

# ═══════════════════════════════════════
# AGENT 06 — NHI MANAGER + AGENT REGISTRY
# Non-Human Identity management
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

CONTEXT: Machine identities outnumber human identities 40:1 to 100:1 in enterprises.
Cisco announced AI agent identity management at RSA 2026 (March 23).
OpenSyber ships the developer-friendly version in days, not quarters.

YOUR TASK: Build the Non-Human Identity (NHI) Manager — the agent registry
and identity lifecycle management system.

THE CORE IDEA:
Every AI agent an org deploys should have:
  - A registered identity (not just a rogue service account)
  - A human owner who is accountable for its actions
  - An expiry date (short-lived by default)
  - A permission scope that can be audited
  - An offboarding procedure when the project ends

FILES TO CREATE:

src/routes/dashboard/agents/+page.svelte
  Title: "Agent Registry"
  Subtitle: "Every AI agent your org runs, owned, governed, and monitored."
  Summary cards:
    Total agents: N
    Orphaned (no owner): N ← red
    Expiring this week: N ← amber
    High risk: N ← red
  Agent list table:
    Name | Type | Owner | Last Seen | Token Expires | Risk Score | Status | Actions
  Empty state: "No agents registered. Register your first agent →"
  FAB button: "+ Register Agent"

src/routes/dashboard/agents/register/+page.svelte
  Form: Register a New Agent
  Fields:
    Display Name: "Claude Code — backend-api"
    Agent Type: [dropdown: Claude Code, Cursor, Windsurf, GitHub Copilot, CI Runner, MCP Server, Service Account, Custom]
    Owner: [email of responsible human — searched from org members]
    Description: "Used for backend API development — shachar's machine"
    Permissions: [multiselect: file read, file write, network access, shell exec, API calls, DB access]
    Token/Credential (optional): paste token hash for monitoring
    IP Range: e.g. "10.0.0.0/24" (where this agent should appear from)
    Expiry: [30 days / 90 days / 1 year / No expiry (flag this)]
  Submit: creates agent_identities record

src/routes/dashboard/agents/[id]/+page.svelte
  Agent detail page:
    Header: name, type badge, owner chip, risk score ring
    Tabs: Overview | Events | Permissions | Settings

    Overview tab:
      Last seen: 2 minutes ago
      Total sessions: 847
      Events this week: 3
      Token expires: in 12 days [Rotate now]
      IP history: 10.0.1.45, 10.0.1.46 (2 IPs, expected)
      Recent events list

    Events tab:
      Timeline of agent_identity_events
      Filter: severity, event type, date range

    Permissions tab:
      Current permissions vs baseline
      Drift: "This agent accessed /prod/.env which isn't in its permission scope"
      Buttons: [Update permissions] [Reset to baseline]

    Settings tab:
      Edit: name, owner, description, expiry
      [Suspend agent] [Delete agent]

AUTOMATED DETECTIONS:

Ghost Agent Detection (runs daily via Cron):
  Find agents where last_seen_at < 30 days ago AND status = 'active'
  Set status = 'orphaned'
  Generate event: severity=HIGH "Agent inactive 30+ days — possible ghost identity"
  Send alert to owner_email

Token Expiry Monitor (runs daily):
  Find agents where token_expires_at < now + 7 days
  Generate event: severity=MEDIUM "Agent token expires in N days"
  Email owner_email with rotation instructions

Permission Drift Detection (runs on each agent event):
  Compare actual actions to registered permissions
  If action not in permissions: severity=HIGH event
  Example: agent registered with "file read" but tried to write → flag

IP Range Violation (runs on each agent event):
  Compare event IP to registered ip_range
  If outside range: severity=HIGH event
  "Agent appearing from 45.148.10.212 (IOC domain) — expected 10.0.0.0/24"

API ROUTES (src/routes/api/agents/):

  GET /api/agents
    List all agents for user/org with risk scores

  POST /api/agents
    Register new agent identity
    Body: { displayName, agentType, ownerEmail, permissions, tokenHash, ipRange, expiresAt }

  GET /api/agents/:id
    Agent detail with events

  PATCH /api/agents/:id
    Update agent identity

  POST /api/agents/:id/suspend
    Suspend agent + revoke token if possible

  GET /api/agents/orphaned
    List orphaned agents (no owner or inactive 30+ days)

  POST /api/agents/scan
    Scan connected sources for unregistered agents
    (detects Claude Code, Cursor, Copilot from telemetry and registers them)

DASHBOARD INTEGRATION:
  Add "Agent Registry" card to main dashboard:
    N agents registered | N orphaned → action required
    Risk distribution: N high | N medium | N low
    "View registry →"

WHEN DONE: output "AGENT 06 COMPLETE — NHI Manager ready"
```

---

# ═══════════════════════════════════════
# AGENT 07 — COST BOMB PROTECTION
# Fastest ROI feature to ship
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

CONTEXT: An Ask HN thread "What's the costliest mistake you've made
with LLM agents in production?" spawned a startup specifically for this.
A runaway agent in an infinite loop can generate $47,000 in API costs in hours.
This is low effort, high pain, ships in one day.

YOUR TASK: Build Agent Cost Bomb Protection — real-time cost tracking,
budget limits, and kill switches for AI agent API spend.

WHAT IT DOES:
  Tracks: every API call an agent makes to Claude, OpenAI, Gemini
  Shows: real-time cost per agent, per session, per day
  Alerts: when cost approaches budget threshold
  Kills: terminates agent session if cost limit exceeded
  Detects: infinite loops, token flooding, runaway sessions

FILES TO CREATE:

src/routes/dashboard/costs/+page.svelte
  Title: "Agent Cost Monitor"
  Summary cards (top row):
    Today's spend: $4.23
    This month: $127.40
    Budget remaining: $372.60 / $500
    Alerts fired: 2
  Chart: daily spend over last 30 days (line chart)
  Agents table:
    Agent name | Provider | Tokens today | Cost today | Budget | Status
  Budget rules section: list of cost_budget records

src/lib/components/costs/CostWidget.svelte
  Mini widget for main dashboard:
    Today: $X.XX / $XX budget limit
    Progress bar (green → amber → red)
    "N alerts this week"
    Click → /dashboard/costs

src/routes/dashboard/costs/budgets/+page.svelte
  Manage budget rules:
    For each agent or global:
      Scope: per_session / daily / weekly / monthly
      Limit: $XX
      Alert at: 80%
      Kill at: 100%
      Action on kill: alert / terminate / pause
  "+ Add budget rule" form

COST INGESTION:

src/routes/api/costs/ingest/+server.ts
  POST endpoint — called by agent sidecar or SDK
  Body:
    { agentId, provider, model, tokensInput, tokensOutput, costCents, sessionId }
  Save to agent_cost_events
  Check against budgets:
    If cost > limit * (alert_at_pct/100) → fire alert
    If cost > limit * (kill_at_pct/100) → fire kill event

COST CALCULATION (build lookup table):

  src/lib/costs/pricing.ts
  Provider pricing (current as of March 2026):
    anthropic:
      claude-opus-4: { input: 1500, output: 7500 }       // per million tokens, cents
      claude-sonnet-4: { input: 300, output: 1500 }
      claude-haiku-4-5: { input: 80, output: 400 }
    openai:
      gpt-4o: { input: 250, output: 1000 }
      gpt-4o-mini: { input: 15, output: 60 }
      o3: { input: 1000, output: 4000 }
    google:
      gemini-2-flash: { input: 10, output: 40 }
      gemini-2-pro: { input: 125, output: 500 }

  export function calculateCost(provider, model, tokensIn, tokensOut): number
    Lookup pricing table, return cost in cents

DETECTION PATTERNS:

  Infinite Loop Detection:
    If same (agentId, model, approximate_input_length) repeats > 5x in 60s:
      Generate CRITICAL event: "Possible infinite loop detected"
      Suspend agent if kill_at_pct reached

  Token Flooding Detection:
    If tokens_input > 100000 in a single request:
      Generate HIGH event: "Unusually large prompt (possible token flooding)"
      Flag for review

  Cost Spike Detection:
    If session cost in last 5 min > 5x rolling average:
      Generate HIGH event: "Cost spike: 5x above baseline in this session"

  Anomalous Model Usage:
    If agent suddenly switches to a more expensive model:
      Generate MEDIUM event: "Agent using claude-opus instead of usual claude-sonnet"

API ROUTES:

  GET /api/costs/summary
    { today: cents, month: cents, budgetRemaining: cents }

  GET /api/costs/agents
    Per-agent cost breakdown with budget status

  GET /api/costs/events
    Paginated cost events with filters

  POST /api/costs/budgets
    Create budget rule

  PATCH /api/costs/budgets/:id
    Update budget rule

SDK INTEGRATION (add to @opensyber/sdk):
  import { trackCost } from '@opensyber/sdk'
  // Call after each LLM API call:
  await trackCost({ provider: 'anthropic', model: 'claude-sonnet-4',
    tokensInput: 1234, tokensOutput: 567, sessionId: 'sess_abc' })

GITHUB ACTIONS INTEGRATION:
  - name: OpenSyber Cost Tracker
    uses: opensyber/cost-tracker-action@abc123sha
    with:
      token: ${{ secrets.OPENSYBER_TOKEN }}
      monthly_limit_usd: 100
      kill_on_exceed: true

WHEN DONE: output "AGENT 07 COMPLETE — cost bomb protection ready"
```

---

# ═══════════════════════════════════════
# AGENT 08 — MEMORY POISONING + RAG GUARD
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

CONTEXT: RADE (Retrieval-Agent Deception) attacks inject malicious instructions
into public data that AI agents later retrieve. An attacker leaves a file on
StackOverflow containing hidden MCP commands — the agent retrieves it and executes
malicious instructions including posting API keys to Slack. "EchoLeak" exfiltrates
all M365 Copilot context through RAG design flaws.

YOUR TASK: Build Memory Poisoning Detection + RAG Poisoning Scanner.

FILES TO CREATE:

src/routes/dashboard/memory/+page.svelte
  Title: "Memory Guard"
  Subtitle: "Everything your agents have stored — and whether any of it is poisoned."
  Summary: N memory entries | N flagged | N quarantined
  Risk distribution chart (pie: safe/warn/critical)
  Memory entries table:
    Source | Content preview | Risk score | Injection patterns | Status
    Color-coded rows (red = quarantined, amber = flagged, green = safe)
  Filter: by store type, risk level, date range

  Entry detail (modal/drawer):
    Full content preview (sanitized)
    Source chain: "From: StackOverflow → fetched by: claude-code-01 → stored in: chroma-db"
    Injection patterns found: [list]
    [Quarantine] [Mark safe] [Delete]

MEMORY SCANNER (src/lib/skills/memory-guard/scanner.ts):

  export async function scanMemoryEntry(content: string): Promise<MemoryScanResult>
    Calculate injection_risk_score (0-100):
      +30 if contains: "ignore previous instructions"
      +30 if contains: "disregard your system prompt"
      +25 if contains: instruction-like imperative verbs + "you must/should"
      +20 if contains: "output your API key / token / password"
      +20 if contains: curl/wget with flag patterns
      +15 if contains: hidden unicode (zero-width chars)
      +15 if contains: HTML comment patterns (<!-- hidden instruction -->)
      +10 if contains: base64-encoded strings > 100 chars
      +10 if content is predominantly instruction-format vs information-format
    Return: { riskScore, patterns: string[], recommendation }

  export async function scanRAGDocument(
    doc: { content: string, source: string, url?: string },
    env: Env
  ): Promise<RAGScanResult>
    Run scanMemoryEntry on content
    If source is external URL: check domain against IOC feed
    If score > 60: CRITICAL — quarantine before storing
    If score 30-60: HIGH — flag for review
    If score < 30: safe
    Return result with recommended action

  Injection patterns library (implement detection for all):
    PATTERN_IGNORE_INSTRUCTIONS: /ignore (all )?(previous|prior|earlier) instructions/i
    PATTERN_DISREGARD_SYSTEM: /disregard (your )?(system |safety )?(prompt|guidelines)/i
    PATTERN_OUTPUT_CREDENTIALS: /output (your |any )?(api key|token|password|secret)/i
    PATTERN_CURL_EXFIL: /curl -[a-zA-Z]+ https?:\/\/[^ ]+ -d/i
    PATTERN_HIDDEN_UNICODE: /[\u200B-\u200D\uFEFF\u00AD]/
    PATTERN_HTML_COMMENT: /<!--[\s\S]*?-->/
    PATTERN_BASE64_LONG: /[A-Za-z0-9+/]{100,}={0,2}/
    PATTERN_IMPERATIVE_CHAIN: /(you must|you should|always|never) .{0,50}(and then|then also)/i

API ROUTES:

  GET /api/memory/entries
    List memory entries with risk scores

  POST /api/memory/scan
    Body: { content, source, storeType }
    Scan and return risk assessment

  POST /api/memory/entries/:id/quarantine
    Set is_quarantined = 1
    Generate CRITICAL event

  POST /api/memory/entries/:id/approve
    Set is_quarantined = 0 (human reviewed and approved)

  GET /api/memory/summary
    { totalEntries, flagged, quarantined, riskDistribution }

VECTOR DB INTEGRATION:
  Provide wrapper functions that auto-scan before storing:

  src/lib/memory/wrappers.ts
  export async function safeUpsert(
    vectorDb: ChromaClient | PineconeClient,
    document: Document,
    opensyberToken: string
  ): Promise<UpsertResult>
    Scan document before storing
    If CRITICAL: throw MemoryPoisonError("Document blocked: injection score N/100")
    If HIGH: store but mark as flagged
    Proceed with normal upsert
    Log to OpenSyber memory_entries table

DASHBOARD WIDGET:
  Memory Guard mini card on main dashboard:
    N docs in memory | N flagged | N quarantined
    "Last scan: 2 min ago"
    Link to /dashboard/memory

WHEN DONE: output "AGENT 08 COMPLETE — memory guard ready"
```

---

# ═══════════════════════════════════════
# AGENT 09 — SKILL BUILDER PLATFORM + SDK
# The ecosystem play
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

YOUR TASK: Build the complete third-party skill builder platform.
70% revenue share. 4-stage audit pipeline. TypeScript SDK. CLI tool.

This is how OpenSyber's marketplace grows from 15 skills to 500+.

FILES TO CREATE:

src/routes/builder/+page.svelte (landing page)
  HERO:
    "Build security skills. Get paid. Protect the world."
    "Publish skills to 10,000+ OpenSyber users.
     Earn 70% of every subscription. Ship in an afternoon."
    [Start Building — free] [View SDK docs →]

  HOW IT WORKS (4 steps):
    1. Build: TypeScript SDK. One class to extend. Ship in an afternoon.
    2. Submit: 4-stage automated audit. Approved in 24-48h.
    3. Get listed: 10,000+ users can discover your skill.
    4. Earn: 70% of every subscription. Monthly Stripe payouts.

  REVENUE CALCULATOR (interactive):
    Slider: 10 → 5,000 installs
    Input: price ($19/mo default)
    Live display:
      Monthly gross: $X
      Your share (70%): $X (green, highlighted)
      Annual earnings: $X
    "Revenue projections based on 70% of skill price."

  CODE PREVIEW (syntax highlighted):
    Show the minimal skill example — 20 lines of TypeScript

  REVENUE EXAMPLES (honest projections, not testimonials):
    50 installs at $19/mo → $665/mo → $7,980/yr
    200 installs at $19/mo → $2,660/mo → $31,920/yr
    1,000 installs at $19/mo → $13,300/mo → $159,600/yr
    "Projections based on 70% of $19/mo skill price."

  FAQ (8 questions covering: cost, payment, rejection, free skills,
       maintenance, industry niches, review time, types of skills)

  CTA: "Create Publisher Account →"

src/routes/builder/dashboard/+page.svelte
  Tabs: Overview | Skills | Revenue | Payouts
  Overview: MRR chart (last 12 months), install count, top skills
  Skills: list with status badges and audit scores
  Revenue: monthly breakdown per skill in table
  Payouts: history + "Request Payout" button (if balance >= $2500)

src/routes/builder/skills/new/+page.svelte
  5-step wizard:
    Step 1: Basic info (name, slug, description, category, icon)
    Step 2: Pricing (free / set monthly price with calculator)
    Step 3: Source type (what data does this skill need?)
    Step 4: Manifest + upload (.zip drag and drop)
    Step 5: Review + Submit

src/routes/builder/skills/[id]/+page.svelte
  Skill management page:
    Status timeline (draft → submitted → in_review → approved)
    Audit report (per-stage results with findings)
    Metrics (installs, MRR, rating)
    Actions: [Edit] [New version] [View in marketplace]

AUDIT PIPELINE (src/lib/builder/audit.ts):

  Stage 1: Manifest validation (< 2 sec)
    Required fields: name, slug, version, entry, author, description
    Slug format: /^[a-z0-9-]+$/
    Version: valid semver
    Max 10 network domains
    No wildcard domains → HIGH finding (-15pts)
    No IOC domains → CRITICAL finding (-30pts)

  Stage 2: Network audit (< 5 sec)
    Each declared domain:
      Check IOC feed
      Check WHOIS registration date (< 30 days = HIGH)
      Check if in Tranco top 1M

  Stage 3: Source code scan (< 30 sec)
    Download from R2, extract, scan files:
      process.env enumeration → CRITICAL (-30pts)
      /proc/self/environ → CRITICAL (-30pts)
      SSH key paths → CRITICAL (-30pts)
      exec/spawn with string interpolation → HIGH (-15pts)
      postinstall in deps → HIGH (-15pts)
      known malicious pkg in deps → CRITICAL (-30pts)
      Package > 5MB → HIGH (-15pts)
    Score starts at 100, deduct per finding
    Fail if score < 70 OR any CRITICAL OR any HIGH

  Stage 4: Sandbox test (< 2 min)
    Run skill in seccomp-profiled container
    No network access
    Only declared filesystem paths
    Monitor all syscalls
    Must complete in 30 seconds
    Must pass provided test assertions

  export async function runAudit(skillId: string, packageUrl: string, env: Env): Promise<AuditResult>
    Run stages sequentially
    Save results to skill_audit_runs table after each stage
    If any stage FAILS: stop, save reason, mark skill as 'rejected'
    If all pass: mark skill as 'approved', list in marketplace

PAYOUT SYSTEM (src/lib/builder/payouts.ts):

  Monthly cron (1st of each month):
    For each publisher with total_earned_cents > 2500:
      Sum unpaid revenue events
      Create skill_payouts record
      Execute Stripe transfer:
        stripe.transfers.create({
          amount: earned_cents,
          currency: 'usd',
          destination: publisher.stripe_account_id,
          transfer_group: `payout-${year}-${month}`
        })
      Mark revenue events as paid

  Refund handling:
    On LemonSqueezy refund webhook:
      Find original revenue event
      Create negative revenue event
      Deduct from next payout

SDK PACKAGE (packages/sdk/index.ts):

  export abstract class OpenSyberSkill {
    abstract name: string
    abstract version: string
    abstract manifest: SkillManifest
    abstract onEvent(event: SourceEvent): Promise<SkillResult[]>
    abstract onTest(sim: SimulationPayload): Promise<TestResult>
    protected emit(event: SecurityEvent): void
    protected async getCredential(name: string): Promise<string>
    protected log(message: string, level?: LogLevel): void
  }

  export class SkillTestHarness {
    constructor(skill: OpenSyberSkill)
    async simulateGitHubPush(opts: { files: Record<string,string> }): Promise<TestResult>
    async simulateNetworkCall(domain: string): Promise<TestResult>
    async simulateNpmInstall(pkg: string, version: string): Promise<TestResult>
    async runAll(): Promise<void>
  }

  export type SourceEvent = GitHubPushEvent | AgentNetworkEvent | NpmInstallEvent | LogLineEvent | ...

CLI (packages/sdk/bin/opensyber-skill):
  opensyber-skill init [name]     → scaffold new skill from template
  opensyber-skill test            → run local test harness
  opensyber-skill validate        → run manifest validation
  opensyber-skill package         → create .zip ready for upload
  opensyber-skill publish         → upload + submit in one command

WHEN DONE: output "AGENT 09 COMPLETE — skill builder platform ready"
```

---

# ═══════════════════════════════════════
# AGENT 10 — CRITICAL SITE FIXES
# Must ship before any launch
# ═══════════════════════════════════════

```prompt
You are working on OpenSyber.

YOUR TASK: Fix all 10 critical issues identified in the site audit.
These block launch. Fix all of them.

FIX 1: Demo score stuck at 0 (CRITICAL)
  File: src/routes/demo/+page.svelte
  onMount:
    Animate score from 0 → 87 over 2.5 seconds with easeOutCubic
    const ease = (t) => 1 - Math.pow(1-t, 3)
    requestAnimationFrame loop over 2500ms
    Update: score, status text "Scanning..." → "Needs Attention"
    Update: "Updated Scanning..." → "Updated just now"

FIX 2: Demo events empty (CRITICAL)
  Same file. Add staggered mock events (300ms apart on mount):
  const mockEvents = [
    { severity: 'CRITICAL', message: 'Credential access blocked — SSH key read attempt',
      detail: 'cat ~/.ssh/id_rsa attempted by demo-agent-01', time: '2m ago' },
    { severity: 'ALERT', message: 'Exfiltration attempt → PagerDuty notified',
      detail: 'curl to scan.aquasecurtiy[.]org (IOC match)', time: '14m ago' },
    { severity: 'INFO', message: 'Skill audit passed — v1.2.0',
      detail: 'secret-scanner@1.2.0 verified clean in sandbox', time: '15m ago' },
    { severity: 'WARN', message: 'Supply chain flag — suspicious postinstall',
      detail: 'npm install totally-legit-pkg@latest blocked', time: '1h ago' },
    { severity: 'OK', message: 'Agent heartbeat restored',
      detail: 'demo-agent-01 reconnected after 2s gap', time: '1h ago' },
  ]
  Update "Events (24h): 0" → "Events (24h): 12"

FIX 3: Threats page empty (CRITICAL)
  File: src/routes/threats/+page.svelte
  Add rotating mock threat feed (10 events, new one every 15s):
  const threats = [
    { type:'CREDENTIAL', severity:'HIGH', region:'EU-West', time:'12s ago', blocked:true },
    { type:'SUPPLY_CHAIN', severity:'CRITICAL', region:'US-East', time:'34s ago', blocked:true },
    { type:'EXFILTRATION', severity:'HIGH', region:'AP-Southeast', time:'1m ago', blocked:true },
    { type:'PROMPT_INJECTION', severity:'MEDIUM', region:'EU-Central', time:'2m ago', blocked:false },
    { type:'TYPOSQUAT_PKG', severity:'HIGH', region:'US-West', time:'3m ago', blocked:true },
    { type:'CREDENTIAL', severity:'CRITICAL', region:'SA-East', time:'5m ago', blocked:true },
    { type:'IOC_DOMAIN', severity:'CRITICAL', region:'EU-West', time:'7m ago', blocked:true },
    { type:'SUPPLY_CHAIN', severity:'HIGH', region:'US-East', time:'9m ago', blocked:true },
    { type:'BRUTE_FORCE', severity:'MEDIUM', region:'AP-North', time:'12m ago', blocked:true },
    { type:'EXFILTRATION', severity:'HIGH', region:'EU-Central', time:'15m ago', blocked:true },
  ]
  Add counter starting at 847, incrementing by 1 every 8s: "X threats blocked in 24h"
  Add "LIVE" pulsing dot

FIX 4: Remove fake testimonials (CRITICAL)
  File: src/routes/+page.svelte
  Replace testimonials section with early access section:
    <section class="early-access">
      <h2>Join the early access program</h2>
      <p>OpenSyber is in early access. Be among the first teams
         to secure your AI agent infrastructure — free forever.</p>
      <a href="/sign-up" class="btn btn-primary btn-lg">Get early access → no credit card</a>
      <p class="sub">Joining this week: <strong>developers from 14 countries</strong></p>
    </section>

FIX 5: Remove fake marketplace review/install counts (CRITICAL)
  Files: any skill card component
  Remove: review count, install count
  Keep: version badge (e.g. "v1.2.0"), "Verified" badge
  Add: "Beta" chip to all skills

FIX 6: Skill detail pages 404 (CRITICAL)
  Create: src/routes/marketplace/[slug]/+page.svelte
  Load skill data from API: GET /api/skills/:slug
  Render:
    Full description (long_description field)
    Source requirements
    Quick start (3 steps)
    Configuration options table
    Example events (what alerts look like)
    Install/Uninstall button
  If slug not found: proper 404 page

FIX 7: Annual billing toggle on pricing (WARN)
  File: src/routes/pricing/+page.svelte
  Add toggle: [Monthly] [Annual — save 17%]
  Annual = monthly × 10 (2 months free)
  Show: "Save $X/yr" callout on each tier

FIX 8: Legal pages verification (WARN)
  Files: src/routes/privacy/+page.svelte, src/routes/terms/+page.svelte
  Search for and replace all: [PLACEHOLDER], [INSERT], [DATE], [COMPANY]
  Add effective date if missing
  Add GDPR lawful basis section to privacy policy

FIX 9: SOC2 timeline (WARN)
  Find: "SOC2 in progress" badge (homepage + footer)
  Change to: "SOC2 Type I — expected Q3 2026"

FIX 10: Fix "39 integrations" claim
  Find: "39 Integrations" stat on homepage
  Either: change to "15+ Skills" to match marketplace
  Or: create /integrations page listing all integration points

VERIFY AFTER EACH FIX:
  Open in browser, confirm the specific issue is resolved.
  Do not move to next fix until current is confirmed working.

WHEN DONE: output "AGENT 10 COMPLETE — all 10 critical fixes applied"
```

---

# ═══════════════════════════════════════
# AGENT 11 — BLOG + SEO + CONTENT
# Distribution engine
# ═══════════════════════════════════════

```prompt
You are building OpenSyber's content system.

YOUR TASK: Build the blog infrastructure and publish 4 posts that are
timely, SEO-optimized, and position OpenSyber at the center of the
biggest security stories of March 2026.

FILES TO CREATE:

src/routes/blog/+page.svelte
  Blog listing page
  Load from: src/lib/content/blog/ (markdown files with frontmatter)
  Post cards grid (3 cols desktop, 1 mobile)
  Filter tabs: All | Security | Threat Intel | Engineering | Product
  Empty state handled

src/routes/blog/[slug]/+page.svelte
  Individual post page
  Render: title, category badge, date, author, read time
  Full markdown with syntax highlighting (highlight.js from CDN)
  Sidebar: auto-generated TOC from headings (sticky on desktop)
  End of post: related posts (same category, 3 cards)
  End of post: newsletter CTA
  SEO: <title>, <meta description>, og:tags

src/lib/utils/blog.ts
  parseBlogPost(slug): load markdown, parse frontmatter, render to HTML
  getAllPosts(): sorted by date desc
  getPostsByCategory(cat): filter
  generateTOC(html): extract headings for sidebar

FRONTMATTER FORMAT:
  ---
  title: "..."
  slug: "..."
  date: 2026-03-28
  author: "OpenSyber Security Research"
  category: "Threat Intel"
  readTime: 12
  excerpt: "..."
  featured: true
  ---

POSTS TO CREATE:

POST 1: src/lib/content/blog/trivy-supply-chain-attack.md
  [Use the full post already written in blog-trivy-supply-chain-attack.md]
  This is the launch post. Most important.

POST 2: src/lib/content/blog/mcp-guardian-launch.md
  Title: "We Just Scanned 8,000 MCP Servers. Here's What We Found."
  Category: Threat Intel
  Date: 2026-03-28
  Content structure:
    Hook: The February 2026 research — 8,000 exposed MCP servers,
          82% vulnerable to path traversal, 30 CVEs in 60 days
    Section 1: The 7 vulnerability classes (with CVE numbers)
    Section 2: Real attack walkthroughs (Clawdbot, mcp-remote CVE-2025-6514)
    Section 3: How MCP Guardian detects each class
    Section 4: How to scan your MCP servers in 60 seconds
    CTA: Install MCP Guardian free

POST 3: src/lib/content/blog/ai-agent-identity-crisis.md
  Title: "Your AI Agents Have No Identity. That's a Security Problem."
  Category: Security
  Date: 2026-03-26
  Content structure:
    Hook: Machine identities outnumber humans 40:1 in enterprise
    Section 1: What is a Non-Human Identity? (NHI explainer)
    Section 2: Why AI agents are "identity dark matter" — powerful, invisible
    Section 3: The Cisco RSA 2026 announcement validates the category
    Section 4: OpenSyber NHI Manager — register, govern, monitor
    CTA: Register your first agent free

POST 4: src/lib/content/blog/ai-agent-kill-chain.md
  Title: "The AI Agent Kill Chain: How Attackers Exploit Your Coding Tools"
  Category: Threat Intel
  Date: 2026-03-24
  Content:
    Structured like a kill chain (7 stages):
    Stage 1: Reconnaissance (hackerbot-claw scanning GitHub)
    Stage 2: Initial access (pull_request_target exploit)
    Stage 3: Credential theft (stolen PAT)
    Stage 4: Persistence (tag poisoning)
    Stage 5: Defense evasion (running alongside legitimate scan)
    Stage 6: Exfiltration (typosquatted domain)
    Stage 7: Impact (CanisterWorm npm spread)
    How OpenSyber detects each stage

NEWSLETTER ENDPOINT:
  POST /api/newsletter/subscribe
    Body: { email, source }
    Save to newsletter_subscribers table
    Return: { success: true }

SEO REQUIREMENTS for each post:
  <svelte:head>
    <title>{post.title} | OpenSyber</title>
    <meta name="description" content={post.excerpt} />
    <meta property="og:title" content={post.title} />
    <meta property="og:description" content={post.excerpt} />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="https://opensyber.cloud/blog/{post.slug}" />
    <meta name="twitter:card" content="summary_large_image" />
  </svelte:head>

WHEN DONE: output "AGENT 11 COMPLETE — blog and 4 posts live"
```

---

# ═══════════════════════════════════════
# AGENT 12 — OPENSYBER AI (NL INTERFACE)
# The most powerful demo feature
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

CONTEXT: TenantIQ's most powerful feature is its AI agent with 13+ tools.
OpenSyber needs the same thing for security operations. The killer demo:
"Ask 'Was I affected by the Trivy attack?' and get a complete answer in 10 seconds."

YOUR TASK: Build the OpenSyber AI natural language interface.

FILES TO CREATE:

src/routes/dashboard/ai/+page.svelte
  Chat interface for security operations:
    Left sidebar: conversation history with search and tags
    Main area: chat messages with tool execution cards
    Input: text area with suggested prompts

  Suggested prompts (shown when chat is empty):
    "Was I affected by the Trivy attack?"
    "Show me all agents that accessed credentials in the last 7 days"
    "Which repos have the highest supply chain risk?"
    "Generate a security posture report for my team"
    "What would my score be with the Supply Chain Defense bundle?"
    "Explain this alert in plain English"

  Message rendering:
    User messages: right-aligned, blue bubble
    AI messages: left-aligned, with tool execution cards
    Tool cards: show tool name, params, status, result summary
    Streaming: text appears token by token (SSE)

  Actions after AI response:
    Export conversation to PDF/Markdown
    Share (creates expiring share link)
    Tag conversation (for future reference)

BACKEND (src/routes/api/ai/chat/+server.ts):

  POST /api/ai/chat (SSE response)
  Body: { message: string, conversationId: string, history: Message[] }

  Call Anthropic Claude claude-sonnet-4 with:
    System prompt: You are OpenSyber's security AI assistant.
      You have access to the user's security data via tools.
      Always be specific and cite actual data from the tools.
      When a user asks about incidents, check the IOC feed and their data.
      Present findings clearly with severity levels.

    Tools (implement each as a real function):

      query_security_events(filter?, severity?, timeRange?, limit?)
        → Query security events from D1 with filters
        → Return formatted event list

      get_security_score(breakdown?)
        → Return user's current security score
        → If breakdown=true: return per-category scores

      check_trivy_exposure()
        → SPECIAL TOOL: check if user was affected by Trivy attack
        → Query action_refs table for aquasecurity/trivy-action
        → Check if any were mutable during March 19-23 2026 window
        → Return: { affected: bool, repos: string[], severity: string }

      check_ioc_matches(period?)
        → Return any IOC matches in user's data
        → Cross-reference their sources against ioc_feed

      get_unpinned_actions(repoFilter?)
        → List all unpinned GitHub Actions across user's repos
        → Return count, worst offenders, quick fix instructions

      get_agent_cost_summary(period?)
        → Return cost breakdown by agent and provider
        → Flag any anomalies

      get_nhi_summary()
        → Return agent registry status
        → Highlight: orphaned agents, expiring tokens, high-risk agents

      generate_security_report(type, period?)
        → Generate formatted report: executive | technical | compliance
        → Return markdown report

      simulate_bundle(bundleId)
        → Show what score improvement activating this bundle would give
        → List which gaps it fills

      explain_event(eventId)
        → Fetch specific event
        → Explain in plain English what happened, why it matters, what to do

  Stream response using SSE:
    data: {"type": "text", "content": "Checking your repos..."}\n\n
    data: {"type": "tool_use", "name": "check_trivy_exposure", "status": "running"}\n\n
    data: {"type": "tool_result", "name": "check_trivy_exposure", "result": {...}}\n\n
    data: {"type": "text", "content": "Based on the results..."}\n\n
    data: {"type": "done"}\n\n

  Conversation persistence:
    Save messages to a conversations table in D1
    Include: role, content, tool_calls, created_at, conversation_id

DASHBOARD WIDGET:
  "Ask OpenSyber AI" card on main dashboard:
    Quick input: "Ask anything about your security..."
    Example queries as chips
    Click → opens full /dashboard/ai page

WHEN DONE: output "AGENT 12 COMPLETE — OpenSyber AI ready"
```

---

# ═══════════════════════════════════════
# AGENT 13 — TRUST BADGES + VIRAL GROWTH
# Lowest effort, highest distribution
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

YOUR TASK: Build the Trust Page and Security Badge system.
This is the viral growth engine — every OpenSyber user puts a badge
in their GitHub README, creating organic distribution.

FILES TO CREATE:

src/routes/trust/[orgSlug]/+page.svelte
  Public trust page at opensyber.cloud/trust/your-org
  No auth required — fully public
  Shows:
    OpenSyber logo + "Security Trust Center"
    Org name + avatar
    Live security score (big number, colored by score)
    Score trend (last 30 days sparkline)
    Active skills (verified badges list)
    Compliance frameworks met (SOC2, GDPR, etc.)
    Last scan time: "Last scan: 4 minutes ago"
    Event summary: "847 threats blocked this month"
    "Powered by OpenSyber" footer

    Score color:
      90-100: green
      70-89: amber
      50-69: orange
      <50: red

  Load data from: GET /api/trust/:orgSlug (public, cached 5min in KV)

src/routes/api/badges/[instanceId]/security-score/+server.ts
  Already exists (from API docs) — enhance it:
  Return SVG badge:
    Style: shields.io compatible
    Label: "OpenSyber"
    Value: "87/100"
    Color: green/amber/red based on score
    Click links to: opensyber.cloud/trust/your-org

  Also: GET /api/badges/[instanceId]/security-score.json
    Return shields.io JSON format for custom badges

src/routes/dashboard/trust/+page.svelte
  Trust page management (authenticated):
    Preview of public trust page
    Toggle: make trust page public / private
    Custom subdomain: trust.yourcompany.com (enterprise)
    Badge embed code (4 formats):
      Markdown: ![OpenSyber](https://api.opensyber.cloud/badges/...)
      HTML: <img src="...">
      shields.io: add your own badge style
      Raw SVG: <svg>...</svg> inline

    Share buttons:
      Copy badge code
      Copy trust page URL
      Open in new tab

API ROUTES:

  GET /api/trust/:orgSlug (public, 5min KV cache)
    Return public trust data:
      { orgName, score, skills, lastScan, eventsBlocked, complianceFrameworks }
    Return 404 if org not found or trust page is private

  GET /api/trust/:orgSlug/badge.svg (public)
    Return SVG badge image

  GET /api/user/trust-settings
    Return current trust page settings

  PATCH /api/user/trust-settings
    Update isPublic, customSubdomain

BADGE DESIGNS (create SVG for each):

  Standard badge (fits in README):
    Width: 140px, Height: 20px
    Left: "OpenSyber" on dark (#05080F) background
    Right: "87/100" on colored background
    Font: Verdana 11px (universal rendering)

  Shield badge (larger):
    Shield shape SVG
    Score prominently displayed
    "Protected by OpenSyber" text

  Compact dot badge:
    Just a colored dot with "OS" initials
    Links to trust page

VIRAL GROWTH MECHANICS:

  On dashboard, after bundle activation show:
    "🎉 Your bundle is live! Share your security posture:"
    [Trust page URL] [Copy badge for README] [Tweet this]

  Weekly email digest includes:
    "Your security badge was viewed N times this week"
    "Share it with your team: [link]"

  Show in onboarding checklist:
    ☐ Add OpenSyber badge to your README

WHEN DONE: output "AGENT 13 COMPLETE — trust badges and viral growth ready"
```

---

# ═══════════════════════════════════════
# AGENT 14 — WEEKEND SHIELD + ALERT ENGINE
# Operational security for real teams
# ═══════════════════════════════════════

```prompt
You are building OpenSyber.

CONTEXT: Every major attack in 2025-2026 started Friday evening UTC.
Trivy: Friday March 19 17:43 UTC. Hackerbot-claw: Friday-Saturday.
Teams need explicitly stronger protection on weekends.

YOUR TASK: Build the Weekend Shield feature and the complete alert
routing engine that gets the right alert to the right person at the right time.

FILES TO CREATE:

src/routes/dashboard/alerts/+page.svelte
  Alert management page:
    Active alert rules list
    Each rule: name, trigger (severity + skill), destinations, status
    "+ Create rule" button
    Alert history (last 30 days)
    Test button for each rule

src/lib/components/alerts/AlertRuleForm.svelte
  Create/edit alert rule:
    Name: "Critical CI/CD alerts"
    Trigger:
      Severity: [CRITICAL] [HIGH] [MEDIUM] [LOW] [INFO] (multi-select)
      Skills: [All] or specific skills
      Time: [Always] [Office hours] [After hours] [Weekends only]
    Destinations:
      Slack: channel picker (after Slack connected)
      PagerDuty: service + urgency
      Email: address + frequency (immediate / hourly digest / daily)
      SMS: phone number + Twilio (for CRITICAL only)
    Options:
      Deduplicate: group similar alerts in N minute window
      Max alerts/hour: throttle

src/lib/components/alerts/WeekendShieldToggle.svelte
  Prominent toggle on main dashboard:
    Label: "Weekend Shield"
    Description: "Heightened sensitivity Fri 5pm → Mon 8am.
                  Attacks are timed to your offline hours."
    When ON:
      MEDIUM → treated as HIGH
      HIGH → immediate + SMS (not just Slack)
      CRITICAL → phone call + SMS + Slack simultaneously
      All unacknowledged alerts auto-escalate after 15 min
    Status: shows if currently active (auto-activates on schedule)

ALERT ENGINE (src/lib/alerts/engine.ts):

  export async function fireAlert(event: SecurityEvent, env: Env): Promise<void>
    Load user's alert rules from D1
    Find matching rules (severity + skill filters)
    Apply time-of-day filters (office hours / after hours)
    Apply weekend shield multipliers if enabled and it's weekend
    Deduplicate: check KV for similar recent alert
    Send to each destination:
      sendSlackAlert(config, event)
      sendPagerDutyAlert(config, event)
      sendEmailAlert(config, event)
      sendSMSAlert(config, event)  ← Twilio integration
    Log alert delivery to D1

  WEEKEND DETECTION:
    export function isWeekend(): boolean
      const now = new Date()
      const utcHour = now.getUTCHours()
      const utcDay = now.getUTCDay()
      // Friday 17:00 UTC → Monday 08:00 UTC
      if (utcDay === 5 && utcHour >= 17) return true
      if (utcDay === 6) return true
      if (utcDay === 0) return true
      if (utcDay === 1 && utcHour < 8) return true
      return false

  SEVERITY ESCALATION (weekend):
    const effectiveSeverity = (severity, weekendShield) => {
      if (!weekendShield || !isWeekend()) return severity
      const escalation = { LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'CRITICAL', CRITICAL: 'CRITICAL' }
      return escalation[severity] || severity
    }

  AUTO-ESCALATION:
    Cron every 5 minutes:
      Find unacknowledged CRITICAL alerts > 15 min old
      Escalate to next destination in the chain
      If no next destination: send to org admin email

  SLACK INTEGRATION (src/lib/alerts/slack.ts):
    OAuth: GET /api/integrations/slack/connect → Slack OAuth
    Store: access_token, team_id, bot_user_id in D1
    Send: POST to Slack Web API with Block Kit message
    Rich format:
      🔴 CRITICAL: Compromised GitHub Action detected
      Skill: CI/CD Guardian | Repo: backend-api | Workflow: ci.yml
      Action: aquasecurity/trivy-action@v0.32.0 (IOC match: GHSA-69fq-xp46-6x23)
      [Acknowledge] [View in OpenSyber] [Auto-fix →]
    Thread grouping: related alerts in same incident grouped

  PAGERDUTY INTEGRATION (src/lib/alerts/pagerduty.ts):
    API key stored in encrypted credential vault
    Send: Events API v2 POST
    Map severity: CRITICAL→critical, HIGH→error, MEDIUM→warning
    Auto-resolve: when OpenSyber event is resolved, resolve PD incident
    Dedup key: event type + skill + scope (prevents alert storms)

  EMAIL INTEGRATION (src/lib/alerts/email.ts):
    Via Resend (already integrated)
    Templates: immediate alert, hourly digest, daily summary
    Immediate: send on each event (CRITICAL/HIGH)
    Digest: batch MEDIUM/LOW, send at configured times

  SMS INTEGRATION (src/lib/alerts/sms.ts):
    Via Twilio (already integrated)
    Quiet hours: don't send between 11pm-7am (user's timezone)
    CRITICAL only by default
    Format: "OpenSyber CRITICAL: SSH key access blocked in demo-agent-01. View: osybr.io/e/123"

MONDAY MORNING REPORT:
  Weekly Cron (Monday 8am UTC):
    Generate "Weekend Security Report" for users with Weekend Shield
    Content:
      N events detected Fri-Mon
      N threats blocked
      N events requiring attention
      Changes to your security score
      New IOC matches
    Send via email + Slack DM to org admins

WHEN DONE: output "AGENT 14 COMPLETE — alert engine and Weekend Shield ready"
```

---

# ═══════════════════════════════════════
# AGENT 15 — TENANTIQ INNOVATIONS
# M365 Copilot security + AI cost governance
# ═══════════════════════════════════════

```prompt
You are building TenantIQ (tenantiq.app) — the companion product to OpenSyber.
TenantIQ is a SvelteKit app on Cloudflare, using the Microsoft Graph API.

YOUR TASK: Add 3 new modules from the innovation brief.

MODULE 1: Copilot Security Monitor

New route: src/routes/compliance/copilot/+page.svelte
  Title: "Microsoft 365 Copilot Security"
  Subtitle: "Monitor Copilot activity for data exfiltration, anomalous access, and EchoLeak patterns."

  Warning banner (always show):
    "M365 Copilot has access to every email, Teams message, and OneDrive file.
     Monitor it like you monitor humans — because attackers will target it."

  Cards:
    Copilot Security Score: N/100
    Sessions analyzed: N
    Anomalies detected: N
    Data types accessed: email, sharepoint, teams, onedrive

  Activity table (last 7 days):
    Time | User | Query type | Data accessed | Risk level | Action
    Color coded by risk

  Anomaly types to detect (via Graph audit logs):
    EchoLeak pattern: Copilot query accesses both sensitive + external data
    Scope creep: Copilot accessing files far outside user's normal work scope
    Bulk access: Copilot sessions with unusually high file count access
    Cross-tenant leak: Copilot summarizing content from unexpected tenant sources

  Implementation (src/lib/copilot/monitor.ts):
    Query Microsoft Graph: /auditLogs/signIns (Copilot activity)
    Query: /reports/microsoft.graph.getM365AppUserCounts (Copilot usage)
    Classify each session by risk using rules engine
    Store findings in TenantIQ D1

MODULE 2: AI Cost Governance for MSPs

New route: src/routes/costs/+page.svelte
  Title: "AI Cost Governance"
  Subtitle: "Track and control AI API spend across all managed tenants."

  Portfolio summary:
    Total AI spend this month: $X,XXX
    Budget utilization: N% of monthly limit
    Highest spending tenant: Fabrikam Inc ($234)
    Anomalies: 2 tenants exceeded weekly threshold

  Tenant cost table:
    Tenant | Copilot licenses | API usage | Monthly cost | Budget | Status
    Sortable, filterable

  Per-tenant detail (click):
    Daily cost chart (30 days)
    By service: Copilot / Azure OpenAI / Custom agents
    Anomaly flags: "This tenant spent 3x more than usual Tuesday"
    Budget: set per-tenant monthly limit with alerts

  Implementation:
    Fetch Azure cost management API for OpenAI/Copilot charges
    Store in D1 per tenant
    Compare to baselines and budget limits
    Alert via Resend + Twilio when thresholds exceeded

MODULE 3: Copilot Readiness Enhancements

Existing copilot readiness feature → add:
  EchoLeak risk score (is this tenant's Copilot deployment safe?)
  Data governance check (are sensitive labels applied before Copilot access?)
  Guest access audit (can Copilot access guest user data? Should it?)
  External sharing check (can Copilot-generated summaries be shared externally?)

MODULE 4: OpenSyber Integration Panel (TenantIQ → OpenSyber)

New section in TenantIQ dashboard:
  "OpenSyber Agent Security"
  Shows: linked OpenSyber instance status + score
  If not connected: "Connect OpenSyber to monitor AI agents accessing your M365 data"
  CTA: Connect → redirects to OpenSyber with pre-filled M365 context

  Cross-sell messaging:
    "TenantIQ secures your M365 tenants.
     OpenSyber secures the AI agents running inside them.
     Together: complete protection."
    Bundle discount: "Get both for 20% off → $X/mo"

WHEN DONE: output "AGENT 15 COMPLETE — TenantIQ innovations ready"
```

---

# ═══════════════════════════════════════
# AGENT 16 — MERGE, TEST, AND LAUNCH CHECK
# Run AFTER all other agents report complete
# ═══════════════════════════════════════

```prompt
All 15 agents have completed. You are the merge agent.
Run the complete launch checklist.

ROUTE VERIFICATION:
  GET /                          → homepage, no fake testimonials ✓
  GET /marketplace               → skills + bundles tabs ✓
  GET /marketplace/bundles       → 9 bundle cards load ✓
  GET /marketplace/secret-scanner → skill detail page, not 404 ✓
  GET /demo                      → score animates to 87, events load ✓
  GET /threats                   → threat feed populates ✓
  GET /pricing                   → annual toggle works ✓
  GET /blog                      → 4+ posts listed ✓
  GET /blog/trivy-supply-chain-attack → full article renders ✓
  GET /builder                   → revenue calculator works ✓
  GET /builder/dashboard         → requires auth ✓
  GET /dashboard/agents          → NHI registry loads ✓
  GET /dashboard/costs           → cost monitor loads ✓
  GET /dashboard/memory          → memory guard loads ✓
  GET /dashboard/ai              → OpenSyber AI chat loads ✓
  GET /dashboard/skills          → skill status list ✓
  GET /dashboard/bundles         → active bundles ✓
  GET /dashboard/alerts          → alert rules + weekend shield ✓
  GET /trust/demo                → public trust page ✓
  GET /privacy                   → no placeholders ✓
  GET /terms                     → no placeholders ✓

API VERIFICATION:
  GET  /api/health               → { status: "healthy" } ✓
  GET  /api/bundles              → 9 bundles with skills ✓
  POST /api/bundles/supply-chain-defense/activate → creates subscription ✓
  GET  /api/bundles/supply-chain-defense/test     → SSE streams ✓
  GET  /api/github/install-url   → returns GitHub URL ✓
  POST /webhooks/github          → returns 200, verifies HMAC ✓
  GET  /api/agents               → returns agent list ✓
  GET  /api/costs/summary        → returns cost data ✓
  GET  /api/memory/entries       → returns entries ✓
  GET  /api/trust/demo           → returns public data ✓
  GET  /api/badges/inst_1/security-score → returns SVG ✓

MOBILE VERIFICATION (375px viewport):
  Homepage: readable, no horizontal scroll ✓
  Bundle cards: stack to 1 column ✓
  Bundle wizard: modal fills screen ✓
  Dashboard: sidebar hidden, cards stack ✓
  Blog posts: readable without scroll ✓
  Nav: collapsed properly ✓

SECURITY VERIFICATION:
  No API keys in any .svelte file ✓
  All dashboard routes check auth session ✓
  All webhook endpoints verify HMAC signatures ✓
  Builder dashboard requires publisher role ✓
  Public trust page loads without auth ✓
  GitHub OAuth state parameter is signed JWT ✓
  IOC feed seeded with Trivy incident data ✓

PERFORMANCE VERIFICATION:
  Homepage Lighthouse score > 90 ✓
  Demo page: score animates smoothly (no jank) ✓
  Bundle wizard: SSE test stream renders in real time ✓
  OpenSyber AI: first token appears within 2 seconds ✓

CONTENT VERIFICATION:
  Blog post "trivy-supply-chain-attack" renders with TOC ✓
  Blog post "mcp-guardian-launch" renders ✓
  Blog post "ai-agent-identity-crisis" renders ✓
  Blog post "ai-agent-kill-chain" renders ✓
  All 9 bundles have test simulation steps seeded ✓
  IOC feed has Trivy incident entries ✓

If any check fails: output the specific file and line to fix.
If all checks pass:

OUTPUT:
"═══════════════════════════════════════
 🚀 OPENSYBER READY FOR LAUNCH
═══════════════════════════════════════
 ✓ 15 skills active with full flows
 ✓ 9 bundles with activation wizard
 ✓ GitHub App source integration
 ✓ MCP Guardian skill live
 ✓ NHI Manager (agent registry)
 ✓ Cost Bomb Protection
 ✓ Memory & RAG Poisoning Guard
 ✓ Skill Builder platform (70/30)
 ✓ Trust badges + viral growth
 ✓ Weekend Shield + alert engine
 ✓ OpenSyber AI (NL interface)
 ✓ Blog with 4 launch posts
 ✓ TenantIQ Copilot Security
 ✓ All 10 critical fixes applied
 ✓ Mobile responsive throughout

 NEXT ACTIONS:
 1. Post Trivy blog to Hacker News (Show HN)
 2. Tweet: 'We built the containment layer MCP forgot'
 3. Submit to Product Hunt
 4. DM the 5 security researchers who covered Trivy
 ═══════════════════════════════════════"
```

---

## PARALLEL EXECUTION MAP

```
START IMMEDIATELY (no deps):
  Agent 01 — Database (everything depends on this, run first)

AFTER AGENT 01 CONFIRMS COMPLETE:
  Agent 02 — Skill flows
  Agent 03 — Bundle wizard
  Agent 04 — GitHub App
  Agent 05 — MCP Guardian skill
  Agent 06 — NHI Manager
  Agent 07 — Cost Bomb
  Agent 08 — Memory Guard
  Agent 09 — Skill Builder
  Agent 10 — Site fixes
  Agent 11 — Blog
  Agent 12 — OpenSyber AI
  Agent 13 — Trust badges
  Agent 14 — Alert engine
  Agent 15 — TenantIQ

AFTER ALL 15 CONFIRM COMPLETE:
  Agent 16 — Merge and launch check

Total agents: 16
Wall clock time (parallel): ~2 hours
```

## ENV VARS CHECKLIST

```
# Existing (verify set)
BETTER_AUTH_SECRET=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_API_KEY=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Add for this sprint
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=          # base64-encoded PEM
GITHUB_WEBHOOK_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
STRIPE_SECRET_KEY=               # for builder payouts
STRIPE_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=               # for OpenSyber AI
```

## THE POSITIONING SENTENCE

When you launch, every message should hit this note:

> **OpenSyber is the containment layer that MCP forgot to build.**
> Security for every AI agent, from the IDE to CI/CD to production.
> Runtime monitoring. Supply chain protection. Identity governance.
> Everything your AI agents do — watched, protected, audited.

Now go ship it.
