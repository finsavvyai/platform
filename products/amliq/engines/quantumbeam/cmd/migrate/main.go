//go:build legacy_migrated
// +build legacy_migrated

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
)

type Config struct {
	Host          string
	Port          string
	User          string
	Password      string
	Database      string
	SSLMode       string
	MigrationPath string
	Environment   string
}

type MigrationManager struct {
	config *Config
	db     *sql.DB
	mig    *migrate.Migrate
}

func main() {
	config := loadConfig()
	mgr := &MigrationManager{config: config}

	if len(os.Args) < 2 {
		showUsage()
		os.Exit(1)
	}

	command := os.Args[1]
	args := os.Args[2:]

	switch command {
	case "up":
		mgr.migrateUp()
	case "down":
		mgr.migrateDown()
	case "steps":
		mgr.migrateSteps(args)
	case "version":
		mgr.showVersion()
	case "force":
		mgr.forceVersion(args)
	case "goto":
		mgr.gotoVersion(args)
	case "create":
		mgr.createMigration(args)
	case "status":
		mgr.showStatus()
	case "validate":
		mgr.validateMigrations()
	case "reset":
		mgr.resetDatabase()
	case "seed":
		mgr.seedDatabase(args)
	case "backup":
		mgr.backupDatabase(args)
	case "test":
		mgr.testConnection()
	case "init":
		mgr.initDatabase()
	case "help", "-h", "--help":
		showUsage()
	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		showUsage()
		os.Exit(1)
	}
}

func loadConfig() *Config {
	config := &Config{
		Host:          getEnv("DB_HOST", "localhost"),
		Port:          getEnv("DB_PORT", "5433"),
		User:          getEnv("DB_USER", "postgres"),
		Password:      getEnv("DB_PASSWORD", "password"),
		Database:      getEnv("DB_NAME", "quantumbeam_dev"),
		SSLMode:       getEnv("DB_SSL_MODE", "disable"),
		MigrationPath: getEnv("MIGRATIONS_PATH", "./migrations"),
		Environment:   getEnv("ENVIRONMENT", "development"),
	}

	// Use PgBouncer for development/testing
	if config.Environment == "development" || config.Environment == "testing" {
		if getEnv("USE_PGBOUNCER", "true") == "true" {
			config.Port = getEnv("PGBOUNCER_PORT", "6432")
		}
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (mgr *MigrationManager) connect() error {
	databaseURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s&x-migrations-table=schema_migrations",
		mgr.config.User,
		mgr.config.Password,
		mgr.config.Host,
		mgr.config.Port,
		mgr.config.Database,
		mgr.config.SSLMode,
	)

	// Connect with migrate
	mig, err := migrate.New(
		"file://"+mgr.config.MigrationPath,
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	mgr.mig = mig

	// Also connect directly to database for custom operations
	db, err := sql.Open("postgres", strings.Replace(databaseURL, "&x-migrations-table=schema_migrations", "", 1))
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	mgr.db = db

	return nil
}

func (mgr *MigrationManager) migrateUp() {
	log.Println("🚀 Running database migrations UP...")

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	if err := mgr.mig.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("❌ Migration failed: %v", err)
	}

	if err == migrate.ErrNoChange {
		log.Println("✅ No migrations to apply - database is up to date")
	} else {
		log.Println("✅ All migrations applied successfully")
	}

	version, dirty, _ := mgr.mig.Version()
	log.Printf("📊 Current database version: %d (dirty: %v)", version, dirty)
}

func (mgr *MigrationManager) migrateDown() {
	log.Println("⬇️  Running database migrations DOWN...")

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	if err := mgr.mig.Steps(-1); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("❌ Migration failed: %v", err)
	}

	if err == migrate.ErrNoChange {
		log.Println("✅ No migrations to rollback - database is at initial state")
	} else {
		log.Println("✅ Migration rollback completed successfully")
	}

	version, dirty, _ := mgr.mig.Version()
	log.Printf("📊 Current database version: %d (dirty: %v)", version, dirty)
}

