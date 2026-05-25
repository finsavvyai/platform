package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func writeConfig(t *testing.T, dir string, yaml string) string {
	t.Helper()
	f := filepath.Join(dir, "config.yaml")
	require.NoError(t, os.WriteFile(f, []byte(yaml), 0644))
	return f
}

func TestLoadConfig_InvalidPort(t *testing.T) {
	dir := t.TempDir()
	f := writeConfig(t, dir, `
server:
  port: 0
llm:
  default_provider: p1
  providers:
    - name: p1
      type: ollama
      enabled: true
database:
  host: h
  user: u
  dbname: d
auth:
  enabled: false
`)
	cfg, err := LoadConfig(f)
	require.Error(t, err)
	require.Nil(t, cfg)
	require.Contains(t, err.Error(), "invalid server port")
}

func TestLoadConfig_DefaultProviderNotFound(t *testing.T) {
	dir := t.TempDir()
	f := writeConfig(t, dir, `
server:
  port: 8080
llm:
  default_provider: other
  providers:
    - name: p1
      type: ollama
      enabled: true
database:
  host: h
  user: u
  dbname: d
auth:
  enabled: false
`)
	cfg, err := LoadConfig(f)
	require.Error(t, err)
	require.Nil(t, cfg)
	require.Contains(t, err.Error(), "default provider")
	require.Contains(t, err.Error(), "not found")
}

func TestLoadConfig_MissingAPIKey(t *testing.T) {
	dir := t.TempDir()
	f := writeConfig(t, dir, `
server:
  port: 8080
llm:
  default_provider: p1
  providers:
    - name: p1
      type: openai
      api_key: ""
      enabled: true
database:
  host: h
  user: u
  dbname: d
auth:
  enabled: false
`)
	cfg, err := LoadConfig(f)
	require.Error(t, err)
	require.Nil(t, cfg)
	require.Contains(t, err.Error(), "API key is required")
}

func TestLoadConfig_AuthEnabledNoJWT(t *testing.T) {
	dir := t.TempDir()
	f := writeConfig(t, dir, `
server:
  port: 8080
llm:
  default_provider: p1
  providers:
    - name: p1
      type: ollama
      enabled: true
database:
  host: h
  user: u
  dbname: d
auth:
  enabled: true
  jwt_secret: ""
`)
	cfg, err := LoadConfig(f)
	require.Error(t, err)
	require.Nil(t, cfg)
	require.Contains(t, err.Error(), "JWT secret")
}

func TestLoadConfig_EmptyDatabaseHost(t *testing.T) {
	dir := t.TempDir()
	f := writeConfig(t, dir, `
server:
  port: 8080
llm:
  default_provider: p1
  providers:
    - name: p1
      type: ollama
      enabled: true
database:
  host: ""
  user: u
  dbname: d
auth:
  enabled: false
`)
	cfg, err := LoadConfig(f)
	require.Error(t, err)
	require.Nil(t, cfg)
	require.Contains(t, err.Error(), "database host")
}

func TestLoadConfig_DefaultsApplied(t *testing.T) {
	dir := t.TempDir()
	f := writeConfig(t, dir, `
server:
  port: 9000
llm:
  default_provider: p1
  providers:
    - name: p1
      type: ollama
      enabled: true
database:
  host: localhost
  user: u
  dbname: d
auth:
  enabled: false
`)
	cfg, err := LoadConfig(f)
	require.NoError(t, err)
	require.NotNil(t, cfg)
	require.Equal(t, 9000, cfg.Server.Port)
	require.Equal(t, "p1", cfg.LLM.DefaultProvider)
	require.True(t, cfg.LLM.EnableFailover)
	require.NotEmpty(t, cfg.Server.Host)
}
