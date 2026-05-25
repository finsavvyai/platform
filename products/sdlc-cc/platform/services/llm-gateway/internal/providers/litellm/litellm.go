// Package litellm implements a providers.Provider that delegates all
// upstream LLM traffic to a LiteLLM (https://github.com/BerriAI/litellm)
// sidecar over its OpenAI-compatible HTTP API.
//
// This is additive: the native OpenAI / Anthropic / Ollama providers
// stay in place. When the gateway config enables LiteLLM, requests are
// routed here instead, and LiteLLM handles provider SDKs, fallback,
// retry, and per-tenant rate limiting via Redis.
package litellm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/pkg/models"
)

// ProviderName is the canonical name used in config, metrics, and logs.
const ProviderName = "litellm"

// Provider talks to a LiteLLM proxy on behalf of the gateway.
type Provider struct {
	*providers.BaseProvider
	client *httpClient
}

// New builds a Provider. Config fields consumed:
//   - BaseURL: LiteLLM proxy URL (fallback: LITELLM_PROXY_URL env)
//   - APIKey:  LiteLLM master key (fallback: LITELLM_MASTER_KEY env)
//   - Timeout: per-request HTTP timeout
func New(config models.ProviderConfig) *Provider {
	return &Provider{
		BaseProvider: providers.NewBaseProvider(ProviderName, config),
		client:       newHTTPClient(config.BaseURL, config.APIKey, config.Timeout),
	}
}

// Complete performs a non-streaming chat completion via LiteLLM.
func (p *Provider) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	start := time.Now()
	body := buildRequest(req, false)

	resp, err := p.client.do(ctx, "POST", "/v1/chat/completions", body, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var out chatResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("litellm: decode response: %w", err)
	}

	choices := make([]models.Choice, len(out.Choices))
	for i, c := range out.Choices {
		choices[i] = models.Choice{
			Index:        c.Index,
			Message:      models.Message{Role: c.Message.Role, Content: c.Message.Content},
			FinishReason: c.FinishReason,
		}
	}

	// LiteLLM emits cost in a response header when cost tracking is on.
	// Fall back to 0 — the gateway's pricing layer can still compute it.
	cost := costFromHeaders(resp.Header)
	modelID := modelFromHeaders(resp.Header, out.Model)

	return &models.CompletionResponse{
		ID:      out.ID,
		Object:  out.Object,
		Created: out.Created,
		Model:   modelID,
		Choices: choices,
		Usage: models.TokenUsage{
			PromptTokens:     out.Usage.PromptTokens,
			CompletionTokens: out.Usage.CompletionTokens,
			TotalTokens:      out.Usage.TotalTokens,
		},
		Provider:       p.GetName(),
		ProcessingTime: time.Since(start),
		Cost:           cost,
		Metadata:       req.Metadata,
	}, nil
}

// GetTokenCount is a rough 4-chars-per-token estimate. The upstream
// LiteLLM proxy reports authoritative token counts on the response;
// this is only used when the gateway needs a pre-call estimate for
// quota checks.
func (p *Provider) GetTokenCount(text string) (int, error) {
	n := len(text) / 4
	if n < 1 {
		n = 1
	}
	return n, nil
}

// GetModelInfo returns the configured model list. The set of models
// actually available is owned by LiteLLM's config.yaml — we surface
// whatever the gateway operator declared in their provider config.
func (p *Provider) GetModelInfo() ([]models.ModelInfo, error) {
	cfg := p.GetConfig()
	out := make([]models.ModelInfo, 0, len(cfg.Models))
	for _, m := range cfg.Models {
		out = append(out, models.ModelInfo{
			ID:           m.ID,
			Name:         m.Name,
			Provider:     p.GetName(),
			MaxTokens:    m.MaxTokens,
			InputCost:    m.InputCost,
			OutputCost:   m.OutputCost,
			Capabilities: m.Capabilities,
			IsAvailable:  m.Enabled && p.IsEnabled(),
		})
	}
	return out, nil
}

// Health hits LiteLLM's liveliness endpoint.
func (p *Provider) Health(ctx context.Context) (*models.HealthStatus, error) {
	start := time.Now()
	resp, err := p.client.do(ctx, "GET", "/health/liveliness", nil, false)
	st := &models.HealthStatus{
		Provider:    p.GetName(),
		LastChecked: time.Now(),
		Latency:     time.Since(start),
	}
	if err != nil {
		st.Status = "unhealthy"
		st.Error = err.Error()
		return st, nil
	}
	defer resp.Body.Close()
	st.Status = "healthy"
	return st, nil
}

// GetModelCost falls back to the static pricing in the provider config.
// Live cost is preferred via the x-litellm-response-cost header in Complete.
func (p *Provider) GetModelCost(model string, promptTokens, completionTokens int) (float64, error) {
	for _, m := range p.GetConfig().Models {
		if m.ID != model {
			continue
		}
		in := (float64(promptTokens) / 1000.0) * m.InputCost
		out := (float64(completionTokens) / 1000.0) * m.OutputCost
		return in + out, nil
	}
	return 0, nil
}
