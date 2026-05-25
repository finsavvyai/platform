package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	// Store original environment variables
	originalEnv := make(map[string]string)
	envVars := []string{
		"QUERYFLUX_PORT", "QUERYFLUX_HOST", "QUERYFLUX_LOG_LEVEL",
		"QUERYFLUX_DATABASE_URL", "QUERYFLUX_REDIS_URL", "QUERYFLUX_JWT_SECRET",
		"QUERYFLUX_OPENAI_API_KEY", "QUERYFLUX_CLAUDE_API_KEY", "QUERYFLUX_ENVIRONMENT",
		"QUERYFLUX_DEBUG", "QUERYFLUX_DATABASE_POOL_SIZE", "QUERYFLUX_TIMEOUT",
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
		os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid-32-chars")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")

		loadedConfig, err := Load()
		require.NoError(t, err)
		require.NotNil(t, loadedConfig)

		// Test default values
		assert.Equal(t, "8080", loadedConfig.Port)
		assert.Equal(t, "0.0.0.0", loadedConfig.Host)
		assert.Equal(t, "info", loadedConfig.LogLevel)
		assert.Equal(t, "development", loadedConfig.Environment)
		assert.Equal(t, false, loadedConfig.Debug)
		assert.Equal(t, 30*time.Second, loadedConfig.Timeout)

		// Test database defaults
		assert.Equal(t, 10, loadedConfig.DatabasePoolSize)
		assert.Equal(t, 30*time.Second, loadedConfig.DatabaseTimeout)

		// Test JWT defaults
		assert.Equal(t, "queryflux", loadedConfig.JWTIssuer)
		assert.Equal(t, 24*time.Hour, loadedConfig.JWTExpiration)
		assert.Equal(t, 168*time.Hour, loadedConfig.JWTRefreshExpiry)

		// Test AI defaults
		assert.Equal(t, "gpt-4", loadedConfig.AIModel)
		assert.Equal(t, "https://api.openai.com/v1", loadedConfig.OpenAIBaseURL)
		assert.Equal(t, "https://api.anthropic.com", loadedConfig.ClaudeBaseURL)
		assert.Equal(t, 60*time.Second, loadedConfig.AITimeout)
		assert.Equal(t, 10, loadedConfig.AIRateLimitRPS)

		// Test security defaults
		assert.Equal(t, 100, loadedConfig.RateLimitRPS)
		assert.Equal(t, 10, loadedConfig.MaxRequestSizeMB)
		assert.Equal(t, true, loadedConfig.EnableRequestLogging)
		assert.Equal(t, []string{"http://localhost:3000", "http://localhost:5173"}, loadedConfig.CORSOrigins)
	})

	t.Run("Environment variable overrides", func(t *testing.T) {
		// Set environment variables
		os.Setenv("QUERYFLUX_JWT_SECRET", "env-jwt-secret-that-is-long-enough-to-be-valid-32-chars")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
		os.Setenv("QUERYFLUX_PORT", "9000")
		os.Setenv("QUERYFLUX_HOST", "test-host")
		os.Setenv("QUERYFLUX_LOG_LEVEL", "debug")
		os.Setenv("QUERYFLUX_OPENAI_API_KEY", "env-openai-key")
		os.Setenv("QUERYFLUX_CLAUDE_API_KEY", "env-claude-key")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "staging")
		os.Setenv("QUERYFLUX_DEBUG", "true")
		os.Setenv("QUERYFLUX_DATABASE_POOL_SIZE", "20")
		os.Setenv("QUERYFLUX_TIMEOUT", "60s")

		loadedConfig, err := Load()
		require.NoError(t, err)
		assert.NotNil(t, loadedConfig)

		assert.Equal(t, "9000", loadedConfig.Port)
		assert.Equal(t, "test-host", loadedConfig.Host)
		assert.Equal(t, "debug", loadedConfig.LogLevel)
		assert.Equal(t, "env-openai-key", loadedConfig.OpenAIAPIKey)
		assert.Equal(t, "env-claude-key", loadedConfig.ClaudeAPIKey)
		assert.Equal(t, "staging", loadedConfig.Environment)
		assert.Equal(t, true, loadedConfig.Debug)
		assert.Equal(t, 20, loadedConfig.DatabasePoolSize)
		assert.Equal(t, 60*time.Second, loadedConfig.Timeout)
	})

	t.Run("Production environment validation", func(t *testing.T) {
		os.Setenv("QUERYFLUX_JWT_SECRET", "prod-jwt-secret-that-is-long-enough-to-be-valid-32-chars")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/prod?sslmode=require")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "production")
		// Don't set AI keys to test production validation

		_, err := Load()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "at least one AI provider API key must be configured in production")
	})

	t.Run("Test environment overrides", func(t *testing.T) {
		os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid-32-chars")
		os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
		os.Setenv("QUERYFLUX_ENVIRONMENT", "test")
		os.Setenv("QUERYFLUX_LOG_LEVEL", "debug") // Should be overridden to "error"

		loadedConfig, err := Load()
		require.NoError(t, err)

		// Test environment-specific overrides
		assert.Equal(t, "error", loadedConfig.LogLevel)
		assert.Equal(t, false, loadedConfig.Debug)
		assert.Equal(t, false, loadedConfig.EnableRequestLogging)
		assert.Equal(t, "postgres://localhost:5432/queryflux_test?sslmode=disable", loadedConfig.DatabaseURL)
	})
}

