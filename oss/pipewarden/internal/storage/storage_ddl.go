package storage

import "fmt"

func (s *DB) timestampType() string {
	if s.driver == EnginePostgres {
		return "TIMESTAMPTZ"
	}
	return "DATETIME"
}

// dialect captures per-engine DDL substitutions used across schema files.
type dialect struct {
	idType, nowExpr, boolType, tsType, blobType string
}

func (s *DB) dialect() dialect {
	d := dialect{idType: "INTEGER PRIMARY KEY AUTOINCREMENT", nowExpr: "CURRENT_TIMESTAMP", boolType: "INTEGER", blobType: "BLOB"}
	if s.driver == EnginePostgres {
		d.idType = "BIGSERIAL PRIMARY KEY"
		d.nowExpr = "NOW()"
		d.boolType = "BOOLEAN"
		d.blobType = "BYTEA"
	}
	d.tsType = s.timestampType()
	return d
}

// schemaStatements returns the ordered DDL for all PipeWarden tables.
// Split across storage_ddl.go (core) and storage_ddl_ops.go (ops/admin).
func (s *DB) schemaStatements() []string {
	d := s.dialect()
	out := coreSchema(d)
	return append(out, opsSchema(d)...)
}

// coreSchema defines product-data tables: connections, findings, history,
// OAuth, subscriptions.
func coreSchema(d dialect) []string {
	return []string{
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS connections (
	id                %s,
	name              TEXT NOT NULL UNIQUE,
	platform          TEXT NOT NULL,
	auth_method       TEXT NOT NULL DEFAULT 'token',
	token             TEXT NOT NULL DEFAULT '',
	username          TEXT NOT NULL DEFAULT '',
	app_password      TEXT NOT NULL DEFAULT '',
	base_url          TEXT NOT NULL DEFAULT '',
	provider_identity TEXT NOT NULL DEFAULT '',
	installation_id   BIGINT NOT NULL DEFAULT 0,
	credential_ref    TEXT NOT NULL DEFAULT '',
	health_status     TEXT NOT NULL DEFAULT 'pending',
	last_verified_at  %s,
	created_at        %s NOT NULL DEFAULT %s,
	updated_at        %s NOT NULL DEFAULT %s
)`, d.idType, d.tsType, d.tsType, d.nowExpr, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_connections_platform ON connections(platform)`,
		`CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS security_findings (
	id              %s,
	connection_name TEXT NOT NULL,
	run_id          TEXT NOT NULL,
	severity        TEXT NOT NULL,
	category        TEXT NOT NULL,
	title           TEXT NOT NULL,
	description     TEXT NOT NULL,
	remediation     TEXT NOT NULL DEFAULT '',
	file            TEXT NOT NULL DEFAULT '',
	line            INTEGER NOT NULL DEFAULT 0,
	confidence      REAL NOT NULL DEFAULT 0.0,
	false_positive       %s NOT NULL DEFAULT 0,
	status               TEXT NOT NULL DEFAULT 'open',
	suppression_reason   TEXT NOT NULL DEFAULT '',
	suppression_note     TEXT NOT NULL DEFAULT '',
	created_at           %s NOT NULL DEFAULT %s
)`, d.idType, d.boolType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_findings_connection ON security_findings(connection_name)`,
		`CREATE INDEX IF NOT EXISTS idx_findings_run ON security_findings(run_id)`,
		`CREATE INDEX IF NOT EXISTS idx_findings_severity ON security_findings(severity)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS analysis_history (
	id              %s,
	connection_name TEXT NOT NULL,
	run_id          TEXT NOT NULL,
	summary         TEXT NOT NULL,
	risk_score      INTEGER NOT NULL DEFAULT 0,
	findings_count  INTEGER NOT NULL DEFAULT 0,
	tokens_used     INTEGER NOT NULL DEFAULT 0,
	model           TEXT NOT NULL,
	duration_ms     BIGINT NOT NULL DEFAULT 0,
	analyzed_at     %s NOT NULL DEFAULT %s
)`, d.idType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_history_connection ON analysis_history(connection_name)`,
		`CREATE INDEX IF NOT EXISTS idx_history_run ON analysis_history(run_id)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS oauth_states (
	state      TEXT PRIMARY KEY,
	provider   TEXT NOT NULL,
	expires_at %s NOT NULL,
	created_at %s NOT NULL DEFAULT %s
)`, d.tsType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_states(provider)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS users (
	id              %s,
	email           TEXT NOT NULL UNIQUE,
	password_hash   TEXT NOT NULL DEFAULT '',
	name            TEXT NOT NULL DEFAULT '',
	company         TEXT NOT NULL DEFAULT '',
	onboarded       %s NOT NULL DEFAULT 0,
	github_id       BIGINT NOT NULL DEFAULT 0,
	email_verified  %s NOT NULL DEFAULT 0,
	totp_secret     TEXT NOT NULL DEFAULT '',
	totp_enabled    %s NOT NULL DEFAULT 0,
	password_version BIGINT NOT NULL DEFAULT 1,
	created_at      %s NOT NULL DEFAULT %s,
	updated_at      %s NOT NULL DEFAULT %s
)`, d.idType, d.boolType, d.boolType, d.boolType, d.tsType, d.nowExpr, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS passkey_credentials (
	id              %s,
	user_id         BIGINT NOT NULL,
	credential_id   %s NOT NULL UNIQUE,
	public_key      %s NOT NULL,
	sign_count      BIGINT NOT NULL DEFAULT 0,
	transports      TEXT NOT NULL DEFAULT '',
	name            TEXT NOT NULL DEFAULT '',
	created_at      %s NOT NULL DEFAULT %s
)`, d.idType, d.blobType, d.blobType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS recovery_codes (
	id          %s,
	user_id     BIGINT NOT NULL,
	code_hash   TEXT NOT NULL,
	used_at     %s,
	created_at  %s NOT NULL DEFAULT %s
)`, d.idType, d.tsType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_codes(user_id)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS auth_tokens (
	token       TEXT PRIMARY KEY,
	user_id     BIGINT NOT NULL,
	purpose     TEXT NOT NULL,
	expires_at  %s NOT NULL,
	used_at     %s,
	created_at  %s NOT NULL DEFAULT %s
)`, d.tsType, d.tsType, d.tsType, d.nowExpr),
		`CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id)`,
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS passkey_challenges (
	session_id   TEXT PRIMARY KEY,
	user_id      BIGINT NOT NULL DEFAULT 0,
	session_data TEXT NOT NULL,
	purpose      TEXT NOT NULL,
	expires_at   %s NOT NULL,
	created_at   %s NOT NULL DEFAULT %s
)`, d.tsType, d.tsType, d.nowExpr),
		fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS subscriptions (
	tenant_id        TEXT PRIMARY KEY,
	tier             TEXT NOT NULL,
	status           TEXT NOT NULL,
	subscription_id  TEXT NOT NULL DEFAULT '',
	customer_id      TEXT NOT NULL DEFAULT '',
	renews_at        %s,
	cancelled_at     %s,
	created_at       %s NOT NULL DEFAULT %s,
	updated_at       %s NOT NULL DEFAULT %s
)`, d.tsType, d.tsType, d.tsType, d.nowExpr, d.tsType, d.nowExpr),
	}
}
