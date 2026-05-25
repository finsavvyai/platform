package providers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sashabaranov/go-openai"
)

// OllamaProvider implements the Provider interface for Ollama (local LLMs).
// Uses OpenAI-compatible API at http://localhost:11434/v1
type OllamaProvider struct {
	*BaseProvider
	client *openai.Client
}

// NewOllamaProvider creates a new Ollama provider.
// APIKey is optional (Ollama ignores it; use "ollama" as placeholder).
func NewOllamaProvider(config models.ProviderConfig) *OllamaProvider {
	baseURL := config.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:11434/v1"
	}
	apiKey := config.APIKey
	if apiKey == "" {
		apiKey = "ollama"
	}

	clientConfig := openai.DefaultConfig(apiKey)
	clientConfig.BaseURL = baseURL
	clientConfig.HTTPClient = &http.Client{
		Timeout: 60 * time.Second,
	}
	if config.Timeout > 0 {
		clientConfig.HTTPClient.Timeout = config.Timeout
	}

	return &OllamaProvider{
		BaseProvider: NewBaseProvider("ollama", config),
		client:      openai.NewClientWithConfig(clientConfig),
	}
}

// Complete generates a text completion using Ollama
func (p *OllamaProvider) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	startTime := time.Now()

	openaiReq := openai.ChatCompletionRequest{
		Model:       req.Model,
		Messages:    convertMessages(req.Messages),
		MaxTokens:   req.MaxTokens,
		Temperature: float32(req.Temperature),
		TopP:        float32(req.TopP),
		Stream:      false,
		Stop:        req.Stop,
	}

	resp, err := p.client.CreateChatCompletion(ctx, openaiReq)
	if err != nil {
		return nil, fmt.Errorf("ollama completion failed: %w", err)
	}

	choices := make([]models.Choice, len(resp.Choices))
	for i, c := range resp.Choices {
		choices[i] = models.Choice{
			Index:        c.Index,
			Message:      models.Message{Role: c.Message.Role, Content: c.Message.Content},
			FinishReason: string(c.FinishReason),
		}
	}

	promptCost, _ := p.GetModelCost(req.Model, resp.Usage.PromptTokens, 0)
	completionCost, _ := p.GetModelCost(req.Model, 0, resp.Usage.CompletionTokens)

	return &models.CompletionResponse{
		ID:      resp.ID,
		Object:  resp.Object,
		Created: resp.Created,
		Model:   resp.Model,
		Choices: choices,
		Usage: models.TokenUsage{
			PromptTokens:     resp.Usage.PromptTokens,
			CompletionTokens: resp.Usage.CompletionTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
		Provider:       p.GetName(),
		ProcessingTime: time.Since(startTime),
		Cost:           promptCost + completionCost,
		Metadata:       req.Metadata,
	}, nil
}

// GetTokenCount estimates token count
func (p *OllamaProvider) GetTokenCount(text string) (int, error) {
	n := len(text) / 4
	if n < 1 {
		n = 1
	}
	return n, nil
}

// GetModelInfo returns model info from config or defaults
func (p *OllamaProvider) GetModelInfo() ([]models.ModelInfo, error) {
	out := []models.ModelInfo{}
	for _, m := range p.config.Models {
		out = append(out, models.ModelInfo{
			ID:           m.ID,
			Name:         m.Name,
			Provider:     p.GetName(),
			MaxTokens:    m.MaxTokens,
			InputCost:    m.InputCost * p.config.CostMultiplier,
			OutputCost:   m.OutputCost * p.config.CostMultiplier,
			Capabilities: m.Capabilities,
			IsAvailable:  m.Enabled && p.enabled,
		})
	}
	if len(out) == 0 {
		out = []models.ModelInfo{
			{ID: "llama2", Name: "Llama 2", Provider: p.GetName(), MaxTokens: 8192, IsAvailable: p.enabled},
		}
	}
	return out, nil
}

// Health checks Ollama availability
func (p *OllamaProvider) Health(ctx context.Context) (*models.HealthStatus, error) {
	start := time.Now()
	req := openai.ChatCompletionRequest{
		Model:    "llama2",
		Messages: []openai.ChatCompletionMessage{{Role: "user", Content: "ping"}},
		MaxTokens: 1,
	}
	_, err := p.client.CreateChatCompletion(ctx, req)
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
	return st, nil
}

// GetModelCost returns cost (Ollama is free; 0 or config)
func (p *OllamaProvider) GetModelCost(model string, promptTokens, completionTokens int) (float64, error) {
	infos, _ := p.GetModelInfo()
	for _, m := range infos {
		if m.ID == model {
			in := (float64(promptTokens) / 1000) * m.InputCost
			out := (float64(completionTokens) / 1000) * m.OutputCost
			return in + out, nil
		}
	}
	return 0, nil
}
