package main

import (
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func newTestLogger(t *testing.T) *logging.Logger {
	t.Helper()
	l, err := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	if err != nil {
		t.Fatalf("logging.New: %v", err)
	}
	return l
}

func TestInitVaultEnabled(t *testing.T) {
	cfg := &config.Config{}
	cfg.Vault.EncryptionKey = "test-master-key-must-be-32-bytes"
	v := initVault(cfg, newTestLogger(t))
	if v == nil || !v.Enabled() {
		t.Fatalf("expected enabled vault")
	}
}

func TestInitVaultDisabled(t *testing.T) {
	cfg := &config.Config{}
	cfg.Vault.EncryptionKey = "" // disabled
	v := initVault(cfg, newTestLogger(t))
	if v == nil || v.Enabled() {
		t.Fatalf("expected disabled vault when key empty")
	}
}

func TestBuildClaudeAnalyzerEnabled(t *testing.T) {
	cfg := &config.Config{}
	cfg.Analysis.ClaudeAPIKey = "sk-test-key-xxxx"
	cfg.Analysis.ClaudeModel = "claude-3-haiku"
	a := buildClaudeAnalyzer(cfg, newTestLogger(t))
	if a == nil || !a.Enabled() {
		t.Fatalf("expected enabled Claude analyzer")
	}
}

func TestBuildClaudeAnalyzerDisabled(t *testing.T) {
	cfg := &config.Config{}
	a := buildClaudeAnalyzer(cfg, newTestLogger(t))
	if a == nil {
		t.Fatalf("nil analyzer")
	}
	if a.Enabled() {
		t.Fatalf("analyzer should be disabled without API key")
	}
}

func TestBuildClaudeAnalyzerWithClawPipe(t *testing.T) {
	cfg := &config.Config{}
	cfg.Analysis.ClaudeAPIKey = "sk-test"
	cfg.Claw.APIKey = "claw-test"
	cfg.Claw.ProjectID = "proj-1"
	cfg.Claw.Endpoint = "https://claw.test/api"
	a := buildClaudeAnalyzer(cfg, newTestLogger(t))
	if a == nil {
		t.Fatalf("nil analyzer with claw")
	}
}

func TestLogIntegrationFlagsAllOff(t *testing.T) {
	// Should not panic with empty config.
	logIntegrationFlags(&config.Config{}, newTestLogger(t))
}

func TestLogIntegrationFlagsSlackEnabled(t *testing.T) {
	cfg := &config.Config{}
	cfg.SIEM.SlackWebhookURL = "https://hooks.slack.com/services/x/y/z"
	logIntegrationFlags(cfg, newTestLogger(t))
}

func TestLogIntegrationFlagsPushCIEnabled(t *testing.T) {
	cfg := &config.Config{}
	cfg.PushCI.APIKey = "k"
	logIntegrationFlags(cfg, newTestLogger(t))
}

func TestOpenDatabaseSQLiteOverride(t *testing.T) {
	cfg := &config.Config{}
	cfg.Database.Driver = "sqlite"
	dir := t.TempDir()
	db := openDatabase(cfg, dir+"/test.db", newTestLogger(t))
	if db == nil {
		t.Fatalf("db nil")
	}
	if db.Driver() != "sqlite" {
		t.Fatalf("driver: %q", db.Driver())
	}
	_ = db.Close()
}

func TestOpenDatabaseDefaultPath(t *testing.T) {
	cfg := &config.Config{}
	cfg.Database.Driver = "sqlite"
	cfg.Database.Path = t.TempDir() + "/cfg-path.db"
	db := openDatabase(cfg, "pipewarden.db", newTestLogger(t))
	if db == nil {
		t.Fatalf("db nil")
	}
	_ = db.Close()
}

// --- trace.go helpers ---
