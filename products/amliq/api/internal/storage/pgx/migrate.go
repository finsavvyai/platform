package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
)

type Migrator struct {
	db *sql.DB
	fs fs.FS
}

func NewMigrator(db *sql.DB, fsys fs.FS) *Migrator {
	return &Migrator{db: db, fs: fsys}
}

func (m *Migrator) Up(ctx context.Context) error {
	if err := m.ensureMigrationsTable(ctx); err != nil {
		return err
	}

	files, err := fs.Glob(m.fs, "migrations/*.up.sql")
	if err != nil {
		return fmt.Errorf("glob migrations: %w", err)
	}
	sort.Strings(files)

	for _, f := range files {
		if err := m.applyMigration(ctx, f); err != nil {
			return err
		}
	}
	return nil
}

func (m *Migrator) ensureMigrationsTable(ctx context.Context) error {
	_, err := m.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS migrations_applied (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return err
	}
	_, err = m.db.ExecContext(ctx,
		`ALTER TABLE migrations_applied ALTER COLUMN version TYPE VARCHAR(255)`)
	return err
}

func (m *Migrator) applyMigration(ctx context.Context, file string) error {
	version := filepath.Base(file)
	version = strings.TrimSuffix(version, ".up.sql")

	var applied bool
	err := m.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM migrations_applied WHERE version = $1)",
		version).Scan(&applied)
	if err != nil {
		return fmt.Errorf("check migration: %w", err)
	}
	if applied {
		return nil
	}

	sql, err := fs.ReadFile(m.fs, file)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", file, err)
	}

	_, err = m.db.ExecContext(ctx, string(sql))
	if err != nil {
		return fmt.Errorf("execute migration %s: %w", version, err)
	}

	_, err = m.db.ExecContext(ctx,
		"INSERT INTO migrations_applied (version) VALUES ($1)", version)
	return err
}