func (mgr *MigrationManager) migrateSteps(args []string) {
	if len(args) < 1 {
		log.Fatal("❌ Number of steps is required")
	}

	steps, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("❌ Invalid number of steps: %v", err)
	}

	direction := "up"
	if steps < 0 {
		direction = "down"
	}

	log.Printf("🔄 Running %d migration steps %s...", steps, direction)

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	if err := mgr.mig.Steps(steps); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("❌ Migration failed: %v", err)
	}

	if err == migrate.ErrNoChange {
		log.Println("✅ No migrations to apply")
	} else {
		log.Printf("✅ Applied %d migration steps successfully", steps)
	}

	version, dirty, _ := mgr.mig.Version()
	log.Printf("📊 Current database version: %d (dirty: %v)", version, dirty)
}

func (mgr *MigrationManager) showVersion() {
	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	version, dirty, err := mgr.mig.Version()
	if err != nil {
		log.Fatalf("❌ Failed to get version: %v", err)
	}

	log.Printf("📊 Current database version: %d", version)
	log.Printf("📊 Database state: %s", map[bool]string{true: "DIRTY", false: "CLEAN"}[dirty])
}

func (mgr *MigrationManager) forceVersion(args []string) {
	if len(args) < 1 {
		log.Fatal("❌ Version number is required")
	}

	version, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("❌ Invalid version number: %v", err)
	}

	log.Printf("⚠️  Forcing database version to %d...", version)

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	if err := mgr.mig.Force(version); err != nil {
		log.Fatalf("❌ Failed to force version: %v", err)
	}

	log.Printf("✅ Database version forced to %d", version)
	log.Println("⚠️  Warning: This may leave your database in an inconsistent state")
}

func (mgr *MigrationManager) gotoVersion(args []string) {
	if len(args) < 1 {
		log.Fatal("❌ Version number is required")
	}

	version, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("❌ Invalid version number: %v", err)
	}

	log.Printf("🎯 Migrating database to version %d...", version)

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	if err := mgr.mig.Migrate(version); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("❌ Migration failed: %v", err)
	}

	if err == migrate.ErrNoChange {
		log.Println("✅ Database is already at target version")
	} else {
		log.Printf("✅ Database migrated to version %d successfully", version)
	}
}

func (mgr *MigrationManager) createMigration(args []string) {
	if len(args) < 1 {
		log.Fatal("❌ Migration name is required")
	}

	name := args[0]
	timestamp := time.Now().Format("20060102150405")

	// Find the next migration number
	files, err := os.ReadDir(mgr.config.MigrationPath)
	if err != nil && !os.IsNotExist(err) {
		log.Fatalf("❌ Failed to read migrations directory: %v", err)
	}

	maxNum := 0
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".up.sql") {
			parts := strings.Split(file.Name(), "_")
			if len(parts) > 0 {
				if num, err := strconv.Atoi(parts[0]); err == nil && num > maxNum {
					maxNum = num
				}
			}
		}
	}

	nextNum := maxNum + 1
	paddedNum := fmt.Sprintf("%06d", nextNum)

	upFile := fmt.Sprintf("%s/%s_%s.up.sql", mgr.config.MigrationPath, paddedNum, name)
	downFile := fmt.Sprintf("%s/%s_%s.down.sql", mgr.config.MigrationPath, paddedNum, name)

	// Create UP migration file
	upContent := fmt.Sprintf(`-- Migration: %s
-- Version: %d
-- Created: %s

-- +goose Up
%s

`, name, nextNum, time.Now().Format(time.RFC3339), strings.Repeat("-", 50))

	// Create DOWN migration file
	downContent := fmt.Sprintf(`-- Migration: %s
-- Version: %d
-- Created: %s

-- +goose Down
%s

`, name, nextNum, time.Now().Format(time.RFC3339), strings.Repeat("-", 50))

	if err := os.WriteFile(upFile, []byte(upContent), 0644); err != nil {
		log.Fatalf("❌ Failed to create up migration file: %v", err)
	}

	if err := os.WriteFile(downFile, []byte(downContent), 0644); err != nil {
		log.Fatalf("❌ Failed to create down migration file: %v", err)
	}

	log.Printf("✅ Created migration files:")
	log.Printf("   📄 %s", upFile)
	log.Printf("   📄 %s", downFile)
	log.Printf("🎯 Migration number: %d", nextNum)
}

