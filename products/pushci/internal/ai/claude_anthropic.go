package ai

import "os"

// newAnthropicClient builds a client talking to the Anthropic Messages API.
func newAnthropicClient() *Client {
	model := os.Getenv("PUSHCI_AI_MODEL")
	if model == "" {
		model = DefaultAnthropicModel
	}
	return &Client{
		apiKey:   os.Getenv("ANTHROPIC_API_KEY"),
		model:    model,
		provider: ProviderAnthropic,
	}
}

// NewClientWithModel creates an Anthropic client with an explicit
// model. Kept for backwards compatibility; DeepSeek users should set
// PUSHCI_AI_MODEL instead.
func NewClientWithModel(model string) *Client {
	return &Client{
		apiKey:   os.Getenv("ANTHROPIC_API_KEY"),
		model:    model,
		provider: ProviderAnthropic,
	}
}

// NewClientWithEndpoint creates a client pointing at a custom local
// endpoint (llamafile). The provider is marked as "local" so the ask
// path knows to route through the Anthropic Messages API shape that
// llamafile emulates.
func NewClientWithEndpoint(endpoint, model string) *Client {
	return &Client{
		apiKey:   "local",
		model:    model,
		provider: ProviderLocal,
	}
}
