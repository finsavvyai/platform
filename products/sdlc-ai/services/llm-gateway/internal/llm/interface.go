package llm

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// Provider defines the interface for all LLM providers
type Provider interface {
	// Complete generates a completion for the given request
	Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error)

	// StreamCompletion generates a streaming completion
	StreamCompletion(ctx context.Context, req *models.CompletionRequest, callback func(*models.CompletionResponse) error) error

	// GetTokenCount returns the token count for the given text
	GetTokenCount(text string, model string) (int, error)

	// GetModelInfo returns information about available models
	GetModelInfo() ([]models.ModelInfo, error)

	// Health checks if the provider is healthy
	Health(ctx context.Context) (*models.HealthStatus, error)

	// GetName returns the provider name
	GetName() string

	// GetPriority returns the provider priority for failover
	GetPriority() int

	// IsEnabled returns whether the provider is enabled
	IsEnabled() bool

	// CalculateCost calculates the cost for a given usage
	CalculateCost(usage *models.TokenUsage, model string) (float64, error)
}

// BaseProvider provides common functionality for all providers
type BaseProvider struct {
	name         string
	priority     int
	enabled      bool
	config       models.ProviderConfig
	healthStatus models.HealthStatus
}

// NewBaseProvider creates a new base provider
func NewBaseProvider(config models.ProviderConfig) *BaseProvider {
	return &BaseProvider{
		name:     config.Name,
		priority: config.Priority,
		enabled:  config.Enabled,
		config:   config,
		healthStatus: models.HealthStatus{
			Provider:    config.Name,
			Status:      "unknown",
			LastChecked: time.Now(),
		},
	}
}

// GetName returns the provider name
func (p *BaseProvider) GetName() string {
	return p.name
}

// GetPriority returns the provider priority
func (p *BaseProvider) GetPriority() int {
	return p.priority
}

// IsEnabled returns whether the provider is enabled
func (p *BaseProvider) IsEnabled() bool {
	return p.enabled
}

// GetConfig returns the provider configuration
func (p *BaseProvider) GetConfig() models.ProviderConfig {
	return p.config
}

// UpdateHealthStatus updates the health status
func (p *BaseProvider) UpdateHealthStatus(status string, latency time.Duration, err error) {
	p.healthStatus.Status = status
	p.healthStatus.Latency = latency
	p.healthStatus.LastChecked = time.Now()
	if err != nil {
		p.healthStatus.Error = err.Error()
	} else {
		p.healthStatus.Error = ""
	}
}

// GetHealthStatus returns the current health status
func (p *BaseProvider) GetHealthStatus() *models.HealthStatus {
	return &p.healthStatus
}

// CalculateCost calculates the cost based on token usage
func (p *BaseProvider) CalculateCost(usage *models.TokenUsage, modelID string) (float64, error) {
	// Find model configuration
	for _, model := range p.config.Models {
		if model.ID == modelID {
			inputCost := float64(usage.PromptTokens) * model.InputCost / 1000
			outputCost := float64(usage.CompletionTokens) * model.OutputCost / 1000
			totalCost := (inputCost + outputCost) * p.config.CostMultiplier
			return totalCost, nil
		}
	}
	return 0, nil
}
