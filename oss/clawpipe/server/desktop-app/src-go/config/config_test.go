package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDefault(t *testing.T) {
	cfg := Default()

	if cfg.Server.Host != "localhost" {
		t.Errorf("Server.Host = %q, want %q", cfg.Server.Host, "localhost")
	}
	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want %d", cfg.Server.Port, 8080)
	}
	if cfg.Cluster.MasterHost != "localhost" {
		t.Errorf("Cluster.MasterHost = %q, want %q", cfg.Cluster.MasterHost, "localhost")
	}
	if cfg.Cluster.MasterPort != 8000 {
		t.Errorf("Cluster.MasterPort = %d, want %d", cfg.Cluster.MasterPort, 8000)
	}
	if cfg.Cluster.APIKey != "" {
		t.Errorf("Cluster.APIKey = %q, want empty", cfg.Cluster.APIKey)
	}
	if cfg.Cluster.Timeout != 30 {
		t.Errorf("Cluster.Timeout = %d, want %d", cfg.Cluster.Timeout, 30)
	}
	if cfg.UI.Theme != "dark" {
		t.Errorf("UI.Theme = %q, want %q", cfg.UI.Theme, "dark")
	}
	if cfg.UI.Language != "en" {
		t.Errorf("UI.Language = %q, want %q", cfg.UI.Language, "en")
	}
	if cfg.UI.AutoStart != false {
		t.Error("UI.AutoStart = true, want false")
	}
	if cfg.UI.MinimizeToTray != true {
		t.Error("UI.MinimizeToTray = false, want true")
	}
	if cfg.UI.ShowNotifications != true {
		t.Error("UI.ShowNotifications = false, want true")
	}
	if cfg.UI.RefreshInterval != 5 {
		t.Errorf("UI.RefreshInterval = %d, want %d", cfg.UI.RefreshInterval, 5)
	}
	if len(cfg.Profiles) != 1 {
		t.Fatalf("len(Profiles) = %d, want 1", len(cfg.Profiles))
	}
	if cfg.Profiles[0].Name != "default" {
		t.Errorf("Profiles[0].Name = %q, want %q", cfg.Profiles[0].Name, "default")
	}
	if cfg.Logging.Level != "info" {
		t.Errorf("Logging.Level = %q, want %q", cfg.Logging.Level, "info")
	}
	if cfg.Logging.Format != "json" {
		t.Errorf("Logging.Format = %q, want %q", cfg.Logging.Format, "json")
	}
}

func TestSave_WritesFile(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string {
		return filepath.Join(tmpDir, "subdir", "config.json")
	}
	defer func() { getConfigPathFunc = origFunc }()

	cfg := *Default()
	cfg.Server.Port = 9999

	if err := Save(cfg); err != nil {
		t.Fatalf("Save() error: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(tmpDir, "subdir", "config.json"))
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}

	var loaded Config
	if err := json.Unmarshal(data, &loaded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}
	if loaded.Server.Port != 9999 {
		t.Errorf("loaded.Server.Port = %d, want 9999", loaded.Server.Port)
	}
}

func TestSave_ReadRoundTrip(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string {
		return filepath.Join(tmpDir, "config.json")
	}
	defer func() { getConfigPathFunc = origFunc }()

	original := *Default()
	original.Cluster.APIKey = "test-key-123"
	original.UI.Theme = "light"

	if err := Save(original); err != nil {
		t.Fatalf("Save() error: %v", err)
	}

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	if loaded.Cluster.APIKey != "test-key-123" {
		t.Errorf("APIKey = %q, want %q", loaded.Cluster.APIKey, "test-key-123")
	}
	if loaded.UI.Theme != "light" {
		t.Errorf("Theme = %q, want %q", loaded.UI.Theme, "light")
	}
}

func TestLoad_MissingFile(t *testing.T) {
	tmpDir := t.TempDir()
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string {
		return filepath.Join(tmpDir, "nonexist", "config.json")
	}
	defer func() { getConfigPathFunc = origFunc }()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}

	// Should return defaults
	if cfg.Server.Host != "localhost" {
		t.Errorf("Server.Host = %q, want %q", cfg.Server.Host, "localhost")
	}

	// Should have created the file
	path := filepath.Join(tmpDir, "nonexist", "config.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("Expected config file to be created")
	}
}

func TestLoad_ValidFile(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	cfg := Config{
		Server:  ServerConfig{Host: "0.0.0.0", Port: 3000},
		Cluster: ClusterConfig{MasterHost: "remote", MasterPort: 9000, Timeout: 60},
		Logging: LoggingConfig{Level: "debug", Format: "text"},
	}
	data, _ := json.Marshal(cfg)
	os.WriteFile(cfgPath, data, 0644)

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if loaded.Server.Host != "0.0.0.0" {
		t.Errorf("Host = %q, want %q", loaded.Server.Host, "0.0.0.0")
	}
	if loaded.Cluster.MasterPort != 9000 {
		t.Errorf("MasterPort = %d, want 9000", loaded.Cluster.MasterPort)
	}
}

func TestLoad_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	os.WriteFile(cfgPath, []byte("{invalid json!!!"), 0644)

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error for invalid JSON, got nil")
	}
}

func TestGetConfigPath(t *testing.T) {
	// Just ensure it doesn't panic and returns a non-empty string
	path := getConfigPath()
	if path == "" {
		t.Error("getConfigPath() returned empty string")
	}
}
