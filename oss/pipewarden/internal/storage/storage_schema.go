package storage

import (
	"fmt"
	"net/url"
	"strings"
)

func resolveDriver(driver, rawURL, host string) Engine {
	switch strings.ToLower(driver) {
	case "postgres", "postgresql", "pgx":
		return EnginePostgres
	case "sqlite", "sqlite3", "":
		if rawURL != "" || host != "" {
			return EnginePostgres
		}
		return EngineSQLite
	default:
		return EngineSQLite
	}
}

func buildDSN(driver Engine, cfg Config) (string, string, error) {
	switch driver {
	case EnginePostgres:
		if cfg.URL != "" {
			return cfg.URL, "pgx", nil
		}
		sslMode := cfg.SSLMode
		if sslMode == "" {
			sslMode = "disable"
		}
		port := cfg.Port
		if port == 0 {
			port = 5432
		}
		if cfg.Host == "" || cfg.Username == "" || cfg.Name == "" {
			return "", "", fmt.Errorf("postgres configuration requires host, username, and name")
		}
		values := url.Values{}
		values.Set("sslmode", sslMode)
		dsn := fmt.Sprintf(
			"postgres://%s:%s@%s:%d/%s?%s",
			url.QueryEscape(cfg.Username),
			url.QueryEscape(cfg.Password),
			cfg.Host,
			port,
			cfg.Name,
			values.Encode(),
		)
		return dsn, "pgx", nil
	default:
		path := cfg.Path
		if path == "" {
			path = "pipewarden.db"
		}
		if path == ":memory:" || strings.Contains(path, "mode=memory") {
			return path, "sqlite3", nil
		}
		if !cfg.WALMode {
			return path, "sqlite3", nil
		}
		if strings.Contains(path, "?") {
			return path + "&_journal_mode=WAL", "sqlite3", nil
		}
		return path + "?_journal_mode=WAL", "sqlite3", nil
	}
}

func (s *DB) migrate() error {
	statements := s.schemaStatements()
	for _, stmt := range statements {
		if strings.TrimSpace(stmt) == "" {
			continue
		}
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}

	type columnSpec struct {
		name string
		ddl  string
	}

	for _, spec := range []columnSpec{
		{name: "auth_method", ddl: "TEXT NOT NULL DEFAULT 'token'"},
		{name: "provider_identity", ddl: "TEXT NOT NULL DEFAULT ''"},
		{name: "installation_id", ddl: "BIGINT NOT NULL DEFAULT 0"},
		{name: "credential_ref", ddl: "TEXT NOT NULL DEFAULT ''"},
		{name: "health_status", ddl: "TEXT NOT NULL DEFAULT 'pending'"},
		{name: "last_verified_at", ddl: s.timestampType()},
	} {
		if err := s.ensureColumn("connections", spec.name, spec.ddl); err != nil {
			return err
		}
	}

	// Suppression columns added to security_findings
	for _, spec := range []columnSpec{
		{name: "suppression_reason", ddl: "TEXT NOT NULL DEFAULT ''"},
		{name: "suppression_note", ddl: "TEXT NOT NULL DEFAULT ''"},
	} {
		if err := s.ensureColumn("security_findings", spec.name, spec.ddl); err != nil {
			return err
		}
	}

	return nil
}
