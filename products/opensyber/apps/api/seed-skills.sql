PRAGMA foreign_keys = OFF;

INSERT OR IGNORE INTO skills (id, slug, name, description, category, author_id, current_version, verification_status, verified_at, install_count, rating_avg, rating_count, tier, created_at, is_featured, publisher_id)
VALUES
  ('sk-001', 'global-remit-security', 'Global Remit Security', 'Monitors AI agent access to payment APIs, PCI-DSS sensitive data, and cross-border transaction endpoints.', 'finance', 'system', '1.0.0', 'approved', '2026-03-17T00:00:00Z', 234, 4.7, 42, 'pro', '2026-03-01T00:00:00Z', 0, 'system'),
  ('sk-002', 'secret-scanner', 'Secret Scanner', 'Detects AWS keys, GitHub tokens, API secrets, and private keys in files accessed by AI agents.', 'security', 'system', '2.1.0', 'approved', '2026-02-01T00:00:00Z', 2847, 4.8, 312, 'free', '2026-01-15T00:00:00Z', 1, 'system'),
  ('sk-003', 'docker-hardener', 'Docker Hardener', 'Audits container configs for security misconfigurations.', 'security', 'system', '1.4.2', 'approved', '2026-02-15T00:00:00Z', 1923, 4.6, 198, 'free', '2026-01-20T00:00:00Z', 0, 'system'),
  ('sk-004', 'ai-code-reviewer', 'AI Code Reviewer', 'Analyzes code changes by AI agents for security vulnerabilities and unsafe patterns.', 'developer', 'system', '3.0.1', 'approved', '2026-01-10T00:00:00Z', 4512, 4.9, 567, 'free', '2025-12-01T00:00:00Z', 1, 'system'),
  ('sk-005', 'slack-notifier', 'Slack Notifier', 'Real-time Slack alerts when AI agents access critical files or trigger policy violations.', 'communication', 'system', '2.0.3', 'approved', '2026-02-10T00:00:00Z', 3201, 4.7, 289, 'free', '2026-01-05T00:00:00Z', 1, 'system'),
  ('sk-006', 'cve-auto-patcher', 'CVE Auto-Patcher', 'Monitors dependencies for known CVEs and suggests safe version upgrades.', 'developer', 'system', '1.2.0', 'approved', '2026-03-01T00:00:00Z', 1456, 4.5, 142, 'pro', '2026-02-15T00:00:00Z', 0, 'system'),
  ('sk-007', 'api-monitor', 'API Monitor', 'Monitors outbound API calls from AI agents. Detects data exfiltration.', 'security', 'system', '1.5.1', 'approved', '2026-02-20T00:00:00Z', 1834, 4.6, 176, 'pro', '2026-02-01T00:00:00Z', 0, 'system'),
  ('sk-008', 'jira-sync', 'Jira Sync', 'Auto-creates Jira tickets from security findings detected by OpenSyber.', 'productivity', 'system', '1.0.2', 'approved', '2026-03-05T00:00:00Z', 1123, 4.2, 98, 'free', '2026-02-20T00:00:00Z', 0, 'system');

PRAGMA foreign_keys = ON;
