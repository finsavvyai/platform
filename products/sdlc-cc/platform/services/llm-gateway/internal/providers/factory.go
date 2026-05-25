package providers

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// Factory manages all LLM providers
type Factory struct {
	providers map[string]Provider
	mutex     sync.RWMutex
	config    *models.ProviderConfig
}

// NewFactory creates a new provider factory
func NewFactory(configs []models.ProviderConfig) *Factory {
	factory := &Factory{
		providers: make(map[string]Provider),
		config:    &models.ProviderConfig{},
	}

	// Initialize providers from configs
	for _, config := range configs {
		switch config.Type {
		case "openai":
			provider := NewOpenAIProvider(config)
			factory.providers[config.Name] = provider

		case "anthropic":
			provider := NewAnthropicProvider(config)
			factory.providers[config.Name] = provider

		case "ollama":
			provider := NewOllamaProvider(config)
			factory.providers[config.Name] = provider

		default:
			// Unknown provider type, skip
			continue
		}
	}

	return factory
}

// GetProvider returns a provider by name
func (f *Factory) GetProvider(name string) (Provider, error) {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	provider, exists := f.providers[name]
	if !exists {
		return nil, fmt.Errorf("provider not found: %s", name)
	}

	if !provider.IsEnabled() {
		return nil, fmt.Errorf("provider is disabled: %s", name)
	}

	return provider, nil
}

// GetProvidersByPriority returns all enabled providers sorted by priority
func (f *Factory) GetProvidersByPriority() []Provider {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	type providerWithPriority struct {
		provider Provider
		priority int
	}

	var providers []providerWithPriority

	for _, provider := range f.providers {
		if provider.IsEnabled() {
			priority := 100 // default priority
			if cfg := provider.GetConfig(); cfg.Priority > 0 {
				priority = cfg.Priority
			}
			providers = append(providers, providerWithPriority{
				provider: provider,
				priority: priority,
			})
		}
	}

	// Sort by priority (lower number = higher priority)
	sort.Slice(providers, func(i, j int) bool {
		return providers[i].priority < providers[j].priority
	})

	result := make([]Provider, len(providers))
	for i, p := range providers {
		result[i] = p.provider
	}

	return result
}

// GetAllProviders returns all providers (enabled and disabled)
func (f *Factory) GetAllProviders() map[string]Provider {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	result := make(map[string]Provider)
	for name, provider := range f.providers {
		result[name] = provider
	}

	return result
}

// GetHealthyProviders returns all currently healthy providers
func (f *Factory) GetHealthyProviders() []Provider {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	var healthyProviders []Provider

	for _, provider := range f.providers {
		if !provider.IsEnabled() {
			continue
		}

		// Check if we have recent health status
		st := provider.GetLastHealthStatus()
		lastCheck := provider.GetLastHealthCheck()
		if st != nil && time.Since(lastCheck) < 5*time.Minute {
			if st.Status == "healthy" {
				healthyProviders = append(healthyProviders, provider)
			}
		} else {
			// No recent health check, assume healthy for now
			healthyProviders = append(healthyProviders, provider)
		}
	}

	return healthyProviders
}
