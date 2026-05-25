package providers

import (
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
)

// Factory creates new provider instances
type Factory struct {
	logger *logrus.Logger
}

// NewFactory creates a new provider factory
func NewFactory(logger *logrus.Logger) *Factory {
	return &Factory{
		logger: logger,
	}
}

// NewProvider creates a new provider instance based on the provider type
func (f *Factory) NewProvider(providerType string, config ProviderConfig) (Provider, error) {
	// Normalize provider type
	providerType = strings.ToLower(strings.TrimSpace(providerType))

	switch providerType {
	case "openai":
		return NewOpenAIProvider(config, f.logger)
	case "anthropic":
		return NewAnthropicProvider(config, f.logger)
	default:
		return nil, fmt.Errorf("unsupported provider type: %s", providerType)
	}
}

// GetSupportedProviders returns a list of supported provider types
func (f *Factory) GetSupportedProviders() []string {
	return []string{"openai", "anthropic"}
}

// ValidateProviderConfig validates a provider configuration
func (f *Factory) ValidateProviderConfig(providerType string, config ProviderConfig) error {
	providerType = strings.ToLower(strings.TrimSpace(providerType))

	switch providerType {
	case "openai":
		if config.APIKey == "" {
			return fmt.Errorf("OpenAI API key is required")
		}
		if len(config.Models) == 0 {
			return fmt.Errorf("at least one model must be specified")
		}
	case "anthropic":
		if config.APIKey == "" {
			return fmt.Errorf("Anthropic API key is required")
		}
		if len(config.Models) == 0 {
			return fmt.Errorf("at least one model must be specified")
		}
	default:
		return fmt.Errorf("unsupported provider type: %s", providerType)
	}

	// Validate common configuration
	if config.Timeout <= 0 {
		config.Timeout = 30 // Default 30 seconds
	}
	if config.RetryCount < 0 {
		config.RetryCount = 3 // Default 3 retries
	}
	if config.RetryDelay <= 0 {
		config.RetryDelay = 1 // Default 1 second
	}

	return nil
}
