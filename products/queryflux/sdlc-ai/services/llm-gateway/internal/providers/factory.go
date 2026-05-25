//go:build ignore

package providers

import (
	"context"
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
			if baseProvider, ok := provider.(*BaseProvider); ok {
				priority = baseProvider.config.Priority
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
		if baseProvider, ok := provider.(*BaseProvider); ok {
			if baseProvider.lastHealthStatus != nil &&
				time.Since(baseProvider.lastHealthCheck) < 5*time.Minute {
				if baseProvider.lastHealthStatus.Status == "healthy" {
					healthyProviders = append(healthyProviders, provider)
				}
			} else {
				// No recent health check, assume healthy for now
				healthyProviders = append(healthyProviders, provider)
			}
		} else {
			// Assume healthy if we can't check
			healthyProviders = append(healthyProviders, provider)
		}
	}

	return healthyProviders
}

// GetAvailableModels returns all available models from all providers
func (f *Factory) GetAvailableModels() ([]models.ModelInfo, error) {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	var allModels []models.ModelInfo

	for _, provider := range f.providers {
		if !provider.IsEnabled() {
			continue
		}

		models, err := provider.GetModelInfo()
		if err != nil {
			continue
		}

		allModels = append(allModels, models...)
	}

	return allModels, nil
}

// GetProviderForModel returns the best provider for a given model
func (f *Factory) GetProviderForModel(model string) (Provider, error) {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	// First, try to find the provider that offers this model
	var candidateProviders []Provider

	for _, provider := range f.providers {
		if !provider.IsEnabled() {
			continue
		}

		models, err := provider.GetModelInfo()
		if err != nil {
			continue
		}

		for _, m := range models {
			if m.ID == model && m.IsAvailable {
				candidateProviders = append(candidateProviders, provider)
				break
			}
		}
	}

	if len(candidateProviders) == 0 {
		return nil, fmt.Errorf("no provider found for model: %s", model)
	}

	// Among candidates, prefer the one with lowest priority (highest preference)
	sort.Slice(candidateProviders, func(i, j int) bool {
		priorityI := 100
		priorityJ := 100

		if baseProvider, ok := candidateProviders[i].(*BaseProvider); ok {
			priorityI = baseProvider.config.Priority
		}
		if baseProvider, ok := candidateProviders[j].(*BaseProvider); ok {
			priorityJ = baseProvider.config.Priority
		}

		return priorityI < priorityJ
	})

	return candidateProviders[0], nil
}

// EnableProvider enables a provider
func (f *Factory) EnableProvider(name string) error {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	provider, exists := f.providers[name]
	if !exists {
		return fmt.Errorf("provider not found: %s", name)
	}

	provider.SetEnabled(true)
	return nil
}

// DisableProvider disables a provider
func (f *Factory) DisableProvider(name string) error {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	provider, exists := f.providers[name]
	if !exists {
		return fmt.Errorf("provider not found: %s", name)
	}

	provider.SetEnabled(false)
	return nil
}

// AddProvider adds a new provider
func (f *Factory) AddProvider(config models.ProviderConfig) error {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	// Check if provider already exists
	if _, exists := f.providers[config.Name]; exists {
		return fmt.Errorf("provider already exists: %s", config.Name)
	}

	// Create provider based on type
	var provider Provider

	switch config.Type {
	case "openai":
		provider = NewOpenAIProvider(config)
	case "anthropic":
		provider = NewAnthropicProvider(config)
	default:
		return fmt.Errorf("unknown provider type: %s", config.Type)
	}

	f.providers[config.Name] = provider
	return nil
}

// RemoveProvider removes a provider
func (f *Factory) RemoveProvider(name string) error {
	f.mutex.Lock()
	defer f.mutex.Unlock()

	if _, exists := f.providers[name]; !exists {
		return fmt.Errorf("provider not found: %s", name)
	}

	delete(f.providers, name)
	return nil
}

// CheckAllHealth checks the health of all providers
func (f *Factory) CheckAllHealth(ctx context.Context) map[string]*models.HealthStatus {
	f.mutex.RLock()
	providers := make(map[string]Provider)
	for name, provider := range f.providers {
		providers[name] = provider
	}
	f.mutex.RUnlock()

	results := make(map[string]*models.HealthStatus)

	for name, provider := range providers {
		if !provider.IsEnabled() {
			results[name] = &models.HealthStatus{
				Provider:    name,
				Status:      "disabled",
				LastChecked: time.Now(),
			}
			continue
		}

		status, err := provider.Health(ctx)
		if err != nil {
			results[name] = &models.HealthStatus{
				Provider:    name,
				Status:      "error",
				LastChecked: time.Now(),
				Error:       err.Error(),
			}
		} else {
			results[name] = status
		}
	}

	return results
}
