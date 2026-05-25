package migrations

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// Migration represents a single database migration
type Migration struct {
	Version     int
	Name        string
	SQL         string
	Hash        string
	AppliedAt   *time.Time
	Description string
}

// MigrationManager handles database migrations
type MigrationManager struct {
	pool         *pgxpool.Pool
	logger       *logrus.Logger
	migrations   []Migration
	migrationDir string
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(pool *pgxpool.Pool, logger *logrus.Logger, migrationDir string) *MigrationManager {
	return &MigrationManager{
		pool:         pool,
		logger:       logger,
		migrationDir: migrationDir,
		migrations:   make([]Migration, 0),
	}
}

// LoadMigrations loads migrations from the migration directory
func (m *MigrationManager) LoadMigrations() error {
	// Create migrations table if it doesn't exist
	if err := m.createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Load migration files from filesystem
	entries, err := fs.ReadDir(embeddedMigrations, ".")
	if err != nil {
		return fmt.Errorf("failed to read migration directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()
		if !strings.HasSuffix(filename, ".sql") {
			continue
		}

		// Parse version from filename (e.g., "001_create_tenants.sql")
		parts := strings.Split(strings.TrimSuffix(filename, ".sql"), "_")
		if len(parts) < 2 {
			continue
		}

		version, err := strconv.Atoi(parts[0])
		if err != nil {
			m.logger.Warnf("Invalid migration version in filename: %s", filename)
			continue
		}

		name := strings.Join(parts[1:], "_")

		// Read migration file content
		content, err := fs.ReadFile(embeddedMigrations, filename)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", filename, err)
		}

		sql := string(content)
		if sql == "" {
			m.logger.Warnf("Empty migration file: %s", filename)
			continue
		}

		migration := Migration{
			Version:     version,
			Name:        name,
			SQL:         sql,
			Description: extractDescription(sql),
			Hash:        calculateHash(sql),
		}

		m.migrations = append(m.migrations, migration)
		m.logger.WithFields(logrus.Fields{
			"version":     version,
			"name":        name,
			"description": migration.Description,
		}).Debug("Loaded migration")
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	m.logger.Infof("Loaded %d migrations", len(m.migrations))
	return nil
}

// createMigrationsTable creates the migrations tracking table
func (m *MigrationManager) createMigrationsTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			hash VARCHAR(64) NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
		ON schema_migrations(applied_at);
	`

	_, err := m.pool.Exec(context.Background(), query)
	return err
}

// GetAppliedMigrations retrieves the list of applied migrations
func (m *MigrationManager) GetAppliedMigrations() (map[int]Migration, error) {
	query := `
		SELECT version, name, description, hash, applied_at
		FROM schema_migrations
		ORDER BY version
	`

	rows, err := m.pool.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[int]Migration)
	for rows.Next() {
		var migration Migration
		var appliedAt time.Time

		err := rows.Scan(
			&migration.Version,
			&migration.Name,
			&migration.Description,
			&migration.Hash,
			&appliedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan migration row: %w", err)
		}

		migration.AppliedAt = &appliedAt
		applied[migration.Version] = migration
	}

	return applied, nil
}

// PendingMigrations returns the list of pending migrations
func (m *MigrationManager) PendingMigrations() ([]Migration, error) {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return nil, err
	}

	var pending []Migration
	for _, migration := range m.migrations {
		if _, exists := applied[migration.Version]; !exists {
			pending = append(pending, migration)
		}
	}

	return pending, nil
}

// Up applies all pending migrations
func (m *MigrationManager) Up() error {
	pending, err := m.PendingMigrations()
	if err != nil {
		return fmt.Errorf("failed to get pending migrations: %w", err)
	}

	if len(pending) == 0 {
		m.logger.Info("No pending migrations")
		return nil
	}

	m.logger.Infof("Applying %d pending migrations", len(pending))

	for _, migration := range pending {
		if err := m.applyMigration(migration); err != nil {
			return fmt.Errorf("failed to apply migration %d (%s): %w",
				migration.Version, migration.Name, err)
		}
	}

	m.logger.Info("All pending migrations applied successfully")
	return nil
}

// applyMigration applies a single migration
func (m *MigrationManager) applyMigration(migration Migration) error {
	m.logger.WithFields(logrus.Fields{
		"version":     migration.Version,
		"name":        migration.Name,
		"description": migration.Description,
	}).Info("Applying migration")

	ctx := context.Background()

	// Start transaction
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Execute migration SQL
	_, err = tx.Exec(ctx, migration.SQL)
	if err != nil {
		return fmt.Errorf("failed to execute migration SQL: %w", err)
	}

	// Record migration as applied
	insertQuery := `
		INSERT INTO schema_migrations (version, name, description, hash, applied_at)
		VALUES ($1, $2, $3, $4, NOW())
	`

	_, err = tx.Exec(ctx, insertQuery,
		migration.Version,
		migration.Name,
		migration.Description,
		migration.Hash,
	)
	if err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit migration: %w", err)
	}

	m.logger.WithFields(logrus.Fields{
		"version": migration.Version,
		"name":    migration.Name,
	}).Info("Migration applied successfully")

	return nil
}

// Down rolls back the last n migrations
func (m *MigrationManager) Down(steps int) error {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Sort applied migrations by version in descending order
	var appliedMigrations []Migration
	for _, migration := range applied {
		appliedMigrations = append(appliedMigrations, migration)
	}
	sort.Slice(appliedMigrations, func(i, j int) bool {
		return appliedMigrations[i].Version > appliedMigrations[j].Version
	})

	if steps > len(appliedMigrations) {
		steps = len(appliedMigrations)
	}

	if steps == 0 {
		m.logger.Info("No migrations to rollback")
		return nil
	}

	m.logger.Infof("Rolling back %d migrations", steps)

	for i := 0; i < steps; i++ {
		migration := appliedMigrations[i]

		// Find corresponding down migration
		downMigration := m.findDownMigration(migration.Version)
		if downMigration == nil {
			m.logger.Warnf("No down migration found for version %d", migration.Version)
			continue
		}

		if err := m.rollbackMigration(migration, *downMigration); err != nil {
			return fmt.Errorf("failed to rollback migration %d (%s): %w",
				migration.Version, migration.Name, err)
		}
	}

	m.logger.Info("Rollback completed successfully")
	return nil
}

// findDownMigration finds the down migration for a given version
func (m *MigrationManager) findDownMigration(version int) *Migration {
	// Look for down migration file
	_ = fmt.Sprintf("%03d_down_%s.sql", version, "")

	// This is a simplified implementation
	// In practice, you would parse the up migration to generate the down migration
	// or have separate down migration files
	return nil
}

// rollbackMigration rolls back a single migration
func (m *MigrationManager) rollbackMigration(appliedMigration, downMigration Migration) error {
	m.logger.WithFields(logrus.Fields{
		"version": appliedMigration.Version,
		"name":    appliedMigration.Name,
	}).Info("Rolling back migration")

	ctx := context.Background()

	// Start transaction
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Execute rollback SQL
	_, err = tx.Exec(ctx, downMigration.SQL)
	if err != nil {
		return fmt.Errorf("failed to execute rollback SQL: %w", err)
	}

	// Remove migration record
	deleteQuery := `DELETE FROM schema_migrations WHERE version = $1`
	_, err = tx.Exec(ctx, deleteQuery, appliedMigration.Version)
	if err != nil {
		return fmt.Errorf("failed to remove migration record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit rollback: %w", err)
	}

	m.logger.WithFields(logrus.Fields{
		"version": appliedMigration.Version,
		"name":    appliedMigration.Name,
	}).Info("Migration rolled back successfully")

	return nil
}

// Status returns the current migration status
func (m *MigrationManager) Status() (*MigrationStatus, error) {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return nil, fmt.Errorf("failed to get applied migrations: %w", err)
	}

	pending, err := m.PendingMigrations()
	if err != nil {
		return nil, fmt.Errorf("failed to get pending migrations: %w", err)
	}

	status := &MigrationStatus{
		TotalMigrations:   len(m.migrations),
		AppliedMigrations: len(applied),
		PendingMigrations: len(pending),
		LastApplied:       nil,
		CurrentVersion:    0,
	}

	// Find the latest applied migration
	for _, migration := range applied {
		if status.LastApplied == nil || migration.Version > status.LastApplied.Version {
			status.LastApplied = &migration
		}
	}

	if status.LastApplied != nil {
		status.CurrentVersion = status.LastApplied.Version
	}

	return status, nil
}

// MigrationStatus represents the migration status
type MigrationStatus struct {
	TotalMigrations   int        `json:"total_migrations"`
	AppliedMigrations int        `json:"applied_migrations"`
	PendingMigrations int        `json:"pending_migrations"`
	LastApplied       *Migration `json:"last_applied,omitempty"`
	CurrentVersion    int        `json:"current_version"`
}

// Validate checks if the applied migrations are consistent
func (m *MigrationManager) Validate() error {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	for version, appliedMigration := range applied {
		// Find corresponding migration file
		var migrationFile *Migration
		for _, migration := range m.migrations {
			if migration.Version == version {
				migrationFile = &migration
				break
			}
		}

		if migrationFile == nil {
			return fmt.Errorf("migration file not found for applied version %d", version)
		}

		// Check if hashes match
		if appliedMigration.Hash != migrationFile.Hash {
			return fmt.Errorf("migration hash mismatch for version %d: expected %s, got %s",
				version, migrationFile.Hash, appliedMigration.Hash)
		}
	}

	m.logger.Info("Migration validation passed")
	return nil
}

// Utility functions
func extractDescription(sql string) string {
	lines := strings.Split(sql, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "--") {
			return strings.TrimSpace(strings.TrimPrefix(line, "--"))
		}
	}
	return ""
}

func calculateHash(sql string) string {
	// Simple hash implementation - in practice, use SHA256
	return fmt.Sprintf("%x", len(sql)+12345) // Placeholder
}

// embeddedMigrations should be embedded using go:embed
// This is a placeholder for the embedded filesystem
var embeddedMigrations fs.FS
