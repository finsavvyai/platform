//go:build ignore

package providers

import (
	"context"
	"time"
)

// Provider defines the interface that all LLM providers must implement
type Provider interface {
	// Complete generates text completion based on the given request
	Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error)

	// GetTokenCount returns the number of tokens in the given text
	GetTokenCount(text string) (int, error)

	// GetModelInfo returns information about the available models
	GetModelInfo() []*ModelInfo

	// Health checks if the provider is healthy and accessible
	Health(ctx context.Context) error

	// GetName returns the provider name
	GetName() string

	// Close closes the provider and cleans up resources
	Close() error
}

// CompletionRequest represents a request to generate text completion
type CompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	TopP        float64   `json:"top_p,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
	Stop        []string  `json:"stop,omitempty"`
}

// Message represents a message in the conversation
type Message struct {
	Role         string      `json:"role"`
	Content      string      `json:"content"`
	Name         string      `json:"name,omitempty"`
	FunctionCall interface{} `json:"function_call,omitempty"`
}

// CompletionResponse represents a response from the LLM provider
type CompletionResponse struct {
	ID      string    `json:"id"`
	Object  string    `json:"object"`
	Created time.Time `json:"created"`
	Model   string    `json:"model"`
	Choices []Choice  `json:"choices"`
	Usage   *Usage    `json:"usage"`
}

// Choice represents a choice in the completion response
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message,omitempty"`
	Text         string  `json:"text,omitempty"`
	FinishReason string  `json:"finish_reason"`
	Delta        Message `json:"delta,omitempty"`
}

// Usage represents token usage information
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ModelInfo represents information about an available model
type ModelInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Created     time.Time `json:"created"`
	OwnedBy     string    `json:"owned_by"`
	ContextSize int       `json:"context_size"`
	Pricing     *Pricing  `json:"pricing"`
}

// Pricing represents the pricing information for a model
type Pricing struct {
	PromptTokenCost     float64 `json:"prompt_token_cost"`     // Cost per 1K prompt tokens
	CompletionTokenCost float64 `json:"completion_token_cost"` // Cost per 1K completion tokens
}

// ProviderConfig represents the configuration for a provider
type ProviderConfig struct {
	APIKey     string            `yaml:"api_key"`
	BaseURL    string            `yaml:"base_url"`
	Models     []string          `yaml:"models"`
	Priority   int               `yaml:"priority"`
	Timeout    int               `yaml:"timeout"`     // Timeout in seconds
	RetryCount int               `yaml:"retry_count"` // Number of retries
	RetryDelay int               `yaml:"retry_delay"` // Delay between retries in seconds
	RateLimit  RateLimitConfig   `yaml:"rate_limit"`
	Custom     map[string]string `yaml:"custom"` // Provider-specific configuration
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	RequestsPerSecond int `yaml:"requests_per_second"`
	TokensPerSecond   int `yaml:"tokens_per_second"`
}

// BaseProvider provides common functionality for all providers
type BaseProvider struct {
	name   string
	config ProviderConfig
}

// NewBaseProvider creates a new base provider
func NewBaseProvider(name string, config ProviderConfig) *BaseProvider {
	return &BaseProvider{
		name:   name,
		config: config,
	}
}

// GetName returns the provider name
func (p *BaseProvider) GetName() string {
	return p.name
}

// GetConfig returns the provider configuration
func (p *BaseProvider) GetConfig() ProviderConfig {
	return p.config
}
