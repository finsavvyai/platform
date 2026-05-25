package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMergeConfigs_OverrideEnvironment(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}
	override.Environment.Name = "production"
	override.Environment.Region = "eu-west-1"

	merged := MergeConfigs(base, override)
	assert.Equal(t, "production", merged.Environment.Name)
	assert.Equal(t, "eu-west-1", merged.Environment.Region)
	assert.Equal(t, base.Server.Port, merged.Server.Port)
}

func TestMergeConfigs_OverrideServer(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}
	override.Server.Host = "192.168.1.1"
	override.Server.Port = 9090

	merged := MergeConfigs(base, override)
	assert.Equal(t, "192.168.1.1", merged.Server.Host)
	assert.Equal(t, 9090, merged.Server.Port)
}

func TestMergeConfigs_OverrideDatabase(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}
	override.Database.Host = "db.prod.internal"
	override.Database.Port = 5433
	override.Database.User = "app_user"
	override.Database.Password = "secret123"
	override.Database.DBName = "prod_db"

	merged := MergeConfigs(base, override)
	assert.Equal(t, "db.prod.internal", merged.Database.Host)
	assert.Equal(t, 5433, merged.Database.Port)
	assert.Equal(t, "app_user", merged.Database.User)
	assert.Equal(t, "secret123", merged.Database.Password)
	assert.Equal(t, "prod_db", merged.Database.DBName)
}

func TestMergeConfigs_OverrideSecurity(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}
	override.Security.JWT.Secret = "new-secret"

	merged := MergeConfigs(base, override)
	assert.Equal(t, "new-secret", merged.Security.JWT.Secret)
}

func TestMergeConfigs_OverrideLogging(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}
	override.Logging.Level = "error"
	override.Logging.Format = "text"

	merged := MergeConfigs(base, override)
	assert.Equal(t, "error", merged.Logging.Level)
	assert.Equal(t, "text", merged.Logging.Format)
}

func TestMergeConfigs_OverrideAI(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}
	override.AI.Provider = "anthropic"
	override.AI.Model = "claude-3"
	override.AI.APIKey = "sk-ant-test"

	merged := MergeConfigs(base, override)
	assert.Equal(t, "anthropic", merged.AI.Provider)
	assert.Equal(t, "claude-3", merged.AI.Model)
	assert.Equal(t, "sk-ant-test", merged.AI.APIKey)
}

func TestMergeConfigs_EmptyOverride(t *testing.T) {
	base := newBaseConfig()
	override := &Config{}

	merged := MergeConfigs(base, override)
	assert.Equal(t, base.Server.Port, merged.Server.Port)
	assert.Equal(t, base.Database.Host, merged.Database.Host)
}

func TestSaveConfig(t *testing.T) {
	cfg := newBaseConfig()
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test-config.yaml")

	err := SaveConfig(cfg, filePath)
	assert.NoError(t, err)

	data, err := os.ReadFile(filePath)
	assert.NoError(t, err)
	assert.NotEmpty(t, data)
	assert.Contains(t, string(data), "host")
}

func TestSaveConfig_CreatesDirectory(t *testing.T) {
	cfg := newBaseConfig()
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "subdir", "nested", "config.yaml")

	err := SaveConfig(cfg, filePath)
	assert.NoError(t, err)

	_, err = os.Stat(filePath)
	assert.NoError(t, err)
}

func TestExportConfig_YAML(t *testing.T) {
	cfg := newBaseConfig()
	data, err := ExportConfig(cfg, "yaml")
	assert.NoError(t, err)
	assert.NotEmpty(t, data)
	assert.Contains(t, string(data), "host")
}

func TestExportConfig_JSON(t *testing.T) {
	cfg := newBaseConfig()
	data, err := ExportConfig(cfg, "json")
	assert.NoError(t, err)
	assert.NotEmpty(t, data)
}

func TestExportConfig_UnsupportedFormat(t *testing.T) {
	cfg := newBaseConfig()
	_, err := ExportConfig(cfg, "xml")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported export format")
}

func TestGetEnvironment(t *testing.T) {
	t.Setenv("QUANTUMBEAM_ENVIRONMENT", "staging")
	env := getEnvironment()
	assert.Equal(t, "staging", env)
}