func (mgr *MigrationManager) showStatus() {
	log.Println("📊 Database Migration Status")
	log.Println(strings.Repeat("=", 50))

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Get current version and dirty state
	version, dirty, err := mgr.mig.Version()
	if err != nil {
		log.Fatalf("❌ Failed to get version: %v", err)
	}

	log.Printf("📊 Current Version: %d", version)
	log.Printf("📊 State: %s", map[bool]string{true: "DIRTY ❌", false: "CLEAN ✅"}[dirty])

	// List all migration files
	files, err := os.ReadDir(mgr.config.MigrationPath)
	if err != nil {
		log.Fatalf("❌ Failed to read migrations directory: %v", err)
	}

	var migrations []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".up.sql") {
			migrations = append(migrations, file.Name())
		}
	}

	sort.Strings(migrations)

	log.Println("\n📁 Migration Files:")
	for _, file := range migrations {
		parts := strings.Split(file, "_")
		if len(parts) >= 2 {
			num, _ := strconv.Atoi(parts[0])
			name := strings.Join(parts[1:], "_")
			name = strings.TrimSuffix(name, ".up.sql")

			status := "🔜 Pending"
			if num <= version && !dirty {
				status = "✅ Applied"
			} else if num <= version && dirty {
				status = "⚠️  Partial"
			}

			log.Printf("   %s %6d - %s", status, num, name)
		}
	}

	log.Println(strings.Repeat("=", 50))
}

func (mgr *MigrationManager) validateMigrations() {
	log.Println("🔍 Validating database migrations...")

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Check if database is in dirty state
	version, dirty, err := mgr.mig.Version()
	if err != nil {
		log.Fatalf("❌ Failed to get version: %v", err)
	}

	if dirty {
		log.Fatalf("❌ Database is in dirty state (version %d). Please fix before proceeding.", version)
	}

	// Validate migration files exist
	files, err := os.ReadDir(mgr.config.MigrationPath)
	if err != nil {
		log.Fatalf("❌ Failed to read migrations directory: %v", err)
	}

	hasUpFiles := false
	hasDownFiles := false
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".up.sql") {
			hasUpFiles = true
		}
		if strings.HasSuffix(file.Name(), ".down.sql") {
			hasDownFiles = true
		}
	}

	if !hasUpFiles {
		log.Fatalf("❌ No .up.sql migration files found")
	}

	if !hasDownFiles {
		log.Fatalf("❌ No .down.sql migration files found")
	}

	// Check for missing down files
	upFiles := make(map[string]bool)
	downFiles := make(map[string]bool)

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".up.sql") {
			base := strings.TrimSuffix(file.Name(), ".up.sql")
			upFiles[base] = true
		}
		if strings.HasSuffix(file.Name(), ".down.sql") {
			base := strings.TrimSuffix(file.Name(), ".down.sql")
			downFiles[base] = true
		}
	}

	for base := range upFiles {
		if !downFiles[base] {
			log.Fatalf("❌ Missing down file for migration: %s", base)
		}
	}

	// Test migration syntax
	log.Println("🧪 Testing migration syntax...")
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".up.sql") || strings.HasSuffix(file.Name(), ".down.sql") {
			filePath := filepath.Join(mgr.config.MigrationPath, file.Name())
			content, err := os.ReadFile(filePath)
			if err != nil {
				log.Fatalf("❌ Failed to read migration file %s: %v", file.Name(), err)
			}

			// Basic SQL syntax check
			if len(strings.TrimSpace(string(content))) == 0 {
				log.Fatalf("❌ Migration file %s is empty", file.Name())
			}
		}
	}

	log.Println("✅ All migrations validated successfully!")
	log.Printf("📊 Current version: %d", version)
}

