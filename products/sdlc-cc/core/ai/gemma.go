package ai

import (
	"context"
	"net/http"
	"os"
	"time"
)

// GemmaClient connects to an LLM provider (cloud or local Ollama).
// Cloud routing is priority-ordered: DeepSeek → Groq → Gemini →
// OpenRouter — picked automatically based on which env vars are set.
// Local falls back to Ollama ($0/token, requires a GPU) when no
// cloud key is configured.
type GemmaClient struct {
	endpoint string
	apiKey   string
	model    string
	provider string
	isGemini bool
	local    bool
	client   *http.Client
}

// NewGemmaClient creates a cloud-first LLM client.
// Priority: DeepSeek → Groq → Gemini → OpenRouter → Ollama (local).
func NewGemmaClient() *GemmaClient {
	client := &http.Client{Timeout: 30 * time.Second}

	if cfg := DetectProvider(); cfg != nil {
		return &GemmaClient{
			endpoint: cfg.Endpoint,
			apiKey:   cfg.APIKey,
			model:    cfg.Model,
			provider: cfg.Name,
			isGemini: cfg.IsGemini,
			local:    false,
			client:   client,
		}
	}

	// Local: Ollama fallback
	endpoint := os.Getenv("OLLAMA_HOST")
	if endpoint == "" {
		endpoint = "http://localhost:11434"
	}
	model := os.Getenv("GEMMA_MODEL")
	if model == "" {
		model = "gemma4"
	}
	return &GemmaClient{
		endpoint: endpoint,
		model:    model,
		provider: "ollama",
		local:    true,
		client:   client,
	}
}

// IsAvailable checks connectivity to the configured provider.
// For cloud providers this is a cheap check on the API key; for
// local Ollama it pings /api/tags to confirm the daemon is running.
func (g *GemmaClient) IsAvailable() bool {
	if !g.local {
		return g.apiKey != ""
	}
	return g.checkOllama()
}

// Complete sends a screening prompt to the configured LLM and
// returns the raw completion text. Dispatches to the right
// provider-specific transport based on flags set at construction.
func (g *GemmaClient) Complete(
	ctx context.Context, prompt string,
) (string, error) {
	if g.local {
		return g.completeLocal(ctx, prompt)
	}
	if g.isGemini {
		return g.completeGemini(ctx, prompt)
	}
	return g.completeCloud(ctx, prompt)
}

// Provider returns the active provider name (e.g. "deepseek", "groq").
func (g *GemmaClient) Provider() string { return g.provider }

// IsLocal returns true if the client is talking to Ollama instead
// of a cloud API. Callers use this to skip cloud-billing-sensitive
// codepaths when running against a local GPU.
func (g *GemmaClient) IsLocal() bool { return g.local }

// Model returns the configured model identifier.
func (g *GemmaClient) Model() string { return g.model }