func TestConfigValidation(t *testing.T) {
	// Store and restore environment
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

	t.Run("Missing required fields", func(t *testing.T) {
		testCases := []struct {
			name        string
			setupEnv    func()
			expectedErr string
		}{
			{
				name: "Missing JWT secret",
				setupEnv: func() {
					os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
					os.Unsetenv("QUERYFLUX_JWT_SECRET")
				},
				expectedErr: "JWT_SECRET is required",
			},
			{
				name: "Missing database URL",
				setupEnv: func() {
					os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid-32-chars")
					os.Unsetenv("QUERYFLUX_DATABASE_URL")
				},
				expectedErr: "DATABASE_URL is required",
			},
			{
				name: "Short JWT secret",
				setupEnv: func() {
					os.Setenv("QUERYFLUX_JWT_SECRET", "short")
					os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
				},
				expectedErr: "JWT_SECRET must be at least 32 characters long",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				tc.setupEnv()
				_, err := Load()
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectedErr)
			})
		}
	})

	t.Run("Invalid URLs and values", func(t *testing.T) {
		testCases := []struct {
			name        string
			envKey      string
			envValue    string
			expectedErr string
		}{
			{
				name:        "Invalid database URL",
				envKey:      "QUERYFLUX_DATABASE_URL",
				envValue:    "invalid-url",
				expectedErr: "invalid DATABASE_URL",
			},
			{
				name:        "Invalid Redis URL",
				envKey:      "QUERYFLUX_REDIS_URL",
				envValue:    "ftp://invalid-redis-url",
				expectedErr: "invalid REDIS_URL",
			},
			{
				name:        "Invalid port number",
				envKey:      "QUERYFLUX_PORT",
				envValue:    "invalid",
				expectedErr: "invalid PORT",
			},
			{
				name:        "Invalid log level",
				envKey:      "QUERYFLUX_LOG_LEVEL",
				envValue:    "invalid",
				expectedErr: "invalid LOG_LEVEL",
			},
			{
				name:        "Invalid environment",
				envKey:      "QUERYFLUX_ENVIRONMENT",
				envValue:    "invalid",
				expectedErr: "invalid ENVIRONMENT",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-that-is-long-enough-to-be-valid-32-chars")
				os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/test?sslmode=disable")
				os.Setenv(tc.envKey, tc.envValue)

				_, err := Load()
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectedErr)

				// Clean up
				os.Unsetenv(tc.envKey)
			})
		}
	})
}

