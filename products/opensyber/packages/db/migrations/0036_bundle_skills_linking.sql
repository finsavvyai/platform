-- Link bundles to their skills
-- Each bundle groups related security skills for discounted purchase

-- Free Starter: Secret Scanner, Git Guardian, Dependency Auditor
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-free-01', 'bundle-free-starter', 'sk_secret_scanner', 1),
  ('bs-free-02', 'bundle-free-starter', 'sk_git_guardian',   2),
  ('bs-free-03', 'bundle-free-starter', 'sk_dep_audit',      3);

-- Supply Chain Defense: Supply Chain Guard, Transitive Action Scanner, Dependency Auditor, IDE Extension Guardian
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-sc-01', 'bundle-supply-chain', 'sk_supply_chain',     1),
  ('bs-sc-02', 'bundle-supply-chain', 'sk_transitive_scan',  2),
  ('bs-sc-03', 'bundle-supply-chain', 'sk_dep_audit',        3),
  ('bs-sc-04', 'bundle-supply-chain', 'sk_ide_guard',        4);

-- AI Agent Security: AI Prompt Guard, Agent Instruction Guardian, Cursor Monitor, Session Integrity
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-ai-01', 'bundle-ai-agent', 'sk_prompt_guard',       1),
  ('bs-ai-02', 'bundle-ai-agent', 'sk_instruction_guard',  2),
  ('bs-ai-03', 'bundle-ai-agent', 'sk_cursor_monitor',     3),
  ('bs-ai-04', 'bundle-ai-agent', 'sk_session_integrity',  4);

-- Compliance Ready: Compliance Reporter, Secret Scanner, IaC Scanner, SIEM Forwarder
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-comp-01', 'bundle-compliance', 'sk_compliance_report', 1),
  ('bs-comp-02', 'bundle-compliance', 'sk_secret_scanner',    2),
  ('bs-comp-03', 'bundle-compliance', 'sk_iac_scanner',       3),
  ('bs-comp-04', 'bundle-compliance', 'sk_siem_forwarder',    4);

-- CI/CD Hardening: Workflow Trigger Auditor, Workflow Permissions Auditor, Supply Chain Guard, Git Guardian
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-cicd-01', 'bundle-cicd', 'sk_trigger_audit',  1),
  ('bs-cicd-02', 'bundle-cicd', 'sk_perms_audit',    2),
  ('bs-cicd-03', 'bundle-cicd', 'sk_supply_chain',   3),
  ('bs-cicd-04', 'bundle-cicd', 'sk_git_guardian',    4);

-- Runtime Defense: Network Sentinel, Container Hardening, Log Analyzer, Secret Vault Bridge
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-rt-01', 'bundle-runtime', 'sk_network_monitor',  1),
  ('bs-rt-02', 'bundle-runtime', 'sk_container_scan',   2),
  ('bs-rt-03', 'bundle-runtime', 'sk_log_analyzer',     3),
  ('bs-rt-04', 'bundle-runtime', 'sk_vault_bridge',     4);

-- Infrastructure Security: IaC Scanner, OIDC Trust Monitor, Container Hardening, Network Sentinel
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-infra-01', 'bundle-infra', 'sk_iac_scanner',     1),
  ('bs-infra-02', 'bundle-infra', 'sk_oidc_monitor',    2),
  ('bs-infra-03', 'bundle-infra', 'sk_container_scan',  3),
  ('bs-infra-04', 'bundle-infra', 'sk_network_monitor', 4);

-- Alert Response: Slack Security Alerts, PagerDuty Escalation, SIEM Forwarder
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-alert-01', 'bundle-alert', 'sk_slack_alerts',    1),
  ('bs-alert-02', 'bundle-alert', 'sk_pagerduty',       2),
  ('bs-alert-03', 'bundle-alert', 'sk_siem_forwarder',  3);

-- Everything Bundle: all 24 skills
INSERT OR IGNORE INTO bundle_skills (id, bundle_id, skill_id, sort_order) VALUES
  ('bs-all-01', 'bundle-everything', 'sk_secret_scanner',      1),
  ('bs-all-02', 'bundle-everything', 'sk_dep_audit',           2),
  ('bs-all-03', 'bundle-everything', 'sk_container_scan',      3),
  ('bs-all-04', 'bundle-everything', 'sk_network_monitor',     4),
  ('bs-all-05', 'bundle-everything', 'sk_iac_scanner',         5),
  ('bs-all-06', 'bundle-everything', 'sk_supply_chain',        6),
  ('bs-all-07', 'bundle-everything', 'sk_git_guardian',        7),
  ('bs-all-08', 'bundle-everything', 'sk_api_fuzzer',          8),
  ('bs-all-09', 'bundle-everything', 'sk_log_analyzer',        9),
  ('bs-all-10', 'bundle-everything', 'sk_slack_alerts',       10),
  ('bs-all-11', 'bundle-everything', 'sk_pagerduty',          11),
  ('bs-all-12', 'bundle-everything', 'sk_compliance_report',  12),
  ('bs-all-13', 'bundle-everything', 'sk_prompt_guard',       13),
  ('bs-all-14', 'bundle-everything', 'sk_trigger_audit',      14),
  ('bs-all-15', 'bundle-everything', 'sk_perms_audit',        15),
  ('bs-all-16', 'bundle-everything', 'sk_transitive_scan',    16),
  ('bs-all-17', 'bundle-everything', 'sk_instruction_guard',  17),
  ('bs-all-18', 'bundle-everything', 'sk_ide_guard',          18),
  ('bs-all-19', 'bundle-everything', 'sk_oidc_monitor',       19),
  ('bs-all-20', 'bundle-everything', 'sk_cursor_monitor',     20),
  ('bs-all-21', 'bundle-everything', 'sk_vault_bridge',       21),
  ('bs-all-22', 'bundle-everything', 'sk_siem_forwarder',     22),
  ('bs-all-23', 'bundle-everything', 'sk_session_integrity',  23);

-- Update skill_count on each bundle to match actual linked skills
UPDATE skill_bundles SET skill_count = 3  WHERE id = 'bundle-free-starter';
UPDATE skill_bundles SET skill_count = 4  WHERE id = 'bundle-supply-chain';
UPDATE skill_bundles SET skill_count = 4  WHERE id = 'bundle-ai-agent';
UPDATE skill_bundles SET skill_count = 4  WHERE id = 'bundle-compliance';
UPDATE skill_bundles SET skill_count = 4  WHERE id = 'bundle-cicd';
UPDATE skill_bundles SET skill_count = 4  WHERE id = 'bundle-runtime';
UPDATE skill_bundles SET skill_count = 4  WHERE id = 'bundle-infra';
UPDATE skill_bundles SET skill_count = 3  WHERE id = 'bundle-alert';
UPDATE skill_bundles SET skill_count = 23 WHERE id = 'bundle-everything';
