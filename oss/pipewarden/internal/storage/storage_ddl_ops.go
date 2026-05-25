package storage

import "fmt"

// opsSchema defines ops/admin tables: scheduling, API keys, webhooks,
// audit log, notifications, custom policies, secret lifecycle, semgrep rules.
func opsSchema(d dialect) []string {
	return []string{
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS scan_schedules (
	connection_name TEXT PRIMARY KEY,
	cron_expr       TEXT NOT NULL,
	enabled         %s NOT NULL DEFAULT TRUE,
	notify_on       TEXT NOT NULL DEFAULT 'all',
	last_run_at     %s,
	next_run_at     %s,
	created_at      %s NOT NULL DEFAULT %s
)`, d.boolType, d.tsType, d.tsType, d.tsType, d.nowExpr),
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS api_keys (
	connection_name TEXT PRIMARY KEY,
	key_hash        TEXT NOT NULL UNIQUE,
	created_at      %s NOT NULL DEFAULT %s
)`, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS webhook_configs (
	name             TEXT PRIMARY KEY,
	url              TEXT NOT NULL,
	secret           TEXT NOT NULL DEFAULT '',
	events_json      TEXT NOT NULL DEFAULT '[]',
	enabled          %s NOT NULL DEFAULT 0,
	last_tested_at   %s,
	last_status_code INTEGER NOT NULL DEFAULT 0,
	last_error       TEXT NOT NULL DEFAULT '',
	created_at       %s NOT NULL DEFAULT %s,
	updated_at       %s NOT NULL DEFAULT %s
)`, d.boolType, d.tsType, d.tsType, d.nowExpr, d.tsType, d.nowExpr),
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS audit_log (
	id            %s,
	action        TEXT NOT NULL,
	actor         TEXT NOT NULL,
	resource      TEXT NOT NULL,
	resource_type TEXT NOT NULL,
	details       TEXT,
	created_at    %s NOT NULL DEFAULT %s
)`, d.idType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS notifications (
	id              %s,
	type            TEXT NOT NULL,
	title           TEXT NOT NULL,
	body            TEXT NOT NULL,
	connection_name TEXT NOT NULL DEFAULT '',
	read            %s NOT NULL DEFAULT 0,
	created_at      %s NOT NULL DEFAULT %s
)`, d.idType, d.boolType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS custom_policies (
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	enabled     %s NOT NULL DEFAULT 1,
	severity    TEXT NOT NULL DEFAULT 'high',
	pattern     TEXT NOT NULL,
	message     TEXT NOT NULL,
	category    TEXT NOT NULL DEFAULT 'policy',
	is_builtin  %s NOT NULL DEFAULT 0,
	created_at  %s NOT NULL DEFAULT %s
)`, d.boolType, d.boolType, d.tsType, d.nowExpr),
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS webhook_templates (
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	destination TEXT NOT NULL,
	template    TEXT NOT NULL,
	is_default  %s NOT NULL DEFAULT 0,
	created_at  %s NOT NULL DEFAULT %s
)`, d.boolType, d.tsType, d.nowExpr),
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS secret_lifecycle (
	id             %s,
	finding_id     INTEGER NOT NULL,
	pattern_name   TEXT NOT NULL,
	redacted_value TEXT NOT NULL,
	status         TEXT NOT NULL DEFAULT 'active',
	first_seen_at  %s NOT NULL DEFAULT %s,
	last_seen_at   %s NOT NULL DEFAULT %s,
	revoked_at     %s,
	notes          TEXT,
	FOREIGN KEY(finding_id) REFERENCES security_findings(id)
)`, d.idType, d.tsType, d.nowExpr, d.tsType, d.nowExpr, d.tsType),
		`CREATE INDEX IF NOT EXISTS idx_secret_lifecycle_finding ON secret_lifecycle(finding_id)`,
		`CREATE INDEX IF NOT EXISTS idx_secret_lifecycle_status ON secret_lifecycle(status)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS semgrep_rules (
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	pattern     TEXT NOT NULL,
	language    TEXT NOT NULL DEFAULT 'yaml',
	severity    TEXT NOT NULL DEFAULT 'WARNING',
	message     TEXT NOT NULL,
	enabled     %s NOT NULL DEFAULT 1,
	created_at  %s NOT NULL DEFAULT %s
)`, d.boolType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_semgrep_rules_enabled ON semgrep_rules(enabled)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS waitlist_signups (
	id         %s,
	email      TEXT NOT NULL,
	tier       TEXT NOT NULL DEFAULT 'starter',
	company    TEXT NOT NULL DEFAULT '',
	source     TEXT NOT NULL DEFAULT '',
	created_at %s NOT NULL DEFAULT %s
)`, d.idType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_signups(email)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_tier ON waitlist_signups(tier)`,
	}
}
