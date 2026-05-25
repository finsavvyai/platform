package providers

import (
	"fmt"
	"sort"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetAvailableModels returns all available models from all providers
func (f *Factory) GetAvailableModels() ([]models.ModelInfo, error) {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	var allModels []models.ModelInfo
	for _, provider := range f.providers {
		if !provider.IsEnabled() {
			continue
		}
		infos, err := provider.GetModelInfo()
		if err != nil {
			continue
		}
		allModels = append(allModels, infos...)
	}
	return allModels, nil
}

// GetProviderForModel returns the best provider for a given model
func (f *Factory) GetProviderForModel(model string) (Provider, error) {
	f.mutex.RLock()
	defer f.mutex.RUnlock()

	var candidateProviders []Provider
	for _, provider := range f.providers {
		if !provider.IsEnabled() {
			continue
		}
		infos, err := provider.GetModelInfo()
		if err != nil {
			continue
		}
		for _, m := range infos {
			if m.ID == model && m.IsAvailable {
				candidateProviders = append(candidateProviders, provider)
				break
			}
		}
	}

	if len(candidateProviders) == 0 {
		return nil, fmt.Errorf("no provider found for model: %s", model)
	}

	sort.Slice(candidateProviders, func(i, j int) bool {
		priorityI, priorityJ := 100, 100
		if p := candidateProviders[i].GetConfig().Priority; p > 0 {
			priorityI = p
		}
		if p := candidateProviders[j].GetConfig().Priority; p > 0 {
			priorityJ = p
		}
		return priorityI < priorityJ
	})
	return candidateProviders[0], nil
}
