package llm

import (
	"context"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetAvailableModels returns all available models from all providers
func (g *Gateway) GetAvailableModels(ctx context.Context) ([]models.ModelInfo, error) {
	return g.providerFactory.GetAvailableModels()
}

// GetProviderHealth returns the health status of all providers
func (g *Gateway) GetProviderHealth(ctx context.Context) map[string]*models.HealthStatus {
	return g.providerFactory.CheckAllHealth(ctx)
}

// GetProvider returns a specific provider
func (g *Gateway) GetProvider(name string) (providers.Provider, error) {
	return g.providerFactory.GetProvider(name)
}

// ListProviders returns all configured providers
func (g *Gateway) ListProviders() map[string]providers.Provider {
	return g.providerFactory.GetAllProviders()
}

// EnableProvider enables a provider
func (g *Gateway) EnableProvider(name string) error {
	return g.providerFactory.EnableProvider(name)
}

// DisableProvider disables a provider
func (g *Gateway) DisableProvider(name string) error {
	return g.providerFactory.DisableProvider(name)
}
