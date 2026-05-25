package providers

import (
	"fmt"

	"github.com/SDLC/llm-gateway/pkg/models"
)

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

	if _, exists := f.providers[config.Name]; exists {
		return fmt.Errorf("provider already exists: %s", config.Name)
	}

	var provider Provider
	switch config.Type {
	case "openai":
		provider = NewOpenAIProvider(config)
	case "anthropic":
		provider = NewAnthropicProvider(config)
	case "ollama":
		provider = NewOllamaProvider(config)
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

// RegisterProvider registers a provider by name (for testing or dynamic registration).
func (f *Factory) RegisterProvider(name string, p Provider) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	if f.providers == nil {
		f.providers = make(map[string]Provider)
	}
	f.providers[name] = p
}
