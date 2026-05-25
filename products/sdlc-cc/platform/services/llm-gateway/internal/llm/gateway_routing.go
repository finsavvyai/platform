package llm

import (
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/pkg/models"
)

// selectProvider selects the best provider for a request.
// When SmartRouter is enabled, it delegates to data-driven selection
// after filtering to healthy candidates. Otherwise it falls back to
// static priority order.
func (g *Gateway) selectProvider(req *models.CompletionRequest) (providers.Provider, error) {
	// If specific model is requested, find provider for that model
	if req.Model != "" {
		provider, err := g.providerFactory.GetProviderForModel(req.Model)
		if err == nil {
			return provider, nil
		}
	}

	// Otherwise, get providers by priority
	allProviders := g.providerFactory.GetProvidersByPriority()
	if len(allProviders) == 0 {
		return nil, fmt.Errorf("no providers available")
	}

	// Filter healthy providers
	healthyProviders := g.providerFactory.GetHealthyProviders()
	candidates := healthyProviders
	if len(candidates) == 0 {
		candidates = allProviders
	}

	// Use SmartRouter when enabled
	if g.smartRouter != nil {
		model := req.Model
		if selected := g.smartRouter.SelectProvider(model, candidates); selected != nil {
			return selected, nil
		}
	}

	return candidates[0], nil
}

// generateID generates a unique ID
func generateID() string {
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}
