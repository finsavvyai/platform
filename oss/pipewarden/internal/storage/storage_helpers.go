package storage

import (
	"database/sql"
	"fmt"
	"strings"
)

type rowScanner interface {
	Scan(dest ...any) error
}

func scanConnection(scanner rowScanner) (*ConnectionRecord, error) {
	var (
		rec            ConnectionRecord
		lastVerifiedAt sql.NullTime
	)
	if err := scanner.Scan(
		&rec.ID,
		&rec.Name,
		&rec.Platform,
		&rec.AuthMethod,
		&rec.Token,
		&rec.Username,
		&rec.AppPassword,
		&rec.BaseURL,
		&rec.ProviderIdentity,
		&rec.InstallationID,
		&rec.CredentialRef,
		&rec.HealthStatus,
		&lastVerifiedAt,
		&rec.CreatedAt,
		&rec.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("connection not found")
		}
		return nil, fmt.Errorf("failed to scan connection: %w", err)
	}
	if lastVerifiedAt.Valid {
		rec.LastVerifiedAt = &lastVerifiedAt.Time
	}
	return &rec, nil
}

func (s *DB) ensureColumn(table, column, ddl string) error {
	exists, err := s.columnExists(table, column)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = s.db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, ddl))
	return err
}

func (s *DB) columnExists(table, column string) (bool, error) {
	switch s.driver {
	case EnginePostgres:
		var exists bool
		err := s.db.QueryRow(
			`SELECT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
			)`, table, column,
		).Scan(&exists)
		return exists, err
	default:
		rows, err := s.db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
		if err != nil {
			return false, err
		}
		defer func() { _ = rows.Close() }()

		for rows.Next() {
			var cid, notNull, pk int
			var name, colType string
			var defVal any
			if err := rows.Scan(&cid, &name, &colType, &notNull, &defVal, &pk); err != nil {
				return false, err
			}
			if name == column {
				return true, nil
			}
		}
		return false, rows.Err()
	}
}

func (s *DB) bind(query string) string {
	if s.driver != EnginePostgres {
		return query
	}

	var b strings.Builder
	index := 1
	for _, r := range query {
		if r == '?' {
			fmt.Fprintf(&b, "$%d", index)
			index++
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func boolToDB(v bool) any {
	if v {
		return 1
	}
	return 0
}

func dbToBool(v any) bool {
	switch value := v.(type) {
	case bool:
		return value
	case int64:
		return value != 0
	case int32:
		return value != 0
	case int:
		return value != 0
	case []byte:
		return string(value) == "1" || strings.EqualFold(string(value), "true")
	default:
		return false
	}
}

func (s *DB) boolValue(v bool) any {
	if s.driver == EnginePostgres {
		return v
	}
	return boolToDB(v)
}

func (s *DB) normalizeConnection(rec *ConnectionRecord) {
	if rec.AuthMethod == "" {
		switch {
		case rec.InstallationID != 0:
			rec.AuthMethod = "github_app"
		case rec.AppPassword != "" || rec.Username != "":
			rec.AuthMethod = "basic"
		default:
			rec.AuthMethod = "token"
		}
	}
	if rec.HealthStatus == "" {
		rec.HealthStatus = "pending"
	}
}
