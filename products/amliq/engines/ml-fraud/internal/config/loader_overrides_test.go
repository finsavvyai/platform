package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func newBaseConfig() *Config {
	cfg, _ := GenerateConfigTemplate()
	return cfg
}

func TestApplyProductionOverrides(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Environment.Debug = true
	cfg.Logging.Level = "debug"
	cfg.Server.TLS.Enabled = false
	cfg.Database.SSLMode = "disable"
	cfg.Database.MaxConnections = 10
	cfg.Monitoring.Tracing.SampleRate = 0.5

	err := applyProductionOverrides(cfg)
	assert.NoError(t, err)
	assert.False(t, cfg.Environment.Debug, "debug should be disabled in production")
	assert.Equal(t, "info", cfg.Logging.Level, "log level should be info in production")
	assert.True(t, cfg.Server.TLS.Enabled, "TLS should be enabled")
	assert.Equal(t, "require", cfg.Database.SSLMode, "SSL should be required")
	assert.Equal(t, 50, cfg.Database.MaxConnections, "min 50 connections")
	assert.Equal(t, 0.01, cfg.Monitoring.Tracing.SampleRate)
	assert.False(t, cfg.Database.EnableQueryLogger)
	assert.False(t, cfg.Monitoring.Profiling.Enabled)
}

func TestApplyStagingOverrides(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Environment.Debug = true
	cfg.Logging.Level = "debug"
	cfg.Server.TLS.Enabled = false
	cfg.Database.SSLMode = "disable"
	cfg.Monitoring.Tracing.SampleRate = 0.5

	err := applyStagingOverrides(cfg)
	assert.NoError(t, err)
	assert.False(t, cfg.Environment.Debug)
	assert.Equal(t, "info", cfg.Logging.Level)
	assert.True(t, cfg.Server.TLS.Enabled)
	assert.Equal(t, "require", cfg.Database.SSLMode)
	assert.Equal(t, 0.1, cfg.Monitoring.Tracing.SampleRate)
	assert.True(t, cfg.Database.EnableQueryLogger)
	assert.True(t, cfg.Monitoring.Profiling.Enabled)
}

func TestApplyDevelopmentOverrides(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Environment.Debug = false
	cfg.Logging.Level = "info"
	cfg.Server.TLS.Enabled = true
	cfg.Database.SSLMode = "require"
	cfg.Security.Session.Secure = true

	err := applyDevelopmentOverrides(cfg)
	assert.NoError(t, err)
	assert.True(t, cfg.Environment.Debug)
	assert.Equal(t, "debug", cfg.Logging.Level)
	assert.False(t, cfg.Server.TLS.Enabled)
	assert.Equal(t, "disable", cfg.Database.SSLMode)
	assert.False(t, cfg.Security.Session.Secure)
	assert.True(t, cfg.Database.EnableQueryLogger)
	assert.Equal(t, 1.0, cfg.Monitoring.Tracing.SampleRate)
	assert.False(t, cfg.Security.RateLimit.Enabled)
}

func TestApplyEnvironmentOverrides_UnknownEnv(t *testing.T) {
	cfg := newBaseConfig()
	err := applyEnvironmentOverrides(cfg, "unknown")
	assert.NoError(t, err)
}

func TestApplyEnvironmentOverrides_AllEnvs(t *testing.T) {
	envs := []string{"production", "staging", "development"}
	for _, env := range envs {
		t.Run(env, func(t *testing.T) {
			cfg := newBaseConfig()
			err := applyEnvironmentOverrides(cfg, env)
			assert.NoError(t, err)
		})
	}
}

func TestLoadSecretsFromEnv(t *testing.T) {
	cfg := newBaseConfig()
	t.Setenv("DB_PASSWORD", "secret_db_pass")
	t.Setenv("REDIS_PASSWORD", "secret_redis_pass")
	t.Setenv("JWT_SECRET", "secret_jwt_key")
	t.Setenv("AI_API_KEY", "sk-test-ai-key")
	t.Setenv("QUANTUM_API_KEY", "quantum_key_123")
	t.Setenv("WEBHOOK_SECRET", "whsec_test")

	loadSecretsFromEnv(cfg)
	assert.Equal(t, "secret_db_pass", cfg.Database.Password)
	assert.Equal(t, "secret_redis_pass", cfg.Redis.Password)
	assert.Equal(t, "secret_jwt_key", cfg.Security.JWT.Secret)
	assert.Equal(t, "sk-test-ai-key", cfg.AI.APIKey)
	assert.Equal(t, "quantum_key_123", cfg.Quantum.APIKey)
	assert.Equal(t, "whsec_test", cfg.Webhook.Secret)
}

func TestPostProcessConfig_SetsInstanceID(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Environment.InstanceID = ""
	err := postProcessConfig(cfg)
	assert.NoError(t, err)
	assert.NotEmpty(t, cfg.Environment.InstanceID)
}

func TestPostProcessConfig_SetsBuildTime(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Environment.BuildTime = ""
	err := postProcessConfig(cfg)
	assert.NoError(t, err)
	assert.NotEmpty(t, cfg.Environment.BuildTime)
}

func TestPostProcessConfig_DefaultPorts(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Server.Port = 0
	cfg.Monitoring.Metrics.Port = 0
	cfg.Monitoring.HealthCheck.Port = 0
	cfg.Monitoring.Profiling.Port = 0

	err := postProcessConfig(cfg)
	assert.NoError(t, err)
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, 9090, cfg.Monitoring.Metrics.Port)
	assert.Equal(t, 8081, cfg.Monitoring.HealthCheck.Port)
	assert.Equal(t, 6060, cfg.Monitoring.Profiling.Port)
}

func TestPostProcessConfig_TLSPort(t *testing.T) {
	cfg := newBaseConfig()
	cfg.Server.Port = 0
	cfg.Server.TLS.Enabled = true

	err := postProcessConfig(cfg)
	assert.NoError(t, err)
	assert.Equal(t, 443, cfg.Server.Port)
}

func TestPostProcessConfig_AIEndpoint(t *testing.T) {
	cfg := newBaseConfig()
	cfg.AI.Endpoint = ""
	cfg.AI.Provider = "openai"

	err := postProcessConfig(cfg)
	assert.NoError(t, err)
	assert.Equal(t, "https://api.openai.com/v1", cfg.AI.Endpoint)
}

func TestGenerateConfigTemplate(t *testing.T) {
	cfg, err := GenerateConfigTemplate()
	assert.NoError(t, err)
	assert.NotNil(t, cfg)
	assert.Equal(t, "development", cfg.Environment.Name)
	assert.Equal(t, 8080, cfg.Server.Port)
	assert.Equal(t, 30*time.Second, cfg.Server.ReadTimeout)
	assert.Equal(t, "localhost", cfg.Database.Host)
	assert.Equal(t, 5432, cfg.Database.Port)
	assert.Equal(t, true, cfg.AI.Enabled)
	assert.Equal(t, "gpt-4", cfg.AI.Model)
}
