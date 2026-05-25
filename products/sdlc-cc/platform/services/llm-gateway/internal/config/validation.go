package config

import (
	"fmt"
)

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	if config.Server.Port < 1 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}

	if config.LLM.DefaultProvider == "" {
		return fmt.Errorf("default provider is required")
	}

	if config.LLM.MaxRetries < 0 {
		return fmt.Errorf("max_retries must be non-negative")
	}

	if len(config.LLM.Providers) == 0 {
		return fmt.Errorf("at least one provider must be configured")
	}

	found := false
	for _, provider := range config.LLM.Providers {
		if provider.Name == config.LLM.DefaultProvider {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("default provider '%s' not found in providers list", config.LLM.DefaultProvider)
	}

	for _, provider := range config.LLM.Providers {
		if provider.Name == "" {
			return fmt.Errorf("provider name is required")
		}
		if provider.Type == "" {
			return fmt.Errorf("provider type is required for provider '%s'", provider.Name)
		}
		if provider.APIKey == "" && provider.Type != "ollama" {
			return fmt.Errorf("API key is required for provider '%s'", provider.Name)
		}
	}

	if config.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if config.Database.User == "" {
		return fmt.Errorf("database user is required")
	}
	if config.Database.DBName == "" {
		return fmt.Errorf("database name is required")
	}

	if config.Auth.Enabled && config.Auth.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required when auth is enabled")
	}

	return nil
}
