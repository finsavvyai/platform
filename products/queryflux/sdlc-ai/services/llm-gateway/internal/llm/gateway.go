//go:build ignore

package llm

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/internal/validation"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
)

// Gateway manages LLM requests with failover and cost tracking
type Gateway struct {
	providerFactory   *providers.Factory
	costTracker       storage.CostTracker
	validator         validation.Validator
	promptDefender    validation.PromptDefender
	responseSanitizer validation.ResponseSanitizer
	logger            *logrus.Logger
	config            *Config
	mutex             sync.RWMutex
}

// Config holds gateway configuration
type Config struct {
	DefaultProvider    string                  `yaml:"default_provider"`
	MaxRetries         int                     `yaml:"max_retries"`
	RetryDelay         time.Duration           `yaml:"retry_delay"`
	Timeout            time.Duration           `yaml:"timeout"`
	EnableFailover     bool                    `yaml:"enable_failover"`
	EnableCostTracking bool                    `yaml:"enable_cost_tracking"`
	EnableValidation   bool                    `yaml:"enable_validation"`
	Security           models.SecurityConfig   `yaml:"security"`
	Budgets            BudgetConfig            `yaml:"budgets"`
	Providers          []models.ProviderConfig `yaml:"providers"`
}

// BudgetConfig holds budget configuration
type BudgetConfig struct {
	DefaultMonthlyLimit float64 `yaml:"default_monthly_limit"`
	DefaultDailyLimit   float64 `yaml:"default_daily_limit"`
	AlertThreshold      float64 `yaml:"alert_threshold"`
	Currency            string  `yaml:"currency"`
}

// NewGateway creates a new LLM gateway
func NewGateway(config *Config, costTracker storage.CostTracker,
	validator validation.Validator, promptDefender validation.PromptDefender,
	responseSanitizer validation.ResponseSanitizer, logger *logrus.Logger) *Gateway {

	providerFactory := providers.NewFactory(config.Providers)

	return &Gateway{
		providerFactory:   providerFactory,
		costTracker:       costTracker,
		validator:         validator,
		promptDefender:    promptDefender,
		responseSanitizer: responseSanitizer,
		logger:            logger,
		config:            config,
	}
}

// Complete handles a completion request with failover
func (g *Gateway) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	// Validate request
	if g.config.EnableValidation {
		if err := g.validator.ValidateRequest(req); err != nil {
			return nil, fmt.Errorf("validation failed: %w", err)
		}
	}

	// Check for prompt injection
	if g.config.Security.PromptInjectionDetection {
		if isInjection, patterns := g.promptDefender.DetectPromptInjection(req); isInjection {
			g.logger.WithFields(logrus.Fields{
				"user_id":   req.UserID,
				"tenant_id": req.TenantID,
				"patterns":  patterns,
			}).Warn("Prompt injection detected")

			// You can either block or sanitize the request
			// For now, we'll sanitize
			req = g.promptDefender.SanitizePrompt(req)
		}
	}

	// Check budget if cost tracking is enabled
	if g.config.EnableCostTracking {
		if err := g.checkBudget(ctx, req.TenantID, req.UserID); err != nil {
			return nil, fmt.Errorf("budget check failed: %w", err)
		}
	}

	// Get the best provider for the request
	provider, err := g.selectProvider(req)
	if err != nil {
		return nil, fmt.Errorf("provider selection failed: %w", err)
	}

	// Attempt completion with failover
	response, err := g.attemptCompletionWithFailover(ctx, req, provider)
	if err != nil {
		return nil, err
	}

	// Sanitize response if enabled
	if g.config.Security.ResponseSanitization {
		response = g.responseSanitizer.SanitizeResponse(response)
	}

	// Track cost if enabled
	if g.config.EnableCostTracking {
		if err := g.costTracker.RecordCost(ctx, &models.CostRecord{
			ID:           generateID(),
			TenantID:     req.TenantID,
			UserID:       req.UserID,
			Provider:     response.Provider,
			Model:        response.Model,
			PromptTokens: response.Usage.PromptTokens,
			OutputTokens: response.Usage.CompletionTokens,
			TotalTokens:  response.Usage.TotalTokens,
			Cost:         response.Cost,
			Currency:     g.config.Budgets.Currency,
			Timestamp:    time.Now(),
			RequestID:    req.Metadata["request_id"],
		}); err != nil {
			g.logger.WithError(err).Error("Failed to record cost")
		}
	}

	return response, nil
}

// CompleteStream handles a streaming completion request
func (g *Gateway) CompleteStream(ctx context.Context, req *models.CompletionRequest) (<-chan providers.StreamChunk, error) {
	// Validate request
	if g.config.EnableValidation {
		if err := g.validator.ValidateRequest(req); err != nil {
			return nil, fmt.Errorf("validation failed: %w", err)
		}
	}

	// Check for prompt injection
	if g.config.Security.PromptInjectionDetection {
		if isInjection, _ := g.promptDefender.DetectPromptInjection(req); isInjection {
			return nil, fmt.Errorf("prompt injection detected")
		}
	}

	// Get provider
	provider, err := g.selectProvider(req)
	if err != nil {
		return nil, fmt.Errorf("provider selection failed: %w", err)
	}

	// Create stream
	return provider.CompleteStream(ctx, req)
}

