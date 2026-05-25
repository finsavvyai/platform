package providers

import (
	"context"
	"fmt"
	"time"
)

// initializeModels fetches available models from OpenAI API
func (p *OpenAIProvider) initializeModels() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	modelList, err := p.client.ListModels(ctx)
	if err != nil {
		return fmt.Errorf("failed to list models: %w", err)
	}

	modelInfo := map[string]*ModelInfo{
		"gpt-4-turbo-preview": {
			ID:          "gpt-4-turbo-preview",
			Name:        "GPT-4 Turbo",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 128000,
			Pricing:     &Pricing{PromptTokenCost: 0.01, CompletionTokenCost: 0.03},
		},
		"gpt-4": {
			ID:          "gpt-4",
			Name:        "GPT-4",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 8192,
			Pricing:     &Pricing{PromptTokenCost: 0.03, CompletionTokenCost: 0.06},
		},
		"gpt-4-32k": {
			ID:          "gpt-4-32k",
			Name:        "GPT-4 32K",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 32768,
			Pricing:     &Pricing{PromptTokenCost: 0.06, CompletionTokenCost: 0.12},
		},
		"gpt-3.5-turbo": {
			ID:          "gpt-3.5-turbo",
			Name:        "GPT-3.5 Turbo",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 4096,
			Pricing:     &Pricing{PromptTokenCost: 0.0015, CompletionTokenCost: 0.002},
		},
		"gpt-3.5-turbo-16k": {
			ID:          "gpt-3.5-turbo-16k",
			Name:        "GPT-3.5 Turbo 16K",
			Created:     time.Now(),
			OwnedBy:     "openai",
			ContextSize: 16384,
			Pricing:     &Pricing{PromptTokenCost: 0.003, CompletionTokenCost: 0.004},
		},
	}

	for _, model := range p.config.Models {
		if info, exists := modelInfo[model]; exists {
			p.models[model] = info
		}
	}
	for _, model := range modelList.Models {
		if info, ok := modelInfo[model.ID]; ok {
			if _, configured := p.models[model.ID]; configured {
				p.models[model.ID] = info
			}
		}
	}
	return nil
}

// setDefaults sets default models if initialization fails
func (p *OpenAIProvider) setDefaults() {
	p.models["gpt-4"] = &ModelInfo{
		ID:          "gpt-4",
		Name:        "GPT-4",
		Created:     time.Now(),
		OwnedBy:     "openai",
		ContextSize: 8192,
		Pricing:     &Pricing{PromptTokenCost: 0.03, CompletionTokenCost: 0.06},
	}
	p.models["gpt-3.5-turbo"] = &ModelInfo{
		ID:          "gpt-3.5-turbo",
		Name:        "GPT-3.5 Turbo",
		Created:     time.Now(),
		OwnedBy:     "openai",
		ContextSize: 4096,
		Pricing:     &Pricing{PromptTokenCost: 0.0015, CompletionTokenCost: 0.002},
	}
}