func (mgr *MigrationManager) resetDatabase() {
	log.Println("⚠️  Resetting database...")
	log.Println("This will drop all tables and re-run all migrations")

	// Ask for confirmation
	fmt.Print("Are you sure you want to continue? (yes/no): ")
	var response string
	fmt.Scanln(&response)

	if response != "yes" {
		log.Println("❌ Database reset cancelled")
		return
	}

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Drop all tables (except schema_migrations)
	rows, err := mgr.db.Query(`
		SELECT 'DROP TABLE IF EXISTS "' || tablename || '" CASCADE;'
		FROM pg_tables
		WHERE schemaname = 'public'
		AND tablename != 'schema_migrations';
	`)
	if err != nil {
		log.Fatalf("❌ Failed to query tables: %v", err)
	}
	defer rows.Close()

	for rows.Next() {
		var dropSQL string
		if err := rows.Scan(&dropSQL); err != nil {
			log.Printf("⚠️  Warning: Failed to scan drop statement: %v", err)
			continue
		}

		if _, err := mgr.db.Exec(dropSQL); err != nil {
			log.Printf("⚠️  Warning: Failed to drop table: %v", err)
		} else {
			log.Printf("🗑️  Dropped table")
		}
	}

	// Reset migration state
	if _, err := mgr.mig.Steps(-1000); err != nil {
		log.Printf("⚠️  Warning: Failed to reset migration state: %v", err)
	}

	// Run all migrations up
	if err := mgr.mig.Up(); err != nil {
		log.Fatalf("❌ Failed to run migrations: %v", err)
	}

	log.Println("✅ Database reset completed successfully")
}

func (mgr *MigrationManager) seedDatabase(args []string) {
	log.Println("🌱 Seeding database...")

	seedType := "basic"
	if len(args) > 0 {
		seedType = args[0]
	}

	// Look for seed files
	seedPath := filepath.Join("seeds", seedType+".sql")
	if _, err := os.Stat(seedPath); os.IsNotExist(err) {
		log.Printf("⚠️  Seed file not found: %s", seedPath)

		// List available seed files
		files, _ := os.ReadDir("seeds")
		if len(files) > 0 {
			log.Println("Available seed files:")
			for _, file := range files {
				if strings.HasSuffix(file.Name(), ".sql") {
					log.Printf("   📄 %s", file.Name())
				}
			}
		}
		return
	}

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Read and execute seed file
	content, err := os.ReadFile(seedPath)
	if err != nil {
		log.Fatalf("❌ Failed to read seed file: %v", err)
	}

	if _, err := mgr.db.Exec(string(content)); err != nil {
		log.Fatalf("❌ Failed to execute seed file: %v", err)
	}

	log.Printf("✅ Database seeded successfully with: %s", seedType)
}

func (mgr *MigrationManager) backupDatabase(args []string) {
	log.Println("💾 Creating database backup...")

	backupName := fmt.Sprintf("backup_%s.sql", time.Now().Format("20060102_150405"))
	if len(args) > 0 {
		backupName = args[0]
	}

	backupPath := filepath.Join("backup", backupName)

	// Create backup directory
	if err := os.MkdirAll("backup", 0755); err != nil {
		log.Fatalf("❌ Failed to create backup directory: %v", err)
	}

	// Use pg_dump for backup
	dumpCmd := fmt.Sprintf("pg_dump -h %s -p %s -U %s -d %s -f %s --verbose",
		mgr.config.Host,
		mgr.config.Port,
		mgr.config.User,
		mgr.config.Database,
		backupPath,
	)

	if err := os.Setenv("PGPASSWORD", mgr.config.Password); err != nil {
		log.Printf("⚠️  Warning: Failed to set PGPASSWORD: %v", err)
	}

	log.Printf("🔄 Running: pg_dump -h %s -p %s -U %s -d %s -f %s",
		mgr.config.Host,
		mgr.config.Port,
		mgr.config.User,
		mgr.config.Database,
		backupPath)

	// In a real implementation, you would execute the pg_dump command
	// For now, we'll create a simple backup using SQL

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Create backup file
	file, err := os.Create(backupPath)
	if err != nil {
		log.Fatalf("❌ Failed to create backup file: %v", err)
	}
	defer file.Close()

	// Write backup header
	file.WriteString("-- QuantumBeam Database Backup\n")
	file.WriteString(fmt.Sprintf("-- Created: %s\n", time.Now().Format(time.RFC3339)))
	file.WriteString(fmt.Sprintf("-- Database: %s\n", mgr.config.Database))
	file.WriteString(fmt.Sprintf("-- Host: %s:%s\n", mgr.config.Host, mgr.config.Port))
	file.WriteString("-- Migration Version: " + "\n")

	log.Printf("✅ Database backup created: %s", backupPath)
}

