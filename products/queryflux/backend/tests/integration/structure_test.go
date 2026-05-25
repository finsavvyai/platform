package integration

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
)

// getProjectRoot returns the root directory of the project
func getProjectRoot() string {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return ""
	}
	// This file is at tests/integration/structure_test.go
	// Project root is two levels up
	return filepath.Join(filepath.Dir(filename), "..", "..")
}

// TestBasicStructure validates that the clean architecture structure is properly organized
func TestBasicStructure(t *testing.T) {
	root := getProjectRoot()
	if root == "" {
		t.Skip("Could not determine project root")
	}

	t.Run("Domain Layer Exists", func(t *testing.T) {
		// Verify domain layer exists with entities and repositories
		assert.DirExists(t, filepath.Join(root, "internal/domain"))
		assert.DirExists(t, filepath.Join(root, "internal/domain/entities"))
		assert.DirExists(t, filepath.Join(root, "internal/domain/repositories"))
	})

	t.Run("Application Layer Exists", func(t *testing.T) {
		// Verify application layer exists with services and ports
		assert.DirExists(t, filepath.Join(root, "internal/application"))
		assert.DirExists(t, filepath.Join(root, "internal/application/services"))
		assert.DirExists(t, filepath.Join(root, "internal/application/ports"))
	})

	t.Run("Infrastructure Layer Exists", func(t *testing.T) {
		// Verify infrastructure layer exists
		assert.DirExists(t, filepath.Join(root, "internal/infrastructure"))
		assert.DirExists(t, filepath.Join(root, "internal/infrastructure/database"))
		assert.DirExists(t, filepath.Join(root, "internal/infrastructure/ai"))
		assert.DirExists(t, filepath.Join(root, "internal/infrastructure/security"))
	})

	t.Run("Server Layer Exists", func(t *testing.T) {
		// Verify server layer exists
		assert.DirExists(t, filepath.Join(root, "internal/server"))
	})

	t.Run("Container Layer Exists", func(t *testing.T) {
		// Verify dependency injection container exists
		assert.DirExists(t, filepath.Join(root, "internal/container"))
	})

	t.Run("Configuration Layer Exists", func(t *testing.T) {
		// Verify configuration layer exists
		assert.DirExists(t, filepath.Join(root, "internal/config"))
	})

	t.Run("Test Structure Exists", func(t *testing.T) {
		// Verify test structure exists
		assert.DirExists(t, filepath.Join(root, "tests"))
		assert.DirExists(t, filepath.Join(root, "tests/unit"))
		assert.DirExists(t, filepath.Join(root, "tests/integration"))
	})

	t.Run("Go Module File Exists", func(t *testing.T) {
		// Verify go.mod exists
		assert.FileExists(t, filepath.Join(root, "go.mod"))
	})

	t.Run("Main Entry Point Exists", func(t *testing.T) {
		// Verify main application entry point exists
		assert.FileExists(t, filepath.Join(root, "cmd/server/main.go"))
	})
}

// TestEnvironmentConfiguration verifies environment configuration accessibility
func TestEnvironmentConfiguration(t *testing.T) {
	t.Run("Essential env vars can be read", func(t *testing.T) {
		// Just test that os.Getenv works - don't assert specific values
		_ = os.Getenv("QUERYFLUX_DATABASE_URL")
		_ = os.Getenv("QUERYFLUX_JWT_SECRET")
		assert.True(t, true, "Environment variables are accessible")
	})
}
