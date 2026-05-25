package ai

import (
	"context"
	"log"
)

// ModelRouter selects the best available LLM provider with cost optimization.
// Priority: Gemma 4 via OpenRouter ($0.14/M) → Claw Gateway → Anthropic ($3/M).
// If OLLAMA_HOST is set, uses local Gemma 4 ($0) instead.
type ModelRouter struct {
	gemma     *GemmaClient
	anthropic *AnthropicClient
	claw      *ClawClient
}

// NewModelRouter creates a router that auto-detects available providers.
func NewModelRouter() *ModelRouter {
	return &ModelRouter{
		gemma:     NewGemmaClient(),
		anthropic: NewAnthropicClient(),
	}
}

// WithClaw adds the Claw Gateway as a middle-tier provider.
func (r *ModelRouter) WithClaw(c *ClawClient) *ModelRouter {
	r.claw = c
	return r
}

// ProviderInfo describes which provider was used.
type ProviderInfo struct {
	Provider string // "gemma4", "claw", "anthropic"
	Model    string
	Local    bool
	Cost     float64 // estimated cost per call ($)
}

// Complete implements screening.LLMClient interface.
// Routes to the cheapest available provider automatically.
func (r *ModelRouter) Complete(
	ctx context.Context, prompt string,
) (string, error) {
	text, _, err := r.CompleteWithInfo(ctx, prompt)
	return text, err
}

// CompleteWithInfo routes to the cheapest available provider and returns provider info.
// Gemma 4 (free, local) → Claw Gateway → Anthropic API.
func (r *ModelRouter) CompleteWithInfo(
	ctx context.Context, prompt string,
) (string, ProviderInfo, error) {
	// Tier 1: Gemma 4 via OpenRouter ($0.14/M) or Ollama ($0)
	if r.gemma.IsAvailable() {
		text, err := r.gemma.Complete(ctx, prompt)
		if err == nil && text != "" {
			cost := 0.0001 // OpenRouter ~$0.14/M tokens
			if r.gemma.IsLocal() {
				cost = 0
			}
			return text, ProviderInfo{
				Provider: "gemma4",
				Model:    r.gemma.Model(),
				Local:    r.gemma.IsLocal(),
				Cost:     cost,
			}, nil
		}
		if err != nil {
			log.Printf("[model-router] gemma4 failed: %v, falling back", err)
		}
	}

	// Tier 2: Claw Gateway (shared, cheaper than direct API)
	if r.claw != nil && r.claw.APIKey != "" {
		text, err := r.claw.Prompt(ctx, "", prompt, 256)
		if err == nil && text != "" {
			return text, ProviderInfo{
				Provider: "claw",
				Model:    "routed",
				Cost:     0.001,
			}, nil
		}
		if err != nil {
			log.Printf("[model-router] claw failed: %v, falling back", err)
		}
	}

	// Tier 3: Direct Anthropic API (most expensive, most reliable)
	if r.anthropic.IsConfigured() {
		text, err := r.anthropic.Complete(ctx, prompt)
		if err == nil {
			return text, ProviderInfo{
				Provider: "anthropic",
				Model:    r.anthropic.Model(),
				Cost:     0.003,
			}, nil
		}
		return "", ProviderInfo{}, err
	}

	return "", ProviderInfo{}, ErrNoProvider
}

// AvailableProviders returns which providers are currently reachable.
func (r *ModelRouter) AvailableProviders() []string {
	var providers []string
	if r.gemma.IsAvailable() {
		providers = append(providers, "gemma4:"+r.gemma.Model())
	}
	if r.claw != nil && r.claw.APIKey != "" {
		providers = append(providers, "claw")
	}
	if r.anthropic.IsConfigured() {
		providers = append(providers, "anthropic:"+r.anthropic.Model())
	}
	return providers
}

// ErrNoProvider is returned when no LLM provider is available.
var ErrNoProvider = errNoProvider{}

type errNoProvider struct{}

func (e errNoProvider) Error() string {
	return "no LLM provider available (set ANTHROPIC_API_KEY or run ollama with gemma4)"
}
