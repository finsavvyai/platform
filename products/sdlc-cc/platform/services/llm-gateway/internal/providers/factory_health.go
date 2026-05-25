package providers

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

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
