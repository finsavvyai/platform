//go:build legacy_migrated
// +build legacy_migrated

package database

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" // PostgreSQL driver
	"gopkg.in/yaml.v2"
)

// MigrationManager manages database migrations and seed data
type MigrationManager struct {
	db             *sqlx.DB
	config         *MigrationConfig
	logger         Logger
	migrations     []Migration
	seedData       []SeedData
	currentVersion int
}

// MigrationConfig holds configuration for migration manager
type MigrationConfig struct {
	MigrationsPath      string        `yaml:"migrations_path"`
	SeedDataPath        string        `yaml:"seed_data_path"`
	TableName           string        `yaml:"table_name"`
	VersionColumn       string        `yaml:"version_column"`
	AutoMigrate         bool          `yaml:"auto_migrate"`
	BackupBeforeMigrate bool          `yaml:"backup_before_migrate"`
	Environment         string        `yaml:"environment"`
	MaxVersion          int           `yaml:"max_version"`
	Timeout             time.Duration `yaml:"timeout"`
	BatchSize           int           `yaml:"batch_size"`
}

// Migration represents a single database migration
type Migration struct {
	Version      int       `json:"version"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	UpSQL        string    `json:"up_sql"`
	DownSQL      string    `json:"down_sql"`
	CreatedAt    time.Time `json:"created_at"`
	Checksum     string    `json:"checksum"`
	Dependencies []int     `json:"dependencies"`
	Type         string    `json:"type"` // "schema", "data", "index", "function"
}

// SeedData represents seed data to be loaded
type SeedData struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Version     int                    `json:"version"`
	SQL         string                 `json:"sql"`
	Data        map[string]interface{} `json:"data"`
	Environment string                 `json:"environment"`
	Required    bool                   `json:"required"`
	Table       string                 `json:"table"`
	Order       int                    `json:"order"`
}

// Logger interface for migration logging
type Logger interface {
	Info(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
}

// MigrationResult holds the result of a migration operation
type MigrationResult struct {
	Success         bool          `json:"success"`
	Version         int           `json:"version"`
	Name            string        `json:"name"`
	Duration        time.Duration `json:"duration"`
	Error           string        `json:"error,omitempty"`
	RecordsAffected int64         `json:"records_affected,omitempty"`
	Checksum        string        `json:"checksum"`
}

// MigrationStatus holds the current migration status
type MigrationStatus struct {
	CurrentVersion    int         `json:"current_version"`
	LatestVersion     int         `json:"latest_version"`
	PendingMigrations []Migration `json:"pending_migrations"`
	AppliedMigrations []Migration `json:"applied_migrations"`
	DatabaseReady     bool        `json:"database_ready"`
	LastMigration     *Migration  `json:"last_migration,omitempty"`
	Environment       string      `json:"environment"`
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *sqlx.DB, config *MigrationConfig, logger Logger) (*MigrationManager, error) {
	if config == nil {
		config = &MigrationConfig{
			MigrationsPath:      "migrations",
			SeedDataPath:        "seeds",
			TableName:           "schema_migrations",
			VersionColumn:       "version",
			AutoMigrate:         true,
			BackupBeforeMigrate: true,
			Environment:         "development",
			MaxVersion:          999999,
			Timeout:             30 * time.Minute,
			BatchSize:           1000,
		}
	}

	mm := &MigrationManager{
		db:     db,
		config: config,
		logger: logger,
	}

	// Initialize migration table
	if err := mm.initializeMigrationTable(); err != nil {
		return nil, fmt.Errorf("failed to initialize migration table: %w", err)
	}

	// Load migrations
	if err := mm.loadMigrations(); err != nil {
		return nil, fmt.Errorf("failed to load migrations: %w", err)
	}

	// Load seed data
	if err := mm.loadSeedData(); err != nil {
		return nil, fmt.Errorf("failed to load seed data: %w", err)
	}

	// Get current version
	version, err := mm.getCurrentVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}
	mm.currentVersion = version

	return mm, nil
}

// initializeMigrationTable creates the migration tracking table
func (mm *MigrationManager) initializeMigrationTable() error {
	createTableSQL := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			%s SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			checksum VARCHAR(64) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			execution_time_ms INTEGER,
			success BOOLEAN NOT NULL DEFAULT TRUE,
			error_message TEXT,
			dependencies INTEGER[] DEFAULT '{}',
			migration_type VARCHAR(50) DEFAULT 'schema'
		);

		CREATE INDEX IF NOT EXISTS idx_%s_applied_at ON %s(applied_at);
		CREATE INDEX IF NOT EXISTS idx_%s_success ON %s(success);
	`, mm.config.TableName, mm.config.VersionColumn,
		mm.config.TableName, mm.config.TableName, mm.config.TableName)

	_, err := mm.db.Exec(createTableSQL)
	return err
}