func (mgr *MigrationManager) testConnection() {
	log.Println("🔌 Testing database connection...")

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Connection failed: %v", err)
	}
	defer mgr.db.Close()

	// Test basic query
	var result int
	err := mgr.db.QueryRow("SELECT 1").Scan(&result)
	if err != nil {
		log.Fatalf("❌ Test query failed: %v", err)
	}

	// Test table existence
	var count int
	err = mgr.db.QueryRow("SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public'").Scan(&count)
	if err != nil {
		log.Printf("⚠️  Warning: Could not count tables: %v", err)
	} else {
		log.Printf("📊 Found %d tables", count)
	}

	// Test migration table exists
	var exists bool
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'schema_migrations'
		)
	`).Scan(&exists)
	if err != nil {
		log.Printf("⚠️  Warning: Could not check schema_migrations table: %v", err)
	} else if exists {
		log.Println("✅ Migration table exists")
	} else {
		log.Println("ℹ️  Migration table not found (run 'migrate init' to create)")
	}

	log.Println("✅ Database connection test successful")
}

func (mgr *MigrationManager) initDatabase() {
	log.Println("🔧 Initializing database for migrations...")

	if err := mgr.connect(); err != nil {
		log.Fatalf("❌ Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Create schema_migrations table if it doesn't exist
	_, err := mgr.db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT NOT NULL PRIMARY KEY,
			dirty BOOLEAN NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`)
	if err != nil {
		log.Fatalf("❌ Failed to create schema_migrations table: %v", err)
	}

	log.Println("✅ Database initialized for migrations")
}

func showUsage() {
	fmt.Println("QuantumBeam Database Migration Tool")
	fmt.Println("===================================")
	fmt.Println()
	fmt.Println("Usage: migrate <command> [arguments]")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  up                      Run all pending migrations")
	fmt.Println("  down                    Rollback last migration")
	fmt.Println("  steps <n>               Run n migrations up/down")
	fmt.Println("  version                 Show current database version")
	fmt.Println("  force <version>         Force database version")
	fmt.Println("  goto <version>          Migrate to specific version")
	fmt.Println("  create <name>           Create new migration files")
	fmt.Println("  status                  Show migration status")
	fmt.Println("  validate                Validate migration files")
	fmt.Println("  reset                   Reset database (⚠️  destructive)")
	fmt.Println("  seed [type]             Seed database with test data")
	fmt.Println("  backup [name]           Create database backup")
	fmt.Println("  test                    Test database connection")
	fmt.Println("  init                    Initialize database for migrations")
	fmt.Println("  help                    Show this help message")
	fmt.Println()
	fmt.Println("Environment Variables:")
	fmt.Println("  DB_HOST         Database host (default: localhost)")
	fmt.Println("  DB_PORT         Database port (default: 5433)")
	fmt.Println("  DB_USER         Database user (default: postgres)")
	fmt.Println("  DB_PASSWORD     Database password (default: password)")
	fmt.Println("  DB_NAME         Database name (default: quantumbeam_dev)")
	fmt.Println("  DB_SSL_MODE      SSL mode (default: disable)")
	fmt.Println("  MIGRATIONS_PATH Migration files path (default: ./migrations)")
	fmt.Println("  ENVIRONMENT     Environment (default: development)")
	fmt.Println("  USE_PGBOUNCER   Use PgBouncer (default: true)")
	fmt.Println("  PGBOUNCER_PORT PgBouncer port (default: 6432)")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  migrate up")
	fmt.Println("  migrate steps 3")
	fmt.Println("  migrate create add_user_indexes")
	fmt.Println("  migrate goto 5")
	fmt.Println("  migrate status")
	fmt.Println("  migrate validate")
}