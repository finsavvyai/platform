//go:build legacy_migrated
// +build legacy_migrated

package main

import (
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
)

// Test Configuration
const (
	testDBHost         = "localhost"
	testDBPort         = "5433"
	testDBUser         = "postgres"
	testDBPassword     = "password"
	testDBName         = "quantumbeam_test"
	testMigrationsPath = "./test_migrations"
)

func TestLoadConfig(t *testing.T) {
	// Set environment variables for testing
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()

	if config.Host != testDBHost {
		t.Errorf("Expected host %s, got %s", testDBHost, config.Host)
	}

	if config.Port != testDBPort {
		t.Errorf("Expected port %s, got %s", testDBPort, config.Port)
	}

	if config.User != testDBUser {
		t.Errorf("Expected user %s, got %s", testDBUser, config.User)
	}

	if config.Database != testDBName {
		t.Errorf("Expected database %s, got %s", testDBName, config.Database)
	}

	if config.Environment != "testing" {
		t.Errorf("Expected environment %s, got %s", "testing", config.Environment)
	}
}

func TestConnect(t *testing.T) {
	// Setup test config
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// This will fail if the database is not running
	err := mgr.connect()
	if err != nil {
		t.Skipf("Database not available for testing: %v", err)
		return
	}
	defer mgr.db.Close()

	// Test that we can execute a simple query
	var result int
	err = mgr.db.QueryRow("SELECT 1").Scan(&result)
	if err != nil {
		t.Errorf("Failed to execute test query: %v", err)
	}

	if result != 1 {
		t.Errorf("Expected query result 1, got %d", result)
	}
}

func TestCreateMigration(t *testing.T) {
	// Setup test migrations directory
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create test migrations directory: %v", err)
	}
	defer os.RemoveAll(testMigrationsPath)

	// Setup test config
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)
	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Create a test migration
	testName := "test_migration"
	args := []string{testName}

	mgr.createMigration(args)

	// Check that files were created
	upFile := testMigrationsPath + "/000001_test_migration.up.sql"
	downFile := testMigrationsPath + "/000001_test_migration.down.sql"

	if _, err := os.Stat(upFile); os.IsNotExist(err) {
		t.Errorf("Up migration file was not created: %s", upFile)
	}

	if _, err := os.Stat(downFile); os.IsNotExist(err) {
		t.Errorf("Down migration file was not created: %s", downFile)
	}

	// Verify file contents
	upContent, err := os.ReadFile(upFile)
	if err != nil {
		t.Fatalf("Failed to read up migration file: %v", err)
	}

	downContent, err := os.ReadFile(downFile)
	if err != nil {
		t.Fatalf("Failed to read down migration file: %v", err)
	}

	upStr := string(upContent)
	downStr := string(downContent)

	if !contains(upStr, "Migration: "+testName) {
		t.Error("Up migration file does not contain proper header")
	}

	if !contains(downStr, "Migration: "+testName) {
		t.Error("Down migration file does not contain proper header")
	}

	if !contains(upStr, "+goose Up") {
		t.Error("Up migration file does not contain goose Up directive")
	}

	if !contains(downStr, "+goose Down") {
		t.Error("Down migration file does not contain goose Down directive")
	}
}

func TestMigrationUp(t *testing.T) {
	// Skip if database is not available
	if !isDatabaseAvailable() {
		t.Skip("Database not available for testing")
	}

	// Setup test config
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Create test migration
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create test migrations directory: %v", err)
	}
	defer os.RemoveAll(testMigrationsPath)

	testName := "test_table"
	mgr.createMigration([]string{testName})

	// Create proper migration content
	upFile := testMigrationsPath + "/000001_test_table.up.sql"
	downFile := testMigrationsPath + "/000001_test_table.down.sql"

	upSQL := `-- Migration: test_table
-- Version: 1
-- Created: 2023-01-01T00:00:00Z

-- +goose Up
CREATE TABLE IF NOT EXISTS test_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`

	downSQL := `-- Migration: test_table
-- Version: 1
-- Created: 2023-01-01T00:00:00Z

-- +goose Down
DROP TABLE IF EXISTS test_table;
`

	err = os.WriteFile(upFile, []byte(upSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write up migration: %v", err)
	}

	err = os.WriteFile(downFile, []byte(downSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write down migration: %v", err)
	}

	// Connect and run migration up
	err = mgr.connect()
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	err = mgr.mig.Up()
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run migration up: %v", err)
	}

	// Verify table exists
	var exists bool
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'test_table'
		)
	`).Scan(&exists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	if !exists {
		t.Error("Test table was not created by migration")
	}

	// Test inserting data
	var count int
	err = mgr.db.QueryRow("INSERT INTO test_table (name) VALUES ('test') RETURNING COUNT(*)").Scan(&count)
	if err != nil {
		t.Errorf("Failed to insert test data: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 row inserted, got %d", count)
	}
}

func TestMigrationDown(t *testing.T) {
	// Skip if database is not available
	if !isDatabaseAvailable() {
		t.Skip("Database not available for testing")
	}

	// Setup test config
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Setup test migration (reuse from previous test)
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create test migrations directory: %v", err)
	}
	defer os.RemoveAll(testMigrationsPath)

	// Create migration files
	upFile := testMigrationsPath + "/000001_test_rollback.up.sql"
	downFile := testMigrationsPath + "/000001_test_rollback.down.sql"

	upSQL := `-- Migration: test_rollback