// loadMigrations loads migration files from disk
func (mm *MigrationManager) loadMigrations() error {
	if _, err := os.Stat(mm.config.MigrationsPath); os.IsNotExist(err) {
		mm.logger.Info("Migrations directory not found, no migrations to load")
		return nil
	}

	files, err := ioutil.ReadDir(mm.config.MigrationsPath)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	migrations := make([]Migration, 0)

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		migration, err := mm.parseMigrationFile(file.Name())
		if err != nil {
			return fmt.Errorf("failed to parse migration file %s: %w", file.Name(), err)
		}

		migrations = append(migrations, migration)
	}

	// Sort migrations by version
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	mm.migrations = migrations
	mm.logger.Info("Loaded migrations", "count", len(migrations))

	return nil
}

// parseMigrationFile parses a migration file
func (mm *MigrationManager) parseMigrationFile(filename string) (Migration, error) {
	// Extract version from filename (e.g., 001_initial_schema.sql)
	parts := strings.Split(strings.TrimSuffix(filename, ".sql"), "_")
	if len(parts) < 2 {
		return Migration{}, fmt.Errorf("invalid migration filename format: %s", filename)
	}

	version, err := strconv.Atoi(parts[0])
	if err != nil {
		return Migration{}, fmt.Errorf("invalid version in filename %s: %w", filename, err)
	}

	name := strings.Join(parts[1:], "_")
	filePath := filepath.Join(mm.config.MigrationsPath, filename)

	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return Migration{}, fmt.Errorf("failed to read migration file %s: %w", filename, err)
	}

	sqlContent := string(content)

	// Split into up and down migrations
	upSQL, downSQL := mm.splitMigrationSQL(sqlContent)

	migration := Migration{
		Version:     version,
		Name:        name,
		Description: mm.extractDescription(sqlContent),
		UpSQL:       upSQL,
		DownSQL:     downSQL,
		CreatedAt:   time.Now(),
		Checksum:    mm.calculateChecksum(string(content)),
		Type:        mm.determineMigrationType(upSQL),
	}

	return migration, nil
}

// splitMigrationSQL splits migration SQL into up and down parts
func (mm *MigrationManager) splitMigrationSQL(content string) (string, string) {
	// Look for -- +migrate Down separator
	parts := strings.Split(content, "-- +migrate Down")

	if len(parts) == 2 {
		upSQL := strings.TrimSpace(parts[0])
		// Remove -- +migrate Up if present
		upSQL = strings.Replace(upSQL, "-- +migrate Up", "", 1)
		downSQL := strings.TrimSpace(parts[1])
		return upSQL, downSQL
	}

	// If no down migration found, return empty down SQL
	upSQL := strings.Replace(content, "-- +migrate Up", "", 1)
	return strings.TrimSpace(upSQL), ""
}

// extractDescription extracts description from SQL comments
func (mm *MigrationManager) extractDescription(content string) string {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "--") && !strings.Contains(line, "+migrate") {
			return strings.TrimPrefix(line, "-- ")
		}
	}
	return ""
}

// determineMigrationType determines the type of migration
func (mm *MigrationManager) determineMigrationType(sql string) string {
	lowerSQL := strings.ToLower(sql)

	if strings.Contains(lowerSQL, "create table") || strings.Contains(lowerSQL, "alter table") {
		return "schema"
	} else if strings.Contains(lowerSQL, "insert into") || strings.Contains(lowerSQL, "update") {
		return "data"
	} else if strings.Contains(lowerSQL, "create index") || strings.Contains(lowerSQL, "drop index") {
		return "index"
	} else if strings.Contains(lowerSQL, "create function") || strings.Contains(lowerSQL, "create procedure") {
		return "function"
	}

	return "schema"
}

// calculateChecksum calculates checksum for migration file
func (mm *MigrationManager) calculateChecksum(content string) string {
	// Simple checksum calculation - would use proper hash in production
	return fmt.Sprintf("%x", len(content))
}

// loadSeedData loads seed data files from disk
func (mm *MigrationManager) loadSeedData() error {
	if _, err := os.Stat(mm.config.SeedDataPath); os.IsNotExist(err) {
		mm.logger.Info("Seed data directory not found, no seed data to load")
		return nil
	}

	files, err := ioutil.ReadDir(mm.config.SeedDataPath)
	if err != nil {
		return fmt.Errorf("failed to read seed data directory: %w", err)
	}

	seedData := make([]SeedData, 0)

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		data, err := mm.parseSeedDataFile(file.Name())
		if err != nil {
			mm.logger.Warn("Failed to parse seed data file", "file", file.Name(), "error", err)
			continue
		}

		// Only include seed data for current environment or all environments
		if data.Environment == mm.config.Environment || data.Environment == "all" {
			seedData = append(seedData, data)
		}
	}

	// Sort seed data by order
	sort.Slice(seedData, func(i, j int) bool {
		return seedData[i].Order < seedData[j].Order
	})

	mm.seedData = seedData
	mm.logger.Info("Loaded seed data", "count", len(seedData))

	return nil
}

// parseSeedDataFile parses a seed data file
func (mm *MigrationManager) parseSeedDataFile(filename string) (SeedData, error) {
	// Extract name and version from filename
	parts := strings.Split(strings.TrimSuffix(filename, ".sql"), "_")
	if len(parts) < 2 {
		return SeedData{}, fmt.Errorf("invalid seed data filename format: %s", filename)
	}

	name := parts[0]
	order, err := strconv.Atoi(parts[1])
	if err != nil {
		order = 100 // Default order
	}

	filePath := filepath.Join(mm.config.SeedDataPath, filename)
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return SeedData{}, fmt.Errorf("failed to read seed data file %s: %w", filename, err)
	}

	sqlContent := string(content)

	seedData := SeedData{
		Name:        name,
		Description: mm.extractDescription(sqlContent),
		Version:     1,
		SQL:         sqlContent,
		Environment: "all",
		Required:    false,
		Table:       mm.extractTableFromSQL(sqlContent),
		Order:       order,
	}

	return seedData, nil
}

// extractTableFromSQL extracts table name from SQL
func (mm *MigrationManager) extractTableFromSQL(sql string) string {
	lowerSQL := strings.ToLower(sql)

	// Look for INSERT INTO statements
	if strings.Contains(lowerSQL, "insert into") {
		parts := strings.Split(lowerSQL, "insert into")
		if len(parts) > 1 {
			tablePart := strings.TrimSpace(parts[1])
			tableParts := strings.Fields(tablePart)
			if len(tableParts) > 0 {
				return strings.Trim(tableParts[0], ";")
			}
		}
	}

	return ""
}

// getCurrentVersion retrieves the current migration version from database
func (mm *MigrationManager) getCurrentVersion() (int, error) {
	var version int
	query := fmt.Sprintf("SELECT COALESCE(MAX(%s), 0) FROM %s WHERE success = TRUE",
		mm.config.VersionColumn, mm.config.TableName)

	err := mm.db.Get(&version, query)
	return version, err
}

