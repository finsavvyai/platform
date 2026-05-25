//go:build ignore

package providers

import (
	"context"
	"time"
)

// Provider defines the interface for all LLM providers
type Provider interface {
	// Complete generates a text completion
	Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error)

	// GetTokenCount estimates the number of tokens in the text
	GetTokenCount(text string) (int, error)

	// GetModelInfo returns information about available models
	GetModelInfo() *ModelInfo

	// GetName returns the provider name
	GetName() string

	// Health checks if the provider is healthy
	Health(ctx context.Context) error

	// Close closes the provider and cleans up resources
	Close() error
}

// CompletionRequest represents a generic completion request
type CompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
	Stop        []string  `json:"stop,omitempty"`
}

// CompletionResponse represents a generic completion response
type CompletionResponse struct {
	ID      string    `json:"id"`
	Object  string    `json:"object"`
	Created time.Time `json:"created"`
	Model   string    `json:"model"`
	Choices []Choice  `json:"choices"`
	Usage   *Usage    `json:"usage"`
}

// Message represents a message in the conversation
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

// Choice represents a choice in the completion response
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message,omitempty"`
	Text         string  `json:"text,omitempty"`
	FinishReason string  `json:"finish_reason"`
}

// Usage represents token usage information
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ModelInfo represents information about a model
type ModelInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Created     time.Time `json:"created"`
	OwnedBy     string    `json:"owned_by"`
	ContextSize int       `json:"context_size"`
	Pricing     *Pricing  `json:"pricing,omitempty"`
}

// Pricing represents the pricing information for a model
type Pricing struct {
	PromptTokenCost     float64 `json:"prompt_token_cost"`     // Cost per 1K prompt tokens
	CompletionTokenCost float64 `json:"completion_token_cost"` // Cost per 1K completion tokens
}

// ProviderConfig represents the configuration for a provider
type ProviderConfig struct {
	Type        string            `yaml:"type"`
	APIKey      string            `yaml:"api_key"`
	BaseURL     string            `yaml:"base_url,omitempty"`
	Models      []string          `yaml:"models"`
	Priority    int               `yaml:"priority"`
	Timeout     int               `yaml:"timeout"`    // Timeout in seconds
	RateLimit   int               `yaml:"rate_limit"` // Requests per minute
	RetryCount  int               `yaml:"retry_count"`
	Enabled     bool              `yaml:"enabled"`
	ExtraConfig map[string]string `yaml:"extra_config,omitempty"`
}
