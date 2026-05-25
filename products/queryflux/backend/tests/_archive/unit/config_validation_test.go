package config

import (
	"os"
	"testing"

	"github.com/queryflux/backend/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name       string
		envVars    map[string]string
		configFile string
		expectErr  bool
	}{
		{
			name: "Valid configuration",
			envVars: map[string]string{
				"QUERYFLUX_PORT":      "8080",
				"QUERYFLUX_HOST":      "api.queryflux.com",
				"QUERYFLUX_LOG_LEVEL": "info",
			},
			configFile: "/app/config/config.yaml",
			expectErr:  false,
		},
		{
			name: "Missing environment variables",
			envVars: map[string]string{
				"QUERYFLUX_PORT": "",
				"QUERYFLUX_HOST": "",
			},
			configFile: "/nonexistent/config.yml",
			expectErr:  true,
		},
		{
			name: "Invalid config file path",
			envVars: map[string]string{
				"QUERYFLUX_PORT": "8080",
			},
			configFile: "/invalid/path/config.yml",
			expectErr:  true,
		},
		{
			name: "Invalid port value",
			envVars: map[string]string{
				"QUERYFLUX_PORT": "invalid",
				"QUERYFLUX_HOST": "api.queryflux.com",
			},
			expectErr: true,
		},
		{
			name: "Valid hosts configuration",
			envVars: map[string]string{
				"QUERYFLUX_PORT":            "8080",
				"QUERYFLUX_HOST":            "localhost",
				"QUERYFLUX_ALTERNATE_HOSTS": "backup.queryflux.com,monitor.queryflux.com",
			},
			configFile: "/app/config/config.yaml",
			expectErr:  false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			config := &config.Config{
				Port:          test.envVars["QUERYFLUX_PORT"],
				Host:          test.envVars["QUERYFLUX_HOST"],
				LogLevel:      test.envVars["QUERYFLUX_LOG_LEVEL"],
				DatabaseURL:   test.envVars["QUERYFLUX_DATABASE_URL"],
				RedisURL:      test.envVars["QUERYFLUX_REDIS_URL"],
				JWTSecret:     test.envVars["QUERYFLUX_JWT_SECRET"],
				JWTExpiration: 24,
				OpenAIAPIKey:  test.envVars["QUERYFLUX_OPENAI_API_KEY"],
				ClaudeAPIKey:  test.envVars["QUERYFLUX_CLAUDE_API_KEY"],
				Environment:   "production",
			}

			// Setup environment variables for this test
			for key, value := range test.envVars {
				os.Setenv(key, value)
				defer os.Unsetenv(key)
			}

			loadedConfig, err := config.Load()
			if test.expectErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, test.envVars["QUERYFLUX_PORT"], config.Port)
				assert.Equal(t, test.envVars["QUERYFLUX_HOST"], config.Host)
				assert.Equal(t, test.envVars["QUERYFLUX_LOG_LEVEL"], config.LogLevel)
			}
		})
	}
}