// MigrateUp runs pending migrations
func (mm *MigrationManager) MigrateUp(ctx context.Context) (*MigrationStatus, error) {
	mm.logger.Info("Starting migration up", "current_version", mm.currentVersion)

	status, err := mm.getStatus()
	if err != nil {
		return nil, fmt.Errorf("failed to get migration status: %w", err)
	}

	if len(status.PendingMigrations) == 0 {
		mm.logger.Info("No pending migrations")
		return status, nil
	}

	// Backup database if configured
	if mm.config.BackupBeforeMigrate {
		if err := mm.backupDatabase(); err != nil {
			mm.logger.Warn("Failed to backup database before migration", "error", err)
			// Continue with migration even if backup fails
		}
	}

	// Run pending migrations
	for _, migration := range status.PendingMigrations {
		if migration.Version > mm.config.MaxVersion {
			mm.logger.Info("Skipping migration beyond max version",
				"version", migration.Version, "max_version", mm.config.MaxVersion)
			continue
		}

		result, err := mm.runMigration(ctx, migration, true)
		if err != nil {
			mm.logger.Error("Migration failed", "version", migration.Version, "error", err)
			return status, err
		}

		mm.logger.Info("Migration applied successfully",
			"version", result.Version,
			"name", result.Name,
			"duration", result.Duration)

		mm.currentVersion = migration.Version
	}

	// Update status
	newStatus, err := mm.getStatus()
	if err != nil {
		mm.logger.Warn("Failed to get updated migration status", "error", err)
		return status, nil
	}

	return newStatus, nil
}

// MigrateDown rolls back the last migration
func (mm *MigrationManager) MigrateDown(ctx context.Context, targetVersion int) (*MigrationStatus, error) {
	mm.logger.Info("Starting migration down", "target_version", targetVersion, "current_version", mm.currentVersion)

	status, err := mm.getStatus()
	if err != nil {
		return nil, fmt.Errorf("failed to get migration status: %w", err)
	}

	if targetVersion <= 0 {
		// Rollback last migration
		if len(status.AppliedMigrations) == 0 {
			return status, fmt.Errorf("no migrations to rollback")
		}
		targetVersion = status.AppliedMigrations[len(status.AppliedMigrations)-1].Version
	}

	// Rollback migrations in reverse order
	for i := len(status.AppliedMigrations) - 1; i >= 0; i-- {
		migration := status.AppliedMigrations[i]
		if migration.Version <= targetVersion {
			break
		}

		result, err := mm.runMigration(ctx, migration, false)
		if err != nil {
			mm.logger.Error("Rollback failed", "version", migration.Version, "error", err)
			return status, err
		}

		mm.logger.Info("Migration rolled back successfully",
			"version", result.Version,
			"name", result.Name,
			"duration", result.Duration)

		mm.currentVersion = migration.Version - 1
	}

	// Update status
	newStatus, err := mm.getStatus()
	if err != nil {
		mm.logger.Warn("Failed to get updated migration status", "error", err)
		return status, nil
	}

	return newStatus, nil
}

