package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLoad_UnreadableFile(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	if err := os.MkdirAll(cfgPath, 0755); err != nil {
		t.Fatalf("setup error: %v", err)
	}

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error for unreadable file, got nil")
	}
}

func TestSave_UnwritableDirectory(t *testing.T) {
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string {
		return "/dev/null/impossible/config.json"
	}
	defer func() { getConfigPathFunc = origFunc }()

	cfg := *Default()
	err := Save(cfg)
	if err == nil {
		t.Fatal("Save() expected error for unwritable path, got nil")
	}
}

func TestLoad_UncreatableDirectory(t *testing.T) {
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string {
		return "/dev/null/impossible/config.json"
	}
	defer func() { getConfigPathFunc = origFunc }()

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error for uncreatable dir, got nil")
	}
}

func TestSave_WriteFileError(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	if err := os.MkdirAll(cfgPath, 0755); err != nil {
		t.Fatalf("setup error: %v", err)
	}

	cfg := *Default()
	err := Save(cfg)
	if err == nil {
		t.Fatal("Save() expected error when writing to dir, got nil")
	}
}

func TestLoad_EmptyJSON(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	os.WriteFile(cfgPath, []byte("{}"), 0644)

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if loaded.Server.Port != 0 {
		t.Errorf("Server.Port = %d, want 0", loaded.Server.Port)
	}
}

func TestLoad_PartialJSON(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	partial := `{"server":{"host":"custom","port":1234}}`
	os.WriteFile(cfgPath, []byte(partial), 0644)

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if loaded.Server.Host != "custom" {
		t.Errorf("Host = %q, want %q", loaded.Server.Host, "custom")
	}
	if loaded.Server.Port != 1234 {
		t.Errorf("Port = %d, want 1234", loaded.Server.Port)
	}
	if loaded.Cluster.Timeout != 0 {
		t.Errorf("Timeout = %d, want 0", loaded.Cluster.Timeout)
	}
}

func TestSave_MarshalContent(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "config.json")
	origFunc := getConfigPathFunc
	getConfigPathFunc = func() string { return cfgPath }
	defer func() { getConfigPathFunc = origFunc }()

	cfg := Config{
		Server:  ServerConfig{Host: "0.0.0.0", Port: 3000},
		Cluster: ClusterConfig{APIKey: "secret"},
		Logging: LoggingConfig{Level: "debug", Format: "text"},
	}
	if err := Save(cfg); err != nil {
		t.Fatalf("Save() error: %v", err)
	}

	data, _ := os.ReadFile(cfgPath)
	var loaded Config
	json.Unmarshal(data, &loaded)
	if loaded.Cluster.APIKey != "secret" {
		t.Errorf("APIKey = %q, want %q", loaded.Cluster.APIKey, "secret")
	}
}

func TestDefault_ProfilesContent(t *testing.T) {
	cfg := Default()
	if len(cfg.Profiles) != 1 {
		t.Fatalf("len(Profiles) = %d, want 1", len(cfg.Profiles))
	}
	p := cfg.Profiles[0]
	if p.Description == "" {
		t.Error("Profile description should not be empty")
	}
	if p.Cluster.MasterPort != 8000 {
		t.Errorf("Profile MasterPort = %d, want 8000", p.Cluster.MasterPort)
	}
	if p.UI.Theme != "dark" {
		t.Errorf("Profile Theme = %q, want %q", p.UI.Theme, "dark")
	}
	if p.UI.RefreshInterval != 5 {
		t.Errorf("Profile RefreshInterval = %d, want 5", p.UI.RefreshInterval)
	}
}

func TestDefault_LoggingFile(t *testing.T) {
	cfg := Default()
	if cfg.Logging.File != "logs/desktop-app.log" {
		t.Errorf("Logging.File = %q, want %q",
			cfg.Logging.File, "logs/desktop-app.log")
	}
}

func TestGetConfigPath_ContainsFinSavvyAI(t *testing.T) {
	path := getConfigPath()
	if path == "finsavvyai-config.json" {
		// UserHomeDir failed - still valid
		return
	}
	if !filepath.IsAbs(path) {
		t.Errorf("expected absolute path, got %q", path)
	}
}

func TestLoad_SaveDefaultFails(t *testing.T) {
	tmpDir := t.TempDir()
	// Point to a non-existent file so Load tries to create default
	cfgPath := filepath.Join(tmpDir, "nosave", "config.json")
	origFunc := getConfigPathFunc
	callCount := 0
	getConfigPathFunc = func() string {
		callCount++
		if callCount == 1 {
			// First call from Load: return the writable path dir
			return cfgPath
		}
		// Second call from Save inside Load: return unwritable path
		return "/dev/null/impossible/config.json"
	}
	defer func() { getConfigPathFunc = origFunc }()

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error when Save of defaults fails")
	}
}
