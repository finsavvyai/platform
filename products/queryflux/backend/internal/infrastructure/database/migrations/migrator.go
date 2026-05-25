package migrations

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// Migration represents a single database migration
type Migration struct {
	Version     int64      `json:"version"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	UpSQL       string     `json:"up_sql"`
	DownSQL     string     `json:"down_sql"`
	AppliedAt   *time.Time `json:"applied_at,omitempty"`
	Checksum    string     `json:"checksum"`
}

// MigrationResult represents the result of a migration operation
type MigrationResult struct {
	Version   int64         `json:"version"`
	Name      string        `json:"name"`
	Status    string        `json:"status"` // "applied", "reverted", "failed"
	Error     string        `json:"error,omitempty"`
	Duration  time.Duration `json:"duration"`
	AppliedAt time.Time     `json:"applied_at"`
}

// Migrator handles database migrations
type Migrator struct {
	pool          *pgxpool.Pool
	logger        *zap.Logger
	migrationsDir string
	lockTable     string
	lockTimeout   time.Duration
}

// NewMigrator creates a new migration manager
func NewMigrator(pool *pgxpool.Pool, logger *zap.Logger, migrationsDir string) *Migrator {
	if logger == nil {
		logger = zap.NewNop()
	}

	return &Migrator{
		pool:          pool,
		logger:        logger,
		migrationsDir: migrationsDir,
		lockTable:     "schema_migrations_lock",
		lockTimeout:   30 * time.Second,
	}
}

// Init initializes the migration system by creating necessary tables
func (m *Migrator) Init(ctx context.Context) error {
	m.logger.Info("Initializing migration system")

	// Create migrations table
	createMigrationsTable := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			checksum VARCHAR(64) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(name, checksum)
		);
	`

	if _, err := m.pool.Exec(ctx, createMigrationsTable); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Create lock table for concurrent migration protection
	safeLock := pgx.Identifier{m.lockTable}.Sanitize()
	createLockTable := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			id INT PRIMARY KEY DEFAULT 1,
			locked_at TIMESTAMP WITH TIME ZONE,
			locked_by VARCHAR(255),
			session_id VARCHAR(255),
			CONSTRAINT %s_single_row CHECK (id = 1)
		);

		INSERT INTO %s (id) VALUES (1) ON CONFLICT DO NOTHING;
	`, safeLock, m.lockTable, safeLock)

	if _, err := m.pool.Exec(ctx, createLockTable); err != nil {
		return fmt.Errorf("failed to create lock table: %w", err)
	}

	m.logger.Info("Migration system initialized successfully")
	return nil
}

// GetAppliedMigrations returns all applied migrations
func (m *Migrator) GetAppliedMigrations(ctx context.Context) ([]*Migration, error) {
	query := `
		SELECT version, name, description, checksum, applied_at
		FROM schema_migrations
		ORDER BY version ASC
	`

	rows, err := m.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer rows.Close()

	var migrations []*Migration
	for rows.Next() {
		var mig Migration
		err := rows.Scan(&mig.Version, &mig.Name, &mig.Description, &mig.Checksum, &mig.AppliedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan migration row: %w", err)
		}
		migrations = append(migrations, &mig)
	}

	return migrations, nil
}

// LoadMigrationsFromFilesystem loads migrations from the filesystem
func (m *Migrator) LoadMigrationsFromFilesystem(ctx context.Context) ([]*Migration, error) {
	if m.migrationsDir == "" {
		return nil, fmt.Errorf("migrations directory not specified")
	}

	var migrations []*Migration

	// Pattern to match migration files: 001_name.up.sql, 001_name.down.sql
	upPattern := regexp.MustCompile(`^(\d+)_([^\.]+)\.up\.sql$`)
	downPattern := regexp.MustCompile(`^(\d+)_([^\.]+)\.down\.sql$`)

	// Read all files in migrations directory
	entries, err := fs.ReadDir(os.DirFS(m.migrationsDir), ".")
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	// Group files by version
	migrationFiles := make(map[int64]map[string]string) // version -> {up, down}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		filename := entry.Name()

		// Try to match up migration
		if matches := upPattern.FindStringSubmatch(filename); matches != nil {
			version, err := strconv.ParseInt(matches[1], 10, 64)
			if err != nil {
				m.logger.Warn("Invalid version in migration file", zap.String("file", filename))
				continue
			}

			if migrationFiles[version] == nil {
				migrationFiles[version] = make(map[string]string)
			}

			// Read file content
			content, err := fs.ReadFile(os.DirFS(m.migrationsDir), filename)
			if err != nil {
				m.logger.Error("Failed to read migration file", zap.String("file", filename), zap.Error(err))
				continue
			}

			migrationFiles[version]["up"] = string(content)
			migrationFiles[version]["name"] = matches[2]
		}

		// Try to match down migration
		if matches := downPattern.FindStringSubmatch(filename); matches != nil {
			version, err := strconv.ParseInt(matches[1], 10, 64)
			if err != nil {
				m.logger.Warn("Invalid version in migration file", zap.String("file", filename))
				continue
			}

			if migrationFiles[version] == nil {
				migrationFiles[version] = make(map[string]string)
			}

			// Read file content
			content, err := fs.ReadFile(os.DirFS(m.migrationsDir), filename)
			if err != nil {
				m.logger.Error("Failed to read migration file", zap.String("file", filename), zap.Error(err))
				continue
			}

			migrationFiles[version]["down"] = string(content)
		}
	}

	// Create migration objects
	for version, files := range migrationFiles {
		upSQL, hasUp := files["up"]
		downSQL, hasDown := files["down"]
		name, hasName := files["name"]

		if !hasUp || !hasName {
			m.logger.Warn("Missing up migration or name", zap.Int64("version", version))
			continue
		}

		// Log if no down migration is available
		if !hasDown {
			m.logger.Debug("No down migration file", zap.Int64("version", version))
		}

		migration := &Migration{
			Version: version,
			Name:    name,
			UpSQL:   upSQL,
			DownSQL: downSQL,
		}

		// Generate description from name
		migration.Description = strings.ReplaceAll(strings.Title(name), "_", " ")

		// Calculate checksum
		migration.Checksum = m.calculateChecksum(migration.UpSQL)

		migrations = append(migrations, migration)
	}

	// Sort migrations by version
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	m.logger.Info("Loaded migrations", zap.Int("count", len(migrations)))
	return migrations, nil
}

// Up applies pending migrations
func (m *Migrator) Up(ctx context.Context) ([]*MigrationResult, error) {
	m.logger.Info("Starting migration up process")

	// Acquire migration lock
	if err := m.acquireLock(ctx); err != nil {
		return nil, fmt.Errorf("failed to acquire migration lock: %w", err)
	}
	defer m.releaseLock(ctx)

	// Initialize migration system if needed
	if err := m.Init(ctx); err != nil {
		return nil, fmt.Errorf("failed to initialize migrations: %w", err)
	}

	// Load migrations from filesystem
	migrations, err := m.LoadMigrationsFromFilesystem(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load migrations: %w", err)
	}

	// Get applied migrations
	applied, err := m.GetAppliedMigrations(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Create set of applied versions
	appliedVersions := make(map[int64]bool)
	for _, mig := range applied {
		appliedVersions[mig.Version] = true
	}

	// Find pending migrations
	var pending []*Migration
	for _, mig := range migrations {
		if !appliedVersions[mig.Version] {
			pending = append(pending, mig)
		}
	}

	if len(pending) == 0 {
		m.logger.Info("No pending migrations")
		return []*MigrationResult{}, nil
	}

	m.logger.Info("Found pending migrations", zap.Int("count", len(pending)))

	var results []*MigrationResult

	// Apply pending migrations
	for _, mig := range pending {
		result := m.applyMigration(ctx, mig)
		results = append(results, result)

		if result.Status == "failed" {
			m.logger.Error("Migration failed, stopping",
				zap.Int64("version", mig.Version),
				zap.String("name", mig.Name),
				zap.String("error", result.Error))
			return results, fmt.Errorf("migration %d failed: %s", mig.Version, result.Error)
		}
	}

	m.logger.Info("All migrations applied successfully", zap.Int("count", len(results)))
	return results, nil
}

// Down rolls back the last N migrations
func (m *Migrator) Down(ctx context.Context, steps int) ([]*MigrationResult, error) {
	m.logger.Info("Starting migration down process", zap.Int("steps", steps))

	// Acquire migration lock
	if err := m.acquireLock(ctx); err != nil {
		return nil, fmt.Errorf("failed to acquire migration lock: %w", err)
	}
	defer m.releaseLock(ctx)

	// Get applied migrations
	applied, err := m.GetAppliedMigrations(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get applied migrations: %w", err)
	}

	if len(applied) == 0 {
		m.logger.Info("No migrations to rollback")
		return []*MigrationResult{}, nil
	}

	// Load migrations from filesystem
	migrations, err := m.LoadMigrationsFromFilesystem(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load migrations: %w", err)
	}

	// Create migration lookup
	migrationMap := make(map[int64]*Migration)
	for _, mig := range migrations {
		migrationMap[mig.Version] = mig
	}

	// Determine which migrations to rollback (last N)
	var toRollback []*Migration
	startIndex := len(applied) - steps
	if startIndex < 0 {
		startIndex = 0
	}

	for i := len(applied) - 1; i >= startIndex; i-- {
		appliedMig := applied[i]
		if mig, exists := migrationMap[appliedMig.Version]; exists {
			toRollback = append(toRollback, mig)
		} else {
			m.logger.Warn("Migration file not found for rollback", zap.Int64("version", appliedMig.Version))
		}
	}

	var results []*MigrationResult

	// Rollback migrations in reverse order
	for _, mig := range toRollback {
		result := m.rollbackMigration(ctx, mig)
		results = append(results, result)

		if result.Status == "failed" {
			m.logger.Error("Rollback failed, stopping",
				zap.Int64("version", mig.Version),
				zap.String("name", mig.Name),
				zap.String("error", result.Error))
			return results, fmt.Errorf("rollback %d failed: %s", mig.Version, result.Error)
		}
	}

	m.logger.Info("Migrations rolled back successfully", zap.Int("count", len(results)))
	return results, nil
}

// applyMigration applies a single migration
func (m *Migrator) applyMigration(ctx context.Context, mig *Migration) *MigrationResult {
	result := &MigrationResult{
		Version:   mig.Version,
		Name:      mig.Name,
		Status:    "failed",
		AppliedAt: time.Now(),
	}

	start := time.Now()

	m.logger.Info("Applying migration",
		zap.Int64("version", mig.Version),
		zap.String("name", mig.Name))

	// Validate checksum
	appliedMigrations, err := m.GetAppliedMigrations(ctx)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to get applied migrations: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	for _, applied := range appliedMigrations {
		if applied.Version == mig.Version && applied.Checksum != mig.Checksum {
			result.Error = "Migration checksum mismatch - file has been modified"
			result.Duration = time.Since(start)
			return result
		}
	}

	// Start transaction
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to start transaction: %v", err)
		result.Duration = time.Since(start)
		return result
	}
	defer tx.Rollback(ctx)

	// Execute migration SQL
	if _, err := tx.Exec(ctx, mig.UpSQL); err != nil {
		result.Error = fmt.Sprintf("Migration SQL failed: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Record migration
	insertSQL := `
		INSERT INTO schema_migrations (version, name, description, checksum)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (version) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			checksum = EXCLUDED.checksum,
			applied_at = NOW()
	`

	if _, err := tx.Exec(ctx, insertSQL, mig.Version, mig.Name, mig.Description, mig.Checksum); err != nil {
		result.Error = fmt.Sprintf("Failed to record migration: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		result.Error = fmt.Sprintf("Failed to commit migration: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	result.Status = "applied"
	result.Duration = time.Since(start)

	m.logger.Info("Migration applied successfully",
		zap.Int64("version", mig.Version),
		zap.String("name", mig.Name),
		zap.Duration("duration", result.Duration))

	return result
}

// rollbackMigration rolls back a single migration
func (m *Migrator) rollbackMigration(ctx context.Context, mig *Migration) *MigrationResult {
	result := &MigrationResult{
		Version:   mig.Version,
		Name:      mig.Name,
		Status:    "failed",
		AppliedAt: time.Now(),
	}

	start := time.Now()

	if mig.DownSQL == "" {
		result.Error = "No rollback SQL available for this migration"
		result.Duration = time.Since(start)
		return result
	}

	m.logger.Info("Rolling back migration",
		zap.Int64("version", mig.Version),
		zap.String("name", mig.Name))

	// Start transaction
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to start transaction: %v", err)
		result.Duration = time.Since(start)
		return result
	}
	defer tx.Rollback(ctx)

	// Execute rollback SQL
	if _, err := tx.Exec(ctx, mig.DownSQL); err != nil {
		result.Error = fmt.Sprintf("Rollback SQL failed: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Remove migration record
	deleteSQL := `DELETE FROM schema_migrations WHERE version = $1`
	if _, err := tx.Exec(ctx, deleteSQL, mig.Version); err != nil {
		result.Error = fmt.Sprintf("Failed to remove migration record: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		result.Error = fmt.Sprintf("Failed to commit rollback: %v", err)
		result.Duration = time.Since(start)
		return result
	}

	result.Status = "reverted"
	result.Duration = time.Since(start)

	m.logger.Info("Migration rolled back successfully",
		zap.Int64("version", mig.Version),
		zap.String("name", mig.Name),
		zap.Duration("duration", result.Duration))

	return result
}

// acquireLock acquires a migration lock to prevent concurrent migrations
func (m *Migrator) acquireLock(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, m.lockTimeout)
	defer cancel()

	// Try to acquire lock
	lockSQL := fmt.Sprintf(`
		UPDATE %s
		SET locked_at = NOW(), locked_by = 'migrator', session_id = $1
		WHERE id = 1 AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '1 hour')
	`, pgx.Identifier{m.lockTable}.Sanitize())

	result, err := m.pool.Exec(ctx, lockSQL, "session_"+time.Now().Format("20060102150405"))
	if err != nil {
		return fmt.Errorf("failed to acquire lock: %w", err)
	}

	if result.RowsAffected() == 0 {
		// Check if lock is held
		var lockedAt time.Time
		checkSQL := fmt.Sprintf(`SELECT locked_at FROM %s WHERE id = 1`, pgx.Identifier{m.lockTable}.Sanitize())
		err := m.pool.QueryRow(ctx, checkSQL).Scan(&lockedAt)
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("failed to check lock status: %w", err)
		}

		if !lockedAt.IsZero() {
			return fmt.Errorf("migration lock is held since %v", lockedAt)
		}

		return fmt.Errorf("failed to acquire migration lock")
	}

	return nil
}

// releaseLock releases the migration lock
func (m *Migrator) releaseLock(ctx context.Context) {
	releaseSQL := fmt.Sprintf(`
		UPDATE %s
		SET locked_at = NULL, locked_by = NULL, session_id = NULL
		WHERE id = 1
	`, pgx.Identifier{m.lockTable}.Sanitize())

	if _, err := m.pool.Exec(ctx, releaseSQL); err != nil {
		m.logger.Error("Failed to release migration lock", zap.Error(err))
	}
}

// calculateChecksum calculates a checksum for migration SQL
func (m *Migrator) calculateChecksum(sql string) string {
	// Simple checksum implementation - in production, you might want to use a proper hash
	return fmt.Sprintf("%x", len(sql)+12345) // Placeholder
}

// GetMigrationStatus returns the current migration status
func (m *Migrator) GetMigrationStatus(ctx context.Context) (map[string]interface{}, error) {
	applied, err := m.GetAppliedMigrations(ctx)
	if err != nil {
		return nil, err
	}

	migrations, err := m.LoadMigrationsFromFilesystem(ctx)
	if err != nil {
		return nil, err
	}

	appliedVersions := make(map[int64]bool)
	for _, mig := range applied {
		appliedVersions[mig.Version] = true
	}

	var pending []int64
	for _, mig := range migrations {
		if !appliedVersions[mig.Version] {
			pending = append(pending, mig.Version)
		}
	}

	status := map[string]interface{}{
		"applied_count": len(applied),
		"pending_count": len(pending),
		"total_count":   len(migrations),
		"latest_version": func() int64 {
			if len(applied) > 0 {
				return applied[len(applied)-1].Version
			}
			return 0
		}(),
		"pending_versions": pending,
	}

	return status, nil
}
