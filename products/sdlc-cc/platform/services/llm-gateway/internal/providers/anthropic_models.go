package providers

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/anthropics/anthropic-sdk-go"
)

// GetTokenCount estimates token count.
func (p *AnthropicProvider) GetTokenCount(text string) (int, error) {
	n := len(text) / 4
	if n < 1 {
		n = 1
	}
	return n, nil
}

// GetModelInfo returns model info from config or defaults.
func (p *AnthropicProvider) GetModelInfo() ([]models.ModelInfo, error) {
	cfg := p.GetConfig()
	out := []models.ModelInfo{}
	for _, m := range cfg.Models {
		out = append(out, models.ModelInfo{
			ID:           m.ID,
			Name:         m.Name,
			Provider:     p.GetName(),
			MaxTokens:    m.MaxTokens,
			InputCost:    m.InputCost * cfg.CostMultiplier,
			OutputCost:   m.OutputCost * cfg.CostMultiplier,
			Capabilities: m.Capabilities,
			IsAvailable:  m.Enabled && p.IsEnabled(),
		})
	}
	if len(out) == 0 {
		out = []models.ModelInfo{
			{ID: "claude-3-opus-20240229", Name: "Claude 3 Opus", Provider: p.GetName(), MaxTokens: 4096, InputCost: 0.015 * cfg.CostMultiplier, OutputCost: 0.075 * cfg.CostMultiplier, IsAvailable: p.IsEnabled()},
			{ID: "claude-3-sonnet-20240229", Name: "Claude 3 Sonnet", Provider: p.GetName(), MaxTokens: 4096, InputCost: 0.003 * cfg.CostMultiplier, OutputCost: 0.015 * cfg.CostMultiplier, IsAvailable: p.IsEnabled()},
			{ID: "claude-3-haiku-20240307", Name: "Claude 3 Haiku", Provider: p.GetName(), MaxTokens: 4096, InputCost: 0.00025 * cfg.CostMultiplier, OutputCost: 0.00125 * cfg.CostMultiplier, IsAvailable: p.IsEnabled()},
		}
	}
	return out, nil
}

// Health checks the Anthropic provider.
func (p *AnthropicProvider) Health(ctx context.Context) (*models.HealthStatus, error) {
	start := time.Now()
	_, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaude_3_Haiku_20240307,
		MaxTokens: 1,
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("ping"))},
	})
	st := &models.HealthStatus{
		Provider: p.GetName(), LastChecked: time.Now(), Latency: time.Since(start),
		Metadata: map[string]string{},
	}
	if err != nil {
		st.Status = "unhealthy"
		st.Error = err.Error()
	} else {
		st.Status = "healthy"
	}
	p.lastHealthCheck = time.Now()
	p.lastHealthStatus = st
	return st, nil
}

// GetModelCost returns cost for the model and token counts.
func (p *AnthropicProvider) GetModelCost(model string, promptTokens, completionTokens int) (float64, error) {
	infos, _ := p.GetModelInfo()
	for _, m := range infos {
		if m.ID == model {
			in := (float64(promptTokens) / 1000) * m.InputCost
			out := (float64(completionTokens) / 1000) * m.OutputCost
			return in + out, nil
		}
	}
	return 0.003*float64(promptTokens)/1000 + 0.015*float64(completionTokens)/1000, nil
}