func TestLoadWithTemplates(t *testing.T) {
	// Create a temporary config file
	tempDir := t.TempDir()
	configFile := filepath.Join(tempDir, "config.yaml")

	configContent := `
DATABASE_URL: "${DATABASE_URL:postgres://localhost:5432/default?sslmode=disable}"
REDIS_URL: "${REDIS_URL:redis://localhost:6379}"
JWT_SECRET: "${JWT_SECRET:default-secret}"
LEMONSQUEEZY_API_KEY: "${LEMONSQUEEZY_API_KEY:default-key}"
CORS_ORIGINS:
  - "${CORS_ORIGIN:http://localhost:3000}"
  - "${CORS_ORIGIN:http://localhost:5173}"
`

	err := os.WriteFile(configFile, []byte(configContent), 0644)
	require.NoError(t, err)

	// Store and restore environment variables
	originalEnv := make(map[string]string)
	envVars := []string{"DATABASE_URL", "REDIS_URL", "JWT_SECRET", "LEMONSQUEEZY_API_KEY", "CORS_ORIGIN"}

	for _, env := range envVars {
		if val := os.Getenv(env); val != "" {
			originalEnv[env] = val
		}
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

	t.Run("Template substitution with environment variables", func(t *testing.T) {
		// Set environment variables
		os.Setenv("DATABASE_URL", "postgres://test-host:5432/test-db?sslmode=require")
		os.Setenv("REDIS_URL", "redis://test-host:6380/1")
		os.Setenv("JWT_SECRET", "env-jwt-secret-32-chars-long-for-validation")
		os.Setenv("LEMONSQUEEZY_API_KEY", "env-lemonsqueezy-key")
		os.Setenv("CORS_ORIGIN", "http://env-origin:3000")

		config, err := LoadFromFile(configFile)
		require.NoError(t, err)
		require.NotNil(t, config)

		assert.Equal(t, "postgres://test-host:5432/test-db?sslmode=require", config.DatabaseURL)
		assert.Equal(t, "redis://test-host:6380/1", config.RedisURL)
		assert.Equal(t, "env-jwt-secret-32-chars-long-for-validation", config.JWTSecret)
		assert.Equal(t, "env-lemonsqueezy-key", config.LemonSqueezyAPIKey)
		assert.Equal(t, []string{"http://env-origin:3000", "http://env-origin:3000"}, config.CORSOrigins)
	})

	t.Run("Template substitution with default values", func(t *testing.T) {
		// Clear environment variables to test defaults
		for _, env := range envVars {
			os.Unsetenv(env)
		}

		config, err := LoadFromFile(configFile)
		require.NoError(t, err)
		require.NotNil(t, config)

		assert.Equal(t, "postgres://localhost:5432/default?sslmode=disable", config.DatabaseURL)
		assert.Equal(t, "redis://localhost:6379", config.RedisURL)
		assert.Equal(t, "default-secret", config.JWTSecret)
		assert.Equal(t, "default-key", config.LemonSqueezyAPIKey)
		assert.Equal(t, []string{"http://localhost:3000", "http://localhost:5173"}, config.CORSOrigins)
	})
}

func TestUtilityFunctions(t *testing.T) {
	config := &Config{
		Environment:  "development",
		DatabaseURL:  "postgres://localhost:5432/test",
		RedisURL:     "redis://localhost:6379",
		JWTSecret:    "test-jwt-secret-32-chars-long-for-validation",
		OpenAIAPIKey: "test-openai-key",
		ClaudeAPIKey: "",
	}

	t.Run("Environment check functions", func(t *testing.T) {
		assert.True(t, IsDevelopment(config))
		assert.False(t, IsProduction(config))
		assert.False(t, IsTest(config))

		config.Environment = "production"
		assert.False(t, IsDevelopment(config))
		assert.True(t, IsProduction(config))

		config.Environment = "test"
		assert.True(t, IsTest(config))
		assert.False(t, IsDevelopment(config))
	})

	t.Run("URL getter functions", func(t *testing.T) {
		assert.Equal(t, "postgres://localhost:5432/test", GetDatabaseURL(config))
		assert.Equal(t, "redis://localhost:6379", GetRedisURL(config))
		assert.Equal(t, "test-jwt-secret-32-chars-long-for-validation", GetJWTSecret(config))

		// Test fallback
		config.DatabaseURL = ""
		assert.Equal(t, "postgres://localhost:5432/queryflux?sslmode=disable", GetDatabaseURL(config))

		config.RedisURL = ""
		assert.Equal(t, "redis://localhost:6379", GetRedisURL(config))
	})

	t.Run("AI provider functions", func(t *testing.T) {
		assert.True(t, HasAIProvider(config))
		assert.Equal(t, "openai", GetPrimaryAIProvider(config))

		config.OpenAIAPIKey = ""
		config.ClaudeAPIKey = "test-claude-key"
		assert.True(t, HasAIProvider(config))
		assert.Equal(t, "claude", GetPrimaryAIProvider(config))

		config.OpenAIAPIKey = ""
		config.ClaudeAPIKey = ""
		assert.False(t, HasAIProvider(config))
		assert.Equal(t, "", GetPrimaryAIProvider(config))
	})
}
