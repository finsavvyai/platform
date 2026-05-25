package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadReadsBaseConfigAndLegacyShutdownTimeout(t *testing.T) {
	t.Setenv("ENV", "")
	t.Setenv("GO_ENV", "")
	t.Setenv("APP_ENV", "")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")

	tempDir := t.TempDir()
	writeConfigFile(t, tempDir, "config.yaml", `
server:
  port: 9191
  shutdown_timeout: "45s"
database:
  host: "db.internal"
  user: "postgres"
  database: "gateway"
jwt:
  secret: "${JWT_SECRET}"
`)

	changeDirectory(t, tempDir)

	cfg, err := Load("")
	if err != nil {
		t.Fatalf("expected config to load, got error: %v", err)
	}

	if cfg.Server.Port != 9191 {
		t.Fatalf("expected port 9191 from config.yaml, got %d", cfg.Server.Port)
	}

	if cfg.Server.GracefulShutdownTimeout != 45*time.Second {
		t.Fatalf("expected legacy shutdown timeout to map to graceful shutdown timeout, got %v", cfg.Server.GracefulShutdownTimeout)
	}

	if cfg.Database.Host != "db.internal" {
		t.Fatalf("expected database host from config.yaml, got %q", cfg.Database.Host)
	}

	if cfg.JWT.Secret != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("expected JWT secret to expand from environment, got %q", cfg.JWT.Secret)
	}
}

func TestLoadMergesEnvironmentOverride(t *testing.T) {
	t.Setenv("ENV", "")
	t.Setenv("GO_ENV", "")
	t.Setenv("APP_ENV", "production")
	t.Setenv("DB_HOST", "prod-db.internal")
	t.Setenv("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz012345")

	tempDir := t.TempDir()
	writeConfigFile(t, tempDir, "config.yaml", `
server:
  port: 8080
database:
  host: "${DB_HOST}"
  user: "postgres"
  database: "gateway"
jwt:
  secret: "${JWT_SECRET}"
environment: "development"
`)
	writeConfigFile(t, tempDir, "config.production.yaml", `
server:
  port: 9443
environment: "production"
`)

	changeDirectory(t, tempDir)

	cfg, err := Load("")
	if err != nil {
		t.Fatalf("expected merged config to load, got error: %v", err)
	}

	if cfg.Server.Port != 9443 {
		t.Fatalf("expected production override port 9443, got %d", cfg.Server.Port)
	}

	if cfg.Environment != "production" {
		t.Fatalf("expected runtime environment to be production, got %q", cfg.Environment)
	}

	if cfg.Database.Host != "prod-db.internal" {
		t.Fatalf("expected database host to expand from environment, got %q", cfg.Database.Host)
	}
}

func TestLoadRejectsDefaultProductionJWTSecret(t *testing.T) {
	t.Setenv("ENV", "")
	t.Setenv("GO_ENV", "")
	t.Setenv("APP_ENV", "production")

	tempDir := t.TempDir()
	writeConfigFile(t, tempDir, "config.yaml", `
database:
  host: "db.internal"
  user: "postgres"
  database: "gateway"
jwt:
  secret: "your-super-secret-jwt-key-change-this-in-production"
`)

	changeDirectory(t, tempDir)

	if _, err := Load(""); err == nil {
		t.Fatal("expected production config with default JWT secret to fail validation")
	}
}

func writeConfigFile(t *testing.T, dir, name, contents string) {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func changeDirectory(t *testing.T, dir string) {
	t.Helper()

	currentDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}

	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir %s: %v", dir, err)
	}

	t.Cleanup(func() {
		if err := os.Chdir(currentDir); err != nil {
			t.Fatalf("restore chdir: %v", err)
		}
	})
}
