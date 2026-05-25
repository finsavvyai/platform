package providers

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// GetTokenCount estimates the token count for OpenAI models
func (p *OpenAIProvider) GetTokenCount(text string) (int, error) {
	estimatedTokens := len(text) / 4
	if estimatedTokens < 1 {
		estimatedTokens = 1
	}
	return estimatedTokens, nil
}

// GetModelInfo returns information about available OpenAI models
func (p *OpenAIProvider) GetModelInfo() ([]models.ModelInfo, error) {
	out := []models.ModelInfo{}
	cfg := p.GetConfig()

	for _, modelConfig := range cfg.Models {
		m := models.ModelInfo{
			ID:           modelConfig.ID,
			Name:         modelConfig.Name,
			Provider:     p.GetName(),
			MaxTokens:    modelConfig.MaxTokens,
			InputCost:    modelConfig.InputCost * cfg.CostMultiplier,
			OutputCost:   modelConfig.OutputCost * cfg.CostMultiplier,
			Capabilities: modelConfig.Capabilities,
			IsAvailable:  modelConfig.Enabled && p.IsEnabled(),
		}
		out = append(out, m)
	}

	if len(out) == 0 {
		out = []models.ModelInfo{
			{
				ID: "gpt-4", Name: "GPT-4", Provider: p.GetName(), MaxTokens: 8192,
				InputCost: 0.03 * cfg.CostMultiplier, OutputCost: 0.06 * cfg.CostMultiplier,
				Capabilities: []string{"chat", "completion", "function-calling"},
				IsAvailable: p.IsEnabled(),
			},
			{
				ID: "gpt-3.5-turbo", Name: "GPT-3.5 Turbo", Provider: p.GetName(), MaxTokens: 4096,
				InputCost: 0.0015 * cfg.CostMultiplier, OutputCost: 0.002 * cfg.CostMultiplier,
				Capabilities: []string{"chat", "completion"},
				IsAvailable: p.IsEnabled(),
			},
		}
	}
	return out, nil
}

// Health checks the health of the OpenAI provider
func (p *OpenAIProvider) Health(ctx context.Context) (*models.HealthStatus, error) {
	startTime := time.Now()
	_, err := p.client.ListModels(ctx)

	status := &models.HealthStatus{
		Provider:    p.GetName(),
		LastChecked: time.Now(),
		Latency:     time.Since(startTime),
		Metadata:    make(map[string]string),
	}
	if err != nil {
		status.Status = "unhealthy"
		status.Error = err.Error()
	} else {
		status.Status = "healthy"
	}

	p.lastHealthCheck = time.Now()
	p.lastHealthStatus = status
	return status, nil
}

// GetModelCost calculates the cost for a given request
func (p *OpenAIProvider) GetModelCost(model string, promptTokens int, completionTokens int) (float64, error) {
	models, err := p.GetModelInfo()
	if err != nil {
		return 0, err
	}

	var inputCost, outputCost float64
	for _, m := range models {
		if m.ID == model {
			inputCost = m.InputCost
			outputCost = m.OutputCost
			break
		}
	}
	if inputCost == 0 && outputCost == 0 {
		inputCost = 0.0015
		outputCost = 0.002
	}

	promptCost := (float64(promptTokens) / 1000.0) * inputCost
	completionCost := (float64(completionTokens) / 1000.0) * outputCost
	return promptCost + completionCost, nil
}
