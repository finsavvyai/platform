//go:build ignore

package providers

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// Provider defines the interface that all LLM providers must implement
type Provider interface {
	// Complete generates a text completion
	Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error)

	// CompleteStream generates a streaming text completion
	CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan StreamChunk, error)

	// GetTokenCount calculates the number of tokens in the given text
	GetTokenCount(text string) (int, error)

	// GetModelInfo returns information about available models
	GetModelInfo() ([]models.ModelInfo, error)

	// Health checks the health of the provider
	Health(ctx context.Context) (*models.HealthStatus, error)

	// GetModelCost calculates the cost for a given request
	GetModelCost(model string, promptTokens int, completionTokens int) (float64, error)

	// GetName returns the provider name
	GetName() string

	// IsEnabled returns whether the provider is currently enabled
	IsEnabled() bool

	// SetEnabled enables or disables the provider
	SetEnabled(enabled bool)
}

// StreamChunk represents a chunk of streaming response
type StreamChunk struct {
	ID      string            `json:"id"`
	Object  string            `json:"object"`
	Created int64             `json:"created"`
	Model   string            `json:"model"`
	Choices []StreamChoice    `json:"choices"`
	Done    bool              `json:"done"`
	Error   error             `json:"error,omitempty"`
	Meta    map[string]string `json:"meta,omitempty"`
}

// StreamChoice represents a choice in a streaming response
type StreamChoice struct {
	Index        int    `json:"index"`
	Delta        Delta  `json:"delta"`
	FinishReason string `json:"finish_reason,omitempty"`
}

// Delta represents the delta in a streaming response
type Delta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

// BaseProvider provides common functionality for all providers
type BaseProvider struct {
	name             string
	enabled          bool
	config           models.ProviderConfig
	lastHealthCheck  time.Time
	lastHealthStatus *models.HealthStatus
}

// NewBaseProvider creates a new base provider
func NewBaseProvider(name string, config models.ProviderConfig) *BaseProvider {
	return &BaseProvider{
		name:    name,
		enabled: config.Enabled,
		config:  config,
	}
}

// GetName returns the provider name
func (p *BaseProvider) GetName() string {
	return p.name
}

// IsEnabled returns whether the provider is enabled
func (p *BaseProvider) IsEnabled() bool {
	return p.enabled
}

// SetEnabled enables or disables the provider
func (p *BaseProvider) SetEnabled(enabled bool) {
	p.enabled = enabled
}

// GetConfig returns the provider configuration
func (p *BaseProvider) GetConfig() models.ProviderConfig {
	return p.config
}

// ShouldRetry determines if a request should be retried based on the error
func ShouldRetry(err error, attempt int) bool {
	// Don't retry if we've exceeded max attempts
	if attempt >= 3 {
		return false
	}

	// Retry on network errors and rate limits
	if err != nil {
		errorStr := err.Error()
		return contains(errorStr, "connection") ||
			contains(errorStr, "timeout") ||
			contains(errorStr, "rate limit") ||
			contains(errorStr, "too many requests")
	}

	return false
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			func() bool {
				for i := 1; i <= len(s)-len(substr); i++ {
					if s[i:i+len(substr)] == substr {
						return true
					}
				}
				return false
			}())))
}
