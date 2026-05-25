package llm

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/SDLC/llm-gateway/internal/observability"
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
	reasoningBank     *ReasoningBank
	smartRouter       *SmartRouter
	langfuse          *observability.LangfuseClient
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
	SmartRouterEnabled bool                    `yaml:"smart_router_enabled"`
	Security           models.SecurityConfig   `yaml:"security"`
	Budgets            models.BudgetConfig     `yaml:"budgets"`
	Providers          []models.ProviderConfig `yaml:"providers"`
	ReasoningBankTTL   time.Duration           `yaml:"reasoning_bank_ttl"`
}

// NewGateway creates a new LLM gateway. If factory is nil, one is created from config.Providers.
// If cacheStore is non-nil and REASONING_BANK_ENABLED is true, prompt caching is active.
func NewGateway(config *Config, costTracker storage.CostTracker,
	validator validation.Validator, promptDefender validation.PromptDefender,
	responseSanitizer validation.ResponseSanitizer, logger *logrus.Logger,
	factory *providers.Factory, cacheStore CacheStore) *Gateway {

	if factory == nil {
		factory = providers.NewFactory(config.Providers)
	}

	var rb *ReasoningBank
	if cacheStore != nil && IsEnabled() {
		rb = NewReasoningBank(cacheStore, config.ReasoningBankTTL, logger)
		logger.Info("ReasoningBank enabled — prompt-level caching active")
	}

	var sr *SmartRouter
	if config.SmartRouterEnabled {
		sr = NewSmartRouter(logger)
		logger.Info("SmartRouter enabled — self-learning provider selection active")
	}

	return &Gateway{
		providerFactory:   factory,
		costTracker:       costTracker,
		validator:         validator,
		promptDefender:    promptDefender,
		responseSanitizer: responseSanitizer,
		reasoningBank:     rb,
		smartRouter:       sr,
		langfuse:          observability.NewLangfuseClient(logger),
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

			// Sanitize instead of blocking
			req = g.promptDefender.SanitizePrompt(req)
		}
	}

	// Check budget if cost tracking is enabled
	if g.config.EnableCostTracking {
		if err := g.checkBudget(ctx, req.TenantID, req.UserID); err != nil {
			return nil, fmt.Errorf("budget check failed: %w", err)
		}
	}

	// ReasoningBank: check cache before calling provider
	var cacheKey string
	if g.reasoningBank != nil {
		systemPrompt, userMessage := extractPromptsFromRequest(req)
		cacheKey = BuildCacheKey(req.Model, systemPrompt, userMessage)
		if cached := g.reasoningBank.CheckCache(ctx, cacheKey); cached != nil {
			g.logger.WithField("cache_key", cacheKey).Info("ReasoningBank cache hit")
			cached.Metadata = map[string]string{"reasoning_bank": "hit"}
			return cached, nil
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

	// ReasoningBank: store successful response in cache
	if g.reasoningBank != nil && cacheKey != "" {
		g.reasoningBank.StoreInCache(ctx, cacheKey, response)
	}

	// Langfuse observability (no-op if disabled)
	g.traceCompletion(ctx, req, response)

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

	return provider.CompleteStream(ctx, req)
}
