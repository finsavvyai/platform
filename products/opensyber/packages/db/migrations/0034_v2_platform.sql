-- V2 Platform Migration: Bundles, GitHub, NHI, Costs, MCP, Memory, Marketplace V2, Newsletter, Certs
-- Migration 0034 — Created: 2026-03-28

-- ─── Skill Bundles ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_bundles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','team','enterprise')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  skill_count INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bundle_skills (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bundle_skills_bundle ON bundle_skills(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_skills_skill ON bundle_skills(skill_id);

CREATE TABLE IF NOT EXISTS bundle_test_steps (
  id TEXT PRIMARY KEY,
  bundle_id TEXT NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  expected_result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bundle_test_steps_bundle ON bundle_test_steps(bundle_id);

CREATE TABLE IF NOT EXISTS user_bundle_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  bundle_id TEXT NOT NULL REFERENCES skill_bundles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','expired')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_bundle_subs_user ON user_bundle_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bundle_subs_bundle ON user_bundle_subscriptions(bundle_id);

CREATE TABLE IF NOT EXISTS bundle_sources (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES user_bundle_subscriptions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('github','gitlab','bitbucket','aws','gcp','azure','custom')),
  source_ref TEXT NOT NULL,
  config TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','error')),
  last_scan_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bundle_sources_sub ON bundle_sources(subscription_id);

CREATE TABLE IF NOT EXISTS bundle_alert_configs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES user_bundle_subscriptions(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','slack','discord','pagerduty','teams','opsgenie','webhook')),
  target TEXT NOT NULL,
  min_severity TEXT NOT NULL DEFAULT 'medium' CHECK (min_severity IN ('info','low','medium','high','critical')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bundle_alert_configs_sub ON bundle_alert_configs(subscription_id);

-- ─── GitHub App ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS github_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  installation_id INTEGER NOT NULL UNIQUE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('User','Organization')),
  permissions TEXT,
  events TEXT,
  repo_selection TEXT NOT NULL DEFAULT 'all' CHECK (repo_selection IN ('all','selected')),
  suspended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_github_installations_user ON github_installations(user_id);

CREATE TABLE IF NOT EXISTS github_repos (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_private INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  last_scan_at TEXT,
  finding_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','removed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_github_repos_installation ON github_repos(installation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_repos_name ON github_repos(repo_full_name);

CREATE TABLE IF NOT EXISTS action_refs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  workflow_file TEXT NOT NULL,
  action_ref TEXT NOT NULL,
  pinned_sha TEXT,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_trusted INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'unknown' CHECK (risk_level IN ('safe','low','medium','high','critical','unknown')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_action_refs_repo ON action_refs(repo_id);
CREATE INDEX IF NOT EXISTS idx_action_refs_ref ON action_refs(action_ref);

-- ─── IOC Feed ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ioc_feed (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('domain','ip','sha256','url','email')),
  value TEXT NOT NULL,
  actor TEXT,
  severity TEXT NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  incident_ref TEXT,
  source TEXT NOT NULL DEFAULT 'opensyber',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ioc_feed_type ON ioc_feed(type);
CREATE INDEX IF NOT EXISTS idx_ioc_feed_value ON ioc_feed(value);
CREATE INDEX IF NOT EXISTS idx_ioc_feed_severity ON ioc_feed(severity);

-- ─── Agent Identities (NHI) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_identities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  identity_type TEXT NOT NULL CHECK (identity_type IN ('service_account','api_key','bot','ci_runner','agent','webhook')),
  provider TEXT,
  provider_id TEXT,
  permissions TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  last_active_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','revoked','suspicious')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_identities_org ON agent_identities(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_identities_type ON agent_identities(identity_type);

CREATE TABLE IF NOT EXISTS agent_identity_events (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES agent_identities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('auth','permission_change','key_rotation','anomaly','access','revocation')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  details TEXT,
  source_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_identity_events_identity ON agent_identity_events(identity_id);
CREATE INDEX IF NOT EXISTS idx_agent_identity_events_type ON agent_identity_events(event_type);

-- ─── Cost Tracking ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_cost_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  instance_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  skill_id TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_cost_events_org ON agent_cost_events(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_events_instance ON agent_cost_events(instance_id);
CREATE INDEX IF NOT EXISTS idx_agent_cost_events_created ON agent_cost_events(created_at);

CREATE TABLE IF NOT EXISTS agent_cost_budgets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  budget_type TEXT NOT NULL CHECK (budget_type IN ('daily','weekly','monthly')),
  limit_micros INTEGER NOT NULL,
  current_micros INTEGER NOT NULL DEFAULT 0,
  kill_switch INTEGER NOT NULL DEFAULT 0,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','exceeded','paused')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_cost_budgets_org ON agent_cost_budgets(org_id);

-- ─── MCP Servers ────────────────────────────────────────────────────────────────

-- Drop legacy mcp_servers table (empty, incompatible schema) and recreate with V2 columns
DROP TABLE IF EXISTS mcp_servers;

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'stdio' CHECK (transport IN ('stdio','sse','streamable-http')),
  auth_type TEXT CHECK (auth_type IN ('none','bearer','api_key','oauth')),
  auth_config TEXT,
  tool_count INTEGER NOT NULL DEFAULT 0,
  last_health_at TEXT,
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','degraded','unhealthy','unknown')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_org ON mcp_servers(org_id);

CREATE TABLE IF NOT EXISTS mcp_server_findings (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL CHECK (finding_type IN ('excessive_permissions','data_exfil','prompt_injection','tool_shadowing','rug_pull','auth_bypass')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('info','low','medium','high','critical')),
  title TEXT NOT NULL,
  description TEXT,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','confirmed','mitigated','false_positive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_mcp_findings_server ON mcp_server_findings(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_findings_severity ON mcp_server_findings(severity);

-- ─── Memory Guard ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  instance_id TEXT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('rag_document','memory_write','context_injection','tool_output')),
  content_hash TEXT NOT NULL,
  content_preview TEXT,
  source TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  is_poisoned INTEGER NOT NULL DEFAULT 0,
  scan_result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  scanned_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_entries_org ON memory_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_hash ON memory_entries(content_hash);
CREATE INDEX IF NOT EXISTS idx_memory_entries_poisoned ON memory_entries(is_poisoned);

-- ─── Newsletter ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','unsubscribed','bounced')),
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

-- ─── Marketplace V2: Publishers & Revenue ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_publishers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  bio TEXT,
  website TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  revenue_share_pct INTEGER NOT NULL DEFAULT 70,
  payout_email TEXT,
  payout_method TEXT CHECK (payout_method IN ('stripe','paypal','wire')),
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_skill_publishers_user ON skill_publishers(user_id);

CREATE TABLE IF NOT EXISTS third_party_skills (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES skill_publishers(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  source_repo TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','in_review','approved','rejected','revoked')),
  security_scan_passed INTEGER NOT NULL DEFAULT 0,
  scan_report TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_third_party_skills_publisher ON third_party_skills(publisher_id);
CREATE INDEX IF NOT EXISTS idx_third_party_skills_skill ON third_party_skills(skill_id);

CREATE TABLE IF NOT EXISTS skill_revenue_events (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  publisher_id TEXT NOT NULL REFERENCES skill_publishers(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase','subscription','refund','chargeback')),
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  publisher_share_cents INTEGER NOT NULL DEFAULT 0,
  buyer_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_skill_revenue_skill ON skill_revenue_events(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_revenue_publisher ON skill_revenue_events(publisher_id);

CREATE TABLE IF NOT EXISTS skill_payouts (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL REFERENCES skill_publishers(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_revenue_cents INTEGER NOT NULL DEFAULT 0,
  payout_amount_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed')),
  payout_ref TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_skill_payouts_publisher ON skill_payouts(publisher_id);

-- ─── Certifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cert_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  cert_type TEXT NOT NULL CHECK (cert_type IN ('CAASD','COSA')),
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','exam_ready','passed','failed','expired')),
  progress_pct INTEGER NOT NULL DEFAULT 0,
  modules_completed TEXT,
  exam_score INTEGER,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  expires_at TEXT,
  certificate_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_cert_enrollments_user ON cert_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_enrollments_type ON cert_enrollments(cert_type);

-- ─── Seed: IOC Data ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO ioc_feed (id, type, value, actor, severity, incident_ref, source) VALUES
  ('ioc-001', 'domain', 'scan.aquasecurtiy.org', 'TeamPCP', 'CRITICAL', 'GHSA-69fq-xp46-6x23', 'opensyber'),
  ('ioc-002', 'domain', 'hackmoltrepeat.com', 'hackerbot-claw', 'CRITICAL', 'hackerbot-claw-2026', 'opensyber'),
  ('ioc-003', 'ip', '45.148.10.212', 'TeamPCP', 'CRITICAL', 'GHSA-69fq-xp46-6x23', 'opensyber'),
  ('ioc-004', 'domain', 'tpcp.tar.gz', 'TeamPCP', 'HIGH', 'teampcp-campaign-2026', 'opensyber'),
  ('ioc-005', 'domain', 'tdtqy-oyaaa-aaaae-af2dq-cai', 'TeamPCP', 'HIGH', 'GHSA-69fq-xp46-6x23', 'opensyber');

-- ─── Seed: Skill Bundles ────────────────────────────────────────────────────────

INSERT OR IGNORE INTO skill_bundles (id, slug, name, tagline, tier, price_cents, sort_order, is_active) VALUES
  ('bundle-free-starter',     'free-starter',          'Free Starter',           'Essential security scanning to get started',            'free',       0,     1, 1),
  ('bundle-supply-chain',     'supply-chain-defense',  'Supply Chain Defense',   'Protect your software supply chain end-to-end',         'pro',     2900,    2, 1),
  ('bundle-ai-agent',         'ai-agent-security',     'AI Agent Security',      'Secure AI agents, prompts, and MCP integrations',       'pro',     3900,    3, 1),
  ('bundle-compliance',       'compliance-ready',      'Compliance Ready',       'SOC 2, ISO 27001, and OASF compliance automation',      'team',    4900,    4, 1),
  ('bundle-cicd',             'cicd-hardening',        'CI/CD Hardening',        'Harden your CI/CD pipelines against attacks',            'pro',     2900,    5, 1),
  ('bundle-runtime',          'runtime-defense',       'Runtime Defense',        'Real-time agent monitoring and threat detection',        'pro',     3900,    6, 1),
  ('bundle-infra',            'infrastructure-security','Infrastructure Security','Cloud infrastructure posture and drift detection',      'team',    4900,    7, 1),
  ('bundle-alert',            'alert-response',        'Alert Response',         'Intelligent alerting and automated incident response',   'pro',     1900,    8, 1),
  ('bundle-everything',       'everything-bundle',     'Everything Bundle',      'All security capabilities in one subscription',          'enterprise', 9900, 9, 1);