// selectProvider selects the best provider for a request
func (g *Gateway) selectProvider(req *models.CompletionRequest) (providers.Provider, error) {
	// If specific model is requested, find provider for that model
	if req.Model != "" {
		provider, err := g.providerFactory.GetProviderForModel(req.Model)
		if err == nil {
			return provider, nil
		}
	}

	// Otherwise, get providers by priority
	providers := g.providerFactory.GetProvidersByPriority()
	if len(providers) == 0 {
		return nil, fmt.Errorf("no providers available")
	}

	// Filter healthy providers
	healthyProviders := g.providerFactory.GetHealthyProviders()
	if len(healthyProviders) > 0 {
		return healthyProviders[0], nil
	}

	// If no healthy providers, return the first available provider
	return providers[0], nil
}

// attemptCompletionWithFailover attempts completion with failover to other providers
func (g *Gateway) attemptCompletionWithFailover(ctx context.Context, req *models.CompletionRequest,
	initialProvider providers.Provider) (*models.CompletionResponse, error) {

	providers := g.providerFactory.GetProvidersByPriority()

	// Find the initial provider in the list
	var startIndex int
	for i, p := range providers {
		if p.GetName() == initialProvider.GetName() {
			startIndex = i
			break
		}
	}

	var lastError error

	// Try each provider in order
	for i := 0; i < len(providers); i++ {
		providerIndex := (startIndex + i) % len(providers)
		provider := providers[providerIndex]

		if !provider.IsEnabled() {
			continue
		}

		// Check if provider supports the requested model
		if req.Model != "" {
			modelInfo, err := provider.GetModelInfo()
			if err != nil {
				continue
			}

			modelSupported := false
			for _, model := range modelInfo {
				if model.ID == req.Model && model.IsAvailable {
					modelSupported = true
					break
				}
			}

			if !modelSupported {
				continue
			}
		}

		// Attempt completion
		response, err := provider.Complete(ctx, req)
		if err == nil {
			return response, nil
		}

		lastError = err

		// Check if we should retry with this provider
		if providers.ShouldRetry(err, 0) && g.config.MaxRetries > 0 {
			for attempt := 1; attempt <= g.config.MaxRetries; attempt++ {
				g.logger.WithFields(logrus.Fields{
					"provider": provider.GetName(),
					"attempt":  attempt,
					"error":    err.Error(),
				}).Warn("Retrying completion")

				time.Sleep(g.config.RetryDelay)

				response, retryErr := provider.Complete(ctx, req)
				if retryErr == nil {
					return response, nil
				}

				lastError = retryErr

				// Don't retry if it's not a retryable error
				if !providers.ShouldRetry(retryErr, attempt) {
					break
				}
			}
		}

		// If failover is disabled, don't try other providers
		if !g.config.EnableFailover {
			break
		}

		g.logger.WithFields(logrus.Fields{
			"provider": provider.GetName(),
			"error":    err.Error(),
		}).Warn("Provider failed, trying next provider")
	}

	return nil, fmt.Errorf("all providers failed. Last error: %w", lastError)
}

// checkBudget checks if the tenant/user has sufficient budget
func (g *Gateway) checkBudget(ctx context.Context, tenantID, userID string) error {
	// Get current usage
	usage, err := g.costTracker.GetCurrentUsage(ctx, tenantID, userID)
	if err != nil {
		g.logger.WithError(err).Error("Failed to get current usage")
		// Continue with request even if we can't check budget
		return nil
	}

	// Check against limits
	if g.config.Budgets.DefaultDailyLimit > 0 && usage.DailySpend >= g.config.Budgets.DefaultDailyLimit {
		return fmt.Errorf("daily budget exceeded: %.2f/%.2f %s",
			usage.DailySpend, g.config.Budgets.DefaultDailyLimit, g.config.Budgets.Currency)
	}

	if g.config.Budgets.DefaultMonthlyLimit > 0 && usage.MonthlySpend >= g.config.Budgets.DefaultMonthlyLimit {
		return fmt.Errorf("monthly budget exceeded: %.2f/%.2f %s",
			usage.MonthlySpend, g.config.Budgets.DefaultMonthlyLimit, g.config.Budgets.Currency)
	}

	// Check alert threshold
	if g.config.Budgets.AlertThreshold > 0 {
		dailyPercentage := usage.DailySpend / g.config.Budgets.DefaultDailyLimit * 100
		monthlyPercentage := usage.MonthlySpend / g.config.Budgets.DefaultMonthlyLimit * 100

		if dailyPercentage >= g.config.Budgets.AlertThreshold ||
			monthlyPercentage >= g.config.Budgets.AlertThreshold {

			g.logger.WithFields(logrus.Fields{
				"tenant_id":          tenantID,
				"user_id":            userID,
				"daily_percentage":   dailyPercentage,
				"monthly_percentage": monthlyPercentage,
			}).Warn("Budget alert threshold exceeded")
		}
	}

	return nil
}

// GetAvailableModels returns all available models from all providers
func (g *Gateway) GetAvailableModels(ctx context.Context) ([]models.ModelInfo, error) {
	return g.providerFactory.GetAvailableModels()
}

// GetProviderHealth returns the health status of all providers
func (g *Gateway) GetProviderHealth(ctx context.Context) map[string]*models.HealthStatus {
	return g.providerFactory.CheckAllHealth(ctx)
}

// GetProvider returns a specific provider
func (g *Gateway) GetProvider(name string) (providers.Provider, error) {
	return g.providerFactory.GetProvider(name)
}

// ListProviders returns all configured providers
func (g *Gateway) ListProviders() map[string]providers.Provider {
	return g.providerFactory.GetAllProviders()
}

// EnableProvider enables a provider
func (g *Gateway) EnableProvider(name string) error {
	return g.providerFactory.EnableProvider(name)
}

// DisableProvider disables a provider
func (g *Gateway) DisableProvider(name string) error {
	return g.providerFactory.DisableProvider(name)
}

// generateID generates a unique ID
func generateID() string {
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}