-- Version: 1
-- Created: 2023-01-01T00:00:00Z

-- +goose Up
CREATE TABLE IF NOT EXISTS test_rollback (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
`

	downSQL := `-- Migration: test_rollback
-- Version: 1
-- Created: 2023-01-01T00:00:00Z

-- +goose Down
DROP TABLE IF EXISTS test_rollback;
`

	err = os.WriteFile(upFile, []byte(upSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write up migration: %v", err)
	}

	err = os.WriteFile(downFile, []byte(downSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write down migration: %v", err)
	}

	// Connect and run migration up
	err = mgr.connect()
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	err = mgr.mig.Up()
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run migration up: %v", err)
	}

	// Verify table exists
	var exists bool
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'test_rollback'
		)
	`).Scan(&exists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	if !exists {
		t.Error("Test table was not created by migration")
	}

	// Run migration down
	err = mgr.mig.Steps(-1)
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run migration down: %v", err)
	}

	// Verify table no longer exists
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'test_rollback'
		)
	`).Scan(&exists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	if exists {
		t.Error("Test table still exists after rollback")
	}
}

func TestMigrationSteps(t *testing.T) {
	// Skip if database is not available
	if !isDatabaseAvailable() {
		t.Skip("Database not available for testing")
	}

	// Setup test config
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Create multiple test migrations
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create test migrations directory: %v", err)
	}
	defer os.RemoveAll(testMigrationsPath)

	// Create first migration
	createTestMigration(t, testMigrationsPath, "000001", "first_table")
	// Create second migration
	createTestMigration(t, testMigrationsPath, "000002", "second_table")

	// Connect and run first migration
	err = mgr.connect()
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	err = mgr.mig.Steps(1)
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run first migration step: %v", err)
	}

	// Verify only first table exists
	var firstExists bool
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'first_table'
		)
	`).Scan(&firstExists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	var secondExists bool
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'second_table'
		)
	`).Scan(&secondExists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	if !firstExists {
		t.Error("First table should exist")
	}

	if secondExists {
		t.Error("Second table should not exist yet")
	}

	// Run second migration step
	err = mgr.mig.Steps(1)
	if err != nil && err != migrate.ErrNoChange {
		t.Fatalf("Failed to run second migration step: %v", err)
	}

	// Verify both tables exist
	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'first_table'
	)
	`).Scan(&firstExists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	err = mgr.db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'second_table'
		)
	`).Scan(&secondExists)
	if err != nil {
		t.Fatalf("Failed to check table existence: %v", err)
	}

	if !firstExists {
		t.Error("First table should exist")
	}

	if !secondExists {
		t.Error("Second table should exist")
	}
}

func TestValidateMigrations(t *testing.T) {
	// Setup test config
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Create test migrations directory with valid files
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create test migrations directory: %v", err)
	}
	defer os.RemoveAll(testMigrationsPath)

	// Create valid migration pair
	createTestMigration(t, testMigrationsPath, "000001", "valid_migration")

	// Test validation
	mgr.validateMigrations()
}

func TestValidateMigrationsWithMissingFiles(t *testing.T) {
	// Setup test config
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Create test migrations directory with only up file
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		t.Fatalf("Failed to create test migrations directory: %v", err)
	}
	defer os.RemoveAll(testMigrationsPath)

	// Create only up file (missing down file)
	upFile := testMigrationsPath + "/000001_incomplete.up.sql"
	upSQL := `-- +goose Up
CREATE TABLE test_table (id SERIAL PRIMARY KEY);`
	err = os.WriteFile(upFile, []byte(upSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write up migration: %v", err)
	}

	// Test validation should fail
	mgr := &MigrationManager{config: config}

	defer func() {
		if r := recover(); r != nil {
			t.Logf("Expected validation to fail: %v", r)
		}
	}()

	mgr.validateMigrations()
	t.Error("Validation should have failed due to missing down file")
}

func TestGetEnv(t *testing.T) {
	// Test with existing env var
	os.Setenv("TEST_VAR", "test_value")
	result := getEnv("TEST_VAR", "default")
	if result != "test_value" {
		t.Errorf("Expected 'test_value', got '%s'", result)
	}

	// Test with default value
	result = getEnv("NON_EXISTENT_VAR", "default")
	if result != "default" {
		t.Errorf("Expected 'default', got '%s'", result)
	}

	// Clean up
	os.Unsetenv("TEST_VAR")
}

func TestShowVersion(t *testing.T) {
	// Skip if database is not available
	if !isDatabaseAvailable() {
		t.Skip("Database not available for testing")
	}

	// Setup test config
	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	// Initialize database first
	err := mgr.connect()
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	// Initialize schema_migrations table
	mgr.initDatabase()

	// Test show version
	version, dirty, err := mgr.mig.Version()
	if err != nil {
		t.Fatalf("Failed to get version: %v", err)
	}

	if dirty {
		t.Error("Database should not be dirty after initialization")
	}

	if version < 0 {
		t.Errorf("Version should be >= 0, got %d", version)
	}
}

// Helper functions
func contains(s, substr string) bool {
	return len(s) > 0 && s[0:len(substr)] == substr
}

func createTestMigration(t *testing.T, path string, number, name string) {
	upFile := path + "/" + number + "_" + name + ".up.sql"
	downFile := path + "/" + number + "_" + name + ".down.sql"

	upSQL := fmt.Sprintf(`-- Migration: %s
-- Version: %s
-- Created: 2023-01-01T00:00:00Z

-- +goose Up
CREATE TABLE IF NOT EXISTS %s (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`, name, number, name)

	downSQL := fmt.Sprintf(`-- Migration: %s
-- Version: %s
-- Created: 2023-01-01T00:00:00Z

-- +goose Down
DROP TABLE IF EXISTS %s;
`, name, number, name)

	err := os.WriteFile(upFile, []byte(upSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write up migration: %v", err)
	}

	err = os.WriteFile(downFile, []byte(downSQL), 0644)
	if err != nil {
		t.Fatalf("Failed to write down migration: %v", err)
	}
}

func isDatabaseAvailable() bool {
	databaseURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		testDBUser, testDBPassword, testDBHost, testDBPort, testDBName)

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return false
	}
	defer db.Close()

	err = db.Ping()
	return err == nil
}

// Benchmark tests
func BenchmarkMigrationUp(b *testing.B) {
	if !isDatabaseAvailable() {
		b.Skip("Database not available for benchmarking")
	}

	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	b.ResetTimer()

	// Create test migration
	err := os.MkdirAll(testMigrationsPath, 0755)
	if err != nil {
		b.Fatalf("Failed to create test migrations directory: %v", err)
	}

	createTestMigration(&testing.T{}, testMigrationsPath, "000001", "bench_table")

	err = mgr.connect()
	if err != nil {
		b.Fatalf("Failed to connect: %v", err)
	}
	defer mgr.db.Close()

	b.StartTimer()
	err = mgr.mig.Up()
	b.StopTimer()

	if err != nil && err != migrate.ErrNoChange {
		b.Fatalf("Migration failed: %v", err)
	}
}

func BenchmarkConnect(b *testing.B) {
	if !isDatabaseAvailable() {
		b.Skip("Database not available for benchmarking")
	}

	os.Setenv("DB_HOST", testDBHost)
	os.Setenv("DB_PORT", testDBPort)
	os.Setenv("DB_USER", testDBUser)
	os.Setenv("DB_PASSWORD", testDBPassword)
	os.Setenv("DB_NAME", testDBName)
	os.Setenv("ENVIRONMENT", "testing")
	os.Setenv("USE_PGBOUNCER", "false")
	os.Setenv("MIGRATIONS_PATH", testMigrationsPath)

	config := loadConfig()
	mgr := &MigrationManager{config: config}

	b.ResetTimer()
	err := mgr.connect()
	b.StopTimer()

	if err != nil {
		b.Fatalf("Connection failed: %v", err)
	}

	defer mgr.db.Close()
}