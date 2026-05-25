package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/queryflux/backend/internal/config"
)

func TestLoad(t *testing.T) {
	// Store original environment variables and restore them after test
	originalEnv := make(map[string]string)
	envVars := []string{
		"QUERYFLUX_PORT", "QUERYFLUX_HOST", "QUERYFLUX_LOG_LEVEL",
		"QUERYFLUX_DATABASE_URL", "QUERYFLUX_REDIS_URL", "QUERYFLUX_JWT_SECRET",
		"QUERYFLUX_OPENAI_API_KEY", "QUERYFLUX_CLAUDE_API_KEY", "QUERYFLUX_ENVIRONMENT",
	}

	for _, env := range envVars {
		if val := os.Getenv(env); val != "" {
			originalEnv[env] = val
		}
		os.Unsetenv(env)
	}
	defer func() {
		for env, val := range originalEnv {
			os.Setenv(env, val)
		}
		for _, env := range envVars {
			if _, exists := originalEnv[env]; !exists {
				os.Unsetenv(env)
			}
		}
	}()

	t.Run("Valid configuration with defaults", func(t *testing.T) {
		// Set minimal required environment variables
		os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")

		loadedConfig, err := config.Load()
		require.NoError(t, err)
		require.NotNil(t, loadedConfig)

		// Test default values
		assert.Equal(t, "8080", loadedConfig.Port)
		assert.Equal(t, "0.0.0.0", loadedConfig.Host)
		assert.Equal(t, "info", loadedConfig.LogLevel)
		assert.Equal(t, "development", loadedConfig.Environment)
		assert.Equal(t, false, loadedConfig.Debug)

		// Test database defaults
		assert.Equal(t, 10, loadedConfig.DatabasePoolSize)
		assert.Equal(t, "postgres://localhost:5432/queryflux?sslmode=disable", loadedConfig.DatabaseURL)

		// Test JWT defaults
		assert.Equal(t, "queryflux", loadedConfig.JWTIssuer)
		assert.Equal(t, "24h", loadedConfig.JWTExpiration.String())
		assert.Equal(t, "168h", loadedConfig.JWTRefreshExpiry.String())

		// Test AI defaults
		assert.Equal(t, "gpt-4", loadedConfig.AIModel)
		assert.Equal(t, "https://api.openai.com/v1", loadedConfig.OpenAIBaseURL)
		assert.Equal(t, "https://api.anthropic.com", loadedConfig.ClaudeBaseURL)
		assert.Equal(t, 10, loadedConfig.AIRateLimitRPS)
	})

	t.Run("Environment variable overrides", func(t *testing.T) {
		// Set environment variables
		os.Setenv("QUERYFLUX_JWT_SECRET", "env-jwt-secret-that-is-long-enough-to-be-valid")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
		os.Setenv("QUERYFLUX_PORT", "9000")
		os.Setenv("QUERYFLUX_HOST", "test-host")
		os.Setenv("QUERYFLUX_LOG_LEVEL", "debug")
		os.Setenv("QUERYFLUX_OPENAI_API_KEY", "env-openai-key")
		os.Setenv("QUERYFLUX_CLAUDE_API_KEY", "env-claude-key")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "staging")

		loadedConfig, err := config.Load()
		require.NoError(t, err)
		assert.NotNil(t, loadedConfig)

		assert.Equal(t, "9000", loadedConfig.Port)
		assert.Equal(t, "test-host", loadedConfig.Host)
		assert.Equal(t, "debug", loadedConfig.LogLevel)
		assert.Equal(t, "env-openai-key", loadedConfig.OpenAIAPIKey)
		assert.Equal(t, "env-claude-key", loadedConfig.ClaudeAPIKey)
		assert.Equal(t, "staging", loadedConfig.Environment)
	})

	t.Run("Production environment validation", func(t *testing.T) {
		os.Setenv("QUERYFLUX_JWT_SECRET", "prod-jwt-secret-that-is-long-enough-to-be-valid")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/prod?sslmode=require")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "production")
		// Don't set AI keys to test production validation

		_, err := config.Load()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "at least one AI provider API key must be configured in production")
	})

	t.Run("Validation errors", func(t *testing.T) {
		t.Run("Missing JWT secret", func(t *testing.T) {
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
			// Don't set JWT secret

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "JWT_SECRET is required")
		})

		t.Run("Short JWT secret", func(t *testing.T) {
			os.Setenv("QUERYFLUX_JWT_SECRET", "short")
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "JWT_SECRET must be at least 32 characters long")
		})

		t.Run("Invalid database URL", func(t *testing.T) {
			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", "invalid-url")

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid DATABASE_URL")
		})

		t.Run("Invalid Redis URL", func(t *testing.T) {
			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
			os.Setenv("QUERYFLUX_REDIS_URL", "ftp://invalid-redis-url")

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid REDIS_URL")
		})

		t.Run("Invalid port number", func(t *testing.T) {
			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
			os.Setenv("QUERYFLUX_PORT", "invalid")

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid PORT")
		})

		t.Run("Invalid log level", func(t *testing.T) {
			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
			os.Setenv("QUERYFLUX_LOG_LEVEL", "invalid")

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid LOG_LEVEL")
		})

		t.Run("Invalid environment", func(t *testing.T) {
			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
			os.Setenv("QUERYFLUX_ENVIRONMENT", "invalid")

			_, err := config.Load()
			assert.Error(t, err)
			assert.Contains(t, err.Error(), "invalid ENVIRONMENT")
		})
	})

	t.Run("Test environment overrides", func(t *testing.T) {
		os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "test")
		os.Setenv("QUERYFLUX_LOG_LEVEL", "debug") // Should be overridden to "error"

		loadedConfig, err := config.Load()
		require.NoError(t, err)

		// Test environment-specific overrides
		assert.Equal(t, "error", loadedConfig.LogLevel)
		assert.Equal(t, false, loadedConfig.Debug)
		assert.Equal(t, false, loadedConfig.EnableRequestLogging)
		assert.Equal(t, "postgres://localhost:5432/queryflux_test?sslmode=disable", loadedConfig.DatabaseURL)
	})

	t.Run("Production environment overrides", func(t *testing.T) {
		os.Setenv("QUERYFLUX_JWT_SECRET", "prod-jwt-secret-that-is-long-enough-to-be-valid")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/prod?sslmode=require")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "production")
		os.Setenv("QUERYFLUX_LOG_LEVEL", "debug") // Should be overridden to "info"
		os.Setenv("QUERYFLUX_DEBUG", "true")      // Should be overridden to false
		os.Setenv("QUERYFLUX_OPENAI_API_KEY", "prod-openai-key")
		os.Setenv("QUERYFLUX_JWT_EXPIRATION", "168h") // Should be overridden to 24h

		loadedConfig, err := config.Load()
		require.NoError(t, err)

		// Test production-specific overrides
		assert.Equal(t, "info", loadedConfig.LogLevel)
		assert.Equal(t, false, loadedConfig.Debug)
		assert.Equal(t, "24h", loadedConfig.JWTExpiration.String())
	})
}

func TestDatabaseURLValidation(t *testing.T) {
	testCases := []struct {
		name      string
		url       string
		shouldErr bool
	}{
		{"Valid PostgreSQL URL", "postgres://localhost:5432/test?sslmode=disable", false},
		{"Valid MySQL URL", "mysql://user:pass@localhost:3306/test", false},
		{"Valid MongoDB URL", "mongodb://localhost:27017/test", false},
		{"Missing scheme", "localhost:5432/test", true},
		{"Missing host", "postgres:///test", true},
		{"Invalid URL format", "not-a-url", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Store and restore JWT secret
			originalJWT := os.Getenv("QUERYFLUX_JWT_SECRET")
			defer func() {
				if originalJWT != "" {
					os.Setenv("QUERYFLUX_JWT_SECRET", originalJWT)
				} else {
					os.Unsetenv("QUERYFLUX_JWT_SECRET")
				}
			}()

			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", tc.url)

			_, err := config.Load()
			if tc.shouldErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRedisURLValidation(t *testing.T) {
	testCases := []struct {
		name      string
		url       string
		shouldErr bool
	}{
		{"Valid Redis URL", "redis://localhost:6379", false},
		{"Valid Redis SSL URL", "rediss://localhost:6379", false},
		{"Invalid Redis scheme", "ftp://localhost:6379", true},
		{"Invalid URL format", "not-a-url", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Store and restore environment variables
			originalJWT := os.Getenv("QUERYFLUX_JWT_SECRET")
			originalDB := os.Getenv("QUERYFLUX_DATABASE_URL")
			defer func() {
				if originalJWT != "" {
					os.Setenv("QUERYFLUX_JWT_SECRET", originalJWT)
				} else {
					os.Unsetenv("QUERYFLUX_JWT_SECRET")
				}
				if originalDB != "" {
					os.Setenv("QUERYFLUX_DATABASE_URL", originalDB)
				} else {
					os.Unsetenv("QUERYFLUX_DATABASE_URL")
				}
			}()

			os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid")
			os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
			os.Setenv("QUERYFLUX_REDIS_URL", tc.url)

			_, err := config.Load()
			if tc.shouldErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