// runMigration executes a single migration
func (mm *MigrationManager) runMigration(ctx context.Context, migration Migration, up bool) (*MigrationResult, error) {
	startTime := time.Now()

	var sql string
	if up {
		sql = migration.UpSQL
	} else {
		sql = migration.DownSQL
	}

	if sql == "" {
		return nil, fmt.Errorf("no SQL to execute for migration %s", migration.Name)
	}

	// Start transaction
	tx, err := mm.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute migration SQL
	result, err := tx.Exec(sql)
	if err != nil {
		return nil, fmt.Errorf("failed to execute migration SQL: %w", err)
	}

	// Update migration record
	var rowsAffected int64
	if up {
		// Insert migration record
		insertSQL := fmt.Sprintf(`
			INSERT INTO %s (name, description, checksum, applied_at, execution_time_ms, success, dependencies, migration_type)
			VALUES ($1, $2, $3, NOW(), $4, TRUE, $5, $6)
		`, mm.config.TableName)

		executionTime := time.Since(startTime).Milliseconds()
		_, err = tx.Exec(insertSQL, migration.Name, migration.Description,
			migration.Checksum, executionTime, migration.Dependencies, migration.Type)
		if err != nil {
			return nil, fmt.Errorf("failed to insert migration record: %w", err)
		}
	} else {
		// Delete migration record
		deleteSQL := fmt.Sprintf("DELETE FROM %s WHERE version = $1", mm.config.TableName)
		result, err = tx.Exec(deleteSQL, migration.Version)
		if err != nil {
			return nil, fmt.Errorf("failed to delete migration record: %w", err)
		}
		rowsAffected, _ = result.RowsAffected()
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit migration transaction: %w", err)
	}

	return &MigrationResult{
		Success:         true,
		Version:         migration.Version,
		Name:            migration.Name,
		Duration:        time.Since(startTime),
		RecordsAffected: rowsAffected,
		Checksum:        migration.Checksum,
	}, nil
}

// LoadSeedData loads seed data into the database
func (mm *MigrationManager) LoadSeedData(ctx context.Context) error {
	mm.logger.Info("Loading seed data")

	if len(mm.seedData) == 0 {
		mm.logger.Info("No seed data to load")
		return nil
	}

	for _, data := range mm.seedData {
		if !data.Required && !mm.shouldLoadSeedData(data.Name) {
			mm.logger.Debug("Skipping non-required seed data", "name", data.Name)
			continue
		}

		if err := mm.loadSeedDataItem(ctx, data); err != nil {
			mm.logger.Error("Failed to load seed data", "name", data.Name, "error", err)
			if data.Required {
				return fmt.Errorf("failed to load required seed data %s: %w", data.Name, err)
			}
			continue
		}

		mm.logger.Info("Seed data loaded successfully", "name", data.Name, "table", data.Table)
	}

	return nil
}

// loadSeedDataItem loads a single seed data item
func (mm *MigrationManager) loadSeedDataItem(ctx context.Context, data SeedData) error {
	// Check if data already exists (for idempotent loading)
	if data.Table != "" {
		var count int
		checkSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s", data.Table)
		if err := mm.db.GetContext(ctx, &count, checkSQL); err == nil && count > 0 {
			mm.logger.Debug("Seed data already exists", "table", data.Table)
			return nil
		}
	}

	// Execute seed data SQL
	tx, err := mm.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, data.SQL); err != nil {
		return fmt.Errorf("failed to execute seed data SQL: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit seed data transaction: %w", err)
	}

	return nil
}

// shouldLoadSeedData determines if seed data should be loaded
func (mm *MigrationManager) shouldLoadSeedData(name string) bool {
	// In development, load all seed data
	if mm.config.Environment == "development" {
		return true
	}

	// In production, only load required seed data
	requiredSeedData := []string{
		"users",
		"roles",
		"permissions",
		"system_config",
	}

	for _, required := range requiredSeedData {
		if name == required {
			return true
		}
	}

	return false
}

// backupDatabase creates a database backup
func (mm *MigrationManager) backupDatabase() error {
	mm.logger.Info("Creating database backup before migration")

	// This would implement actual database backup logic
	// For now, just log the backup creation
	backupSQL := fmt.Sprintf("CREATE TABLE IF NOT EXISTS backup_%s AS SELECT * FROM %s;",
		mm.config.TableName, mm.config.TableName)

	_, err := mm.db.Exec(backupSQL)
	if err != nil {
		return fmt.Errorf("failed to create backup table: %w", err)
	}

	return nil
}

