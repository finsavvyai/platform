package config

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/spf13/viper"
)

// LoadWithTemplates reads configuration with support for environment variable templates
func LoadWithTemplates() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("$HOME/.queryflux")

	// Set environment-specific config files
	env := os.Getenv("QUERYFLUX_ENVIRONMENT")
	if env != "" {
		viper.SetConfigName(fmt.Sprintf("config.%s", env))
	}

	// Set defaults
	setDefaults()

	// Enable reading from environment variables
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Read config file if it exists
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
		// Log that we're using environment variables only
		fmt.Printf("Warning: No config file found, using environment variables and defaults\n")
	}

	// Process template variables in config
	if err := processTemplateVariables(); err != nil {
		return nil, fmt.Errorf("error processing template variables: %w", err)
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate required fields
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	// Apply environment-specific overrides
	if err := applyEnvironmentOverrides(&config, env); err != nil {
		return nil, fmt.Errorf("failed to apply environment overrides: %w", err)
	}

	return &config, nil
}

// processTemplateVariables substitutes ${VAR} patterns with environment variable values
func processTemplateVariables() error {
	// Get all keys in the configuration
	for _, key := range viper.AllKeys() {
		value := viper.Get(key)

		// Process string values for template substitution
		if strValue, ok := value.(string); ok {
			if processedValue, err := substituteTemplates(strValue); err != nil {
				return fmt.Errorf("error processing templates for key %s: %w", key, err)
			} else if processedValue != strValue {
				viper.Set(key, processedValue)
			}
		}

		// Process string slices for template substitution
		if sliceValue, ok := value.([]string); ok {
			processedSlice := make([]string, len(sliceValue))
			for i, item := range sliceValue {
				if processedItem, err := substituteTemplates(item); err != nil {
					return fmt.Errorf("error processing templates for slice item %s[%d]: %w", key, i, err)
				} else {
					processedSlice[i] = processedItem
				}
			}
			viper.Set(key, processedSlice)
		}
	}

	return nil
}

// substituteTemplates replaces ${VAR} and ${VAR:default} patterns with environment variables
func substituteTemplates(input string) (string, error) {
	// Regular expression to match ${VAR} or ${VAR:default}
	templateRegex := regexp.MustCompile(`\$\{([^}:]+)(?::([^}]*))?\}`)

	result := templateRegex.ReplaceAllStringFunc(input, func(match string) string {
		// Extract variable name and default value
		submatches := templateRegex.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match // Return original if no match found
		}

		varName := submatches[1]
		defaultValue := ""
		if len(submatches) > 2 && submatches[2] != "" {
			defaultValue = submatches[2]
		}

		// Get environment variable value
		if envValue := os.Getenv(varName); envValue != "" {
			return envValue
		}

		// Return default value if environment variable is not set
		return defaultValue
	})

	return result, nil
}

// LoadFromFile loads configuration from a specific file
func LoadFromFile(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("error reading config file %s: %w", configPath, err)
	}

	// Process template variables
	if err := processTemplateVariables(); err != nil {
		return nil, fmt.Errorf("error processing template variables: %w", err)
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate configuration
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// GetConfigPath returns the path to the config file that was loaded
func GetConfigPath() string {
	return viper.ConfigFileUsed()
}

// IsDevelopment returns true if the environment is development
func IsDevelopment(config *Config) bool {
	return config.Environment == "development"
}

// IsProduction returns true if the environment is production
func IsProduction(config *Config) bool {
	return config.Environment == "production"
}

// IsTest returns true if the environment is test
func IsTest(config *Config) bool {
	return config.Environment == "test"
}

// GetDatabaseURL returns the database URL with fallback to default
func GetDatabaseURL(config *Config) string {
	if config.DatabaseURL != "" {
		return config.DatabaseURL
	}
	return "postgres://localhost:5432/queryflux?sslmode=disable"
}

// GetRedisURL returns the Redis URL with fallback to default
func GetRedisURL(config *Config) string {
	if config.RedisURL != "" {
		return config.RedisURL
	}
	return "redis://localhost:6379"
}

// GetJWTSecret returns the JWT secret from environment or config
func GetJWTSecret(config *Config) string {
	if config.JWTSecret != "" {
		return config.JWTSecret
	}
	if envSecret := os.Getenv("JWT_SECRET"); envSecret != "" {
		return envSecret
	}
	return ""
}

// HasAIProvider returns true if at least one AI provider is configured
func HasAIProvider(config *Config) bool {
	return config.OpenAIAPIKey != "" || config.ClaudeAPIKey != ""
}

// GetPrimaryAIProvider returns the primary AI provider based on configuration
func GetPrimaryAIProvider(config *Config) string {
	if config.OpenAIAPIKey != "" {
		return "openai"
	}
	if config.ClaudeAPIKey != "" {
		return "claude"
	}
	return ""
}
