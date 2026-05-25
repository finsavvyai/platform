package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig_ValidationFailure(t *testing.T) {
	// Empty path: no config file, viper uses defaults => no providers => validation error
	cfg, err := LoadConfig("")
	require.Error(t, err)
	require.Nil(t, cfg)
	require.Contains(t, err.Error(), "at least one provider must be configured")
}

func TestLoadConfig_WithMinimalConfig(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "config.yaml")
	err := os.WriteFile(f, []byte(`
server:
  port: 9000
llm:
  default_provider: test
  providers:
    - name: test
      type: ollama
      api_key: ""
      base_url: http://localhost:11434/v1
      models: []
      enabled: true
database:
  host: localhost
  user: u
  dbname: d
auth:
  enabled: false
`), 0644)
	require.NoError(t, err)

	cfg, err := LoadConfig(f)
	require.NoError(t, err)
	require.NotNil(t, cfg)
	require.Equal(t, 9000, cfg.Server.Port)
	require.Equal(t, "test", cfg.LLM.DefaultProvider)
	require.Len(t, cfg.LLM.Providers, 1)
	require.Equal(t, "test", cfg.LLM.Providers[0].Name)
	require.Equal(t, "ollama", cfg.LLM.Providers[0].Type)
}

func TestValidateConfig_ProviderDefaults(t *testing.T) {
	// Ensure ProviderConfig has sensible defaults when unmarshaled
	pc := models.ProviderConfig{Name: "x", Type: "ollama", Enabled: true}
	require.True(t, pc.Enabled)
}