// getStatus gets the current migration status
func (mm *MigrationManager) getStatus() (*MigrationStatus, error) {
	currentVersion, err := mm.getCurrentVersion()
	if err != nil {
		return nil, err
	}

	latestVersion := 0
	appliedMigrations := make([]Migration, 0)
	pendingMigrations := make([]Migration, 0)

	// Get applied migrations from database
	var applied []struct {
		Version         int       `db:"version"`
		Name            string    `db:"name"`
		Description     string    `db:"description"`
		AppliedAt       time.Time `db:"applied_at"`
		ExecutionTimeMs int       `db:"execution_time_ms"`
		Success         bool      `db:"success"`
		Dependencies    []int     `db:"dependencies"`
		MigrationType   string    `db:"migration_type"`
	}

	query := fmt.Sprintf("SELECT version, name, description, applied_at, execution_time_ms, success, dependencies, migration_type FROM %s WHERE success = TRUE ORDER BY version", mm.config.TableName)
	if err := mm.db.Select(&applied, query); err != nil {
		mm.logger.Warn("Failed to get applied migrations", "error", err)
	}

	// Convert to Migration format
	for _, a := range applied {
		appliedMigrations = append(appliedMigrations, Migration{
			Version:      a.Version,
			Name:         a.Name,
			Description:  a.Description,
			CreatedAt:    a.AppliedAt,
			Type:         a.MigrationType,
			Dependencies: a.Dependencies,
		})
		if a.Version > latestVersion {
			latestVersion = a.Version
		}
	}

	// Find pending migrations
	appliedVersions := make(map[int]bool)
	for _, migration := range appliedMigrations {
		appliedVersions[migration.Version] = true
	}

	for _, migration := range mm.migrations {
		if !appliedVersions[migration.Version] {
			// Check dependencies
			canApply := true
			for _, dep := range migration.Dependencies {
				if !appliedVersions[dep] {
					canApply = false
					break
				}
			}
			if canApply {
				pendingMigrations = append(pendingMigrations, migration)
			}
		}
	}

	return &MigrationStatus{
		CurrentVersion:    currentVersion,
		LatestVersion:     latestVersion,
		PendingMigrations: pendingMigrations,
		AppliedMigrations: appliedMigrations,
		DatabaseReady:     len(pendingMigrations) == 0,
		Environment:       mm.config.Environment,
	}, nil
}

// Validate checks if all migrations are valid
func (mm *MigrationManager) Validate() error {
	mm.logger.Info("Validating migrations")

	// Check for duplicate versions
	versions := make(map[int]bool)
	for _, migration := range mm.migrations {
		if versions[migration.Version] {
			return fmt.Errorf("duplicate migration version: %d", migration.Version)
		}
		versions[migration.Version] = true
	}

	// Check dependencies
	for _, migration := range mm.migrations {
		for _, dep := range migration.Dependencies {
			if !versions[dep] {
				return fmt.Errorf("migration %d depends on non-existent version %d", migration.Version, dep)
			}
		}
	}

	// Check for gaps in version sequence
	for i := 1; i < len(mm.migrations); i++ {
		if mm.migrations[i].Version != mm.migrations[i-1].Version+1 {
			mm.logger.Warn("Gap detected in migration sequence",
				"previous_version", mm.migrations[i-1].Version,
				"current_version", mm.migrations[i].Version)
		}
	}

	mm.logger.Info("Migration validation completed successfully")
	return nil
}

// Reset drops the migration table and all data (development only)
func (mm *MigrationManager) Reset(ctx context.Context) error {
	if mm.config.Environment != "development" {
		return fmt.Errorf("reset is only allowed in development environment")
	}

	mm.logger.Warn("Resetting database - all data will be lost")

	// Drop migration table
	dropSQL := fmt.Sprintf("DROP TABLE IF EXISTS %s", mm.config.TableName)
	if _, err := mm.db.Exec(dropSQL); err != nil {
		return fmt.Errorf("failed to drop migration table: %w", err)
	}

	// Reinitialize migration table
	if err := mm.initializeMigrationTable(); err != nil {
		return fmt.Errorf("failed to reinitialize migration table: %w", err)
	}

	mm.currentVersion = 0
	mm.logger.Info("Database reset completed")

	return nil
}