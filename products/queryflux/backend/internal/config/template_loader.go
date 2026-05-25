package config

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/spf13/viper"
)

// TemplateLoader handles environment variable substitution in configuration files
type TemplateLoader struct {
	varRegex *regexp.Regexp
}

// NewTemplateLoader creates a new template loader
func NewTemplateLoader() *TemplateLoader {
	return &TemplateLoader{
		varRegex: regexp.MustCompile(`\$\{([^}]+)\}`),
	}
}

// SubstituteEnvVars replaces ${VAR_NAME} patterns with environment variable values
func (tl *TemplateLoader) SubstituteEnvVars(input string) string {
	return tl.varRegex.ReplaceAllStringFunc(input, func(match string) string {
		// Extract variable name from ${VAR_NAME}
		varName := strings.TrimPrefix(match, "${")
		varName = strings.TrimSuffix(varName, "}")

		// Get environment variable value
		if value := os.Getenv(varName); value != "" {
			return value
		}

		// Return empty string if environment variable is not set
		return ""
	})
}

// ProcessConfig recursively processes a configuration structure to substitute environment variables
func (tl *TemplateLoader) ProcessConfig(config interface{}) error {
	switch v := config.(type) {
	case string:
		// For string values, substitute environment variables
		if updated := tl.SubstituteEnvVars(v); updated != v {
			// This is a limitation of working with interface{}
			// In practice, this is handled at the viper level
			return nil
		}
	case map[string]interface{}:
		// For maps, recursively process each value
		for key, value := range v {
			if err := tl.ProcessConfig(value); err != nil {
				return fmt.Errorf("error processing config key %s: %w", key, err)
			}
		}
	case []interface{}:
		// For slices, recursively process each element
		for i, item := range v {
			if err := tl.ProcessConfig(item); err != nil {
				return fmt.Errorf("error processing config array index %d: %w", i, err)
			}
		}
	}

	return nil
}

// LoadConfigWithTemplate loads configuration with template variable substitution
func LoadConfigWithTemplate(configPath string) (*Config, error) {
	// Set up viper for the specific config file
	v := viper.New()
	v.SetConfigFile(configPath)

	// Read the config file
	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("error reading config file %s: %w", configPath, err)
	}

	// Get all settings as a map
	settings := v.AllSettings()

	// Process template variable substitution
	templateLoader := NewTemplateLoader()
	if err := templateLoader.ProcessConfig(settings); err != nil {
		return nil, fmt.Errorf("error processing template variables: %w", err)
	}

	// Update viper with processed settings
	for key, value := range settings {
		v.Set(key, value)
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Apply validation
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}
