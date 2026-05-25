-- Backfill migration part 2: remaining Drizzle-only tables.
-- Companion to 0015_backfill_drizzle_tables.sql.
--
-- These tables are defined only in packages/db/src/schema-d1.ts and reached
-- production via drizzle-kit but never got migration files. `IF NOT EXISTS`
-- makes this safe on production (no-op there) and idempotent on local re-runs.
--
-- After this migration, every table referenced by application code at runtime
-- has a proper migration. New schema additions must ship with their own
-- migration; do not rely on drizzle-kit push.

-- ============================================================
-- Drift suppression rules
-- ============================================================
CREATE TABLE IF NOT EXISTS drift_suppression_rules (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	category TEXT NOT NULL,
	path_pattern TEXT NOT NULL,
	reason TEXT,
	created_by TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drift_suppression_tenant ON drift_suppression_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drift_suppression_org ON drift_suppression_rules(org_id);

-- ============================================================
-- TokenForge — device bindings, config, events
-- ============================================================
CREATE TABLE IF NOT EXISTS tokenforge_device_bindings (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	device_fingerprint TEXT NOT NULL,
	device_name TEXT,
	public_key_hash TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	last_verified_at INTEGER,
	expires_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tf_bindings_org ON tokenforge_device_bindings(org_id);
CREATE INDEX IF NOT EXISTS idx_tf_bindings_tenant ON tokenforge_device_bindings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_bindings_user ON tokenforge_device_bindings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_bindings_device
	ON tokenforge_device_bindings(tenant_id, user_id, device_fingerprint);

CREATE TABLE IF NOT EXISTS tokenforge_config (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 0,
	enforce_mode TEXT NOT NULL DEFAULT 'monitor',
	max_devices_per_user INTEGER NOT NULL DEFAULT 5,
	binding_ttl_days INTEGER NOT NULL DEFAULT 90,
	auto_revoke_on_risk INTEGER NOT NULL DEFAULT 1,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_config_tenant ON tokenforge_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_config_org ON tokenforge_config(org_id);

CREATE TABLE IF NOT EXISTS tokenforge_events (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	user_id TEXT,
	event_type TEXT NOT NULL,
	device_fingerprint TEXT,
	metadata TEXT,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tf_events_tenant ON tokenforge_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tf_events_type ON tokenforge_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tf_events_created ON tokenforge_events(created_at);

-- ============================================================
-- Remediation log — auto-fix attempts + rollback state
-- ============================================================
CREATE TABLE IF NOT EXISTS remediation_log (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	actor TEXT NOT NULL,
	action_type TEXT NOT NULL,
	target_resource TEXT,
	before_state TEXT,
	after_state TEXT,
	status TEXT NOT NULL DEFAULT 'pending',
	error_message TEXT,
	executed_at INTEGER NOT NULL,
	completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_remediation_tenant ON remediation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_status ON remediation_log(status);
CREATE INDEX IF NOT EXISTS idx_remediation_executed ON remediation_log(executed_at);

-- ============================================================
-- Tenant audit log — tenant-scoped actor/action trail
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_audit_log (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	actor TEXT NOT NULL,
	action TEXT NOT NULL,
	resource_type TEXT,
	resource_id TEXT,
	details TEXT,
	ip_address TEXT,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant ON tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_action ON tenant_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_created ON tenant_audit_log(created_at);

-- ============================================================
-- Workflows + runs
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	name TEXT NOT NULL,
	type TEXT NOT NULL,
	schedule TEXT,
	enabled INTEGER DEFAULT 1,
	parameters TEXT,
	conditions TEXT,
	created_at INTEGER NOT NULL,
	created_by TEXT,
	updated_at INTEGER,
	last_executed_at INTEGER,
	next_execution_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
	id TEXT PRIMARY KEY,
	workflow_id TEXT NOT NULL,
	tenant_id TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'queued',
	started_at INTEGER,
	completed_at INTEGER,
	result TEXT,
	error TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);

-- ============================================================
-- Alerts — operational alert pipeline
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	type TEXT NOT NULL,
	severity TEXT NOT NULL,
	title TEXT NOT NULL,
	description TEXT,
	source TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	created_at TEXT,
	updated_at TEXT,
	resolved_at TEXT,
	resolved_by TEXT,
	resolution_notes TEXT,
	estimated_cost_impact REAL,
	estimated_risk_score INTEGER,
	affected_users TEXT,
	resource_id TEXT,
	resource_type TEXT,
	metadata TEXT,
	recommendations TEXT,
	can_auto_remediate INTEGER DEFAULT 0,
	auto_remediation_action TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status ON alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- ============================================================
-- AI conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	user_id TEXT,
	title TEXT,
	messages TEXT NOT NULL DEFAULT '[]',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant ON ai_conversations(tenant_id);

-- ============================================================
-- OpenSyber outbound integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS tf_opensyber_integrations (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	opensyber_url TEXT NOT NULL,
	secret_encrypted TEXT NOT NULL,
	connection_name TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tf_opensyber_org ON tf_opensyber_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_tf_opensyber_status ON tf_opensyber_integrations(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tf_opensyber_org_conn
	ON tf_opensyber_integrations(org_id, connection_name);
