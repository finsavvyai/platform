package container

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/application/ports"
	services "github.com/queryflux/backend/internal/application/services/ai"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/infrastructure/ai"
	"github.com/queryflux/backend/internal/infrastructure/mocks"
	"github.com/queryflux/backend/internal/infrastructure/rate_limiter"
	"github.com/queryflux/backend/internal/infrastructure/security"
)

// AIContainer holds all AI-related dependencies
type AIContainer struct {
	AIService         ports.AIService
	AIRepository      ports.AIRepository
	RateLimiter       ports.RateLimiter
	TokenTracker      ports.TokenTracker
	PromptManager     ports.PromptTemplateManager
	CacheManager      ports.CacheManager
	HealthChecker     ports.AIHealthChecker
	MonitoringService ports.MonitoringService
	AuditLogger       ports.AuditLogger
	EncryptionService ports.EncryptionService
}

// NewAIContainer creates a new AI container with all dependencies
func NewAIContainer(logger *zap.Logger, isDevelopment bool) *AIContainer {
	// Create repository (use mock for development, real implementation for production)
	var aiRepository ports.AIRepository
	if isDevelopment {
		aiRepository = mocks.NewMockAIRepository()
	} else {
		// aiRepository = repository.NewAIRepository(db) // Real implementation
		aiRepository = mocks.NewMockAIRepository() // TODO: Replace with real implementation
	}

	// Create rate limiter
	rateLimiter := rate_limiter.NewTokenBucketLimiter(logger)

	// Create token tracker
	tokenTracker := mocks.NewMockTokenTracker()
	// tokenTracker = repository.NewTokenTracker(db) // Real implementation

	// Create prompt manager
	promptManager := ai.NewTemplateManager(logger)

	// Create cache manager
	cacheManager := mocks.NewMockCacheManager()
	// cacheManager = cache.NewRedisCache(redisClient) // Real implementation

	// Create health checker
	healthChecker := mocks.NewMockAIHealthChecker()

	// Create monitoring service
	monitoringService := mocks.NewMockMonitoringService()

	// Create audit logger
	auditLogger := mocks.NewMockAuditLogger()

	// Create encryption service
	masterKey := "queryflux-encryption-master-key-32-chars!"
	encryptionService, err := security.NewAES256EncryptionService(masterKey, logger)
	if err != nil {
		logger.Fatal("Failed to create encryption service", zap.Error(err))
	}

	// Create AI service
	aiService := services.NewImprovedAIService(
		aiRepository,
		rateLimiter,
		tokenTracker,
		promptManager,
		cacheManager,
		healthChecker,
		monitoringService,
		auditLogger,
		encryptionService,
		logger,
	)

	return &AIContainer{
		AIService:         aiService,
		AIRepository:      aiRepository,
		RateLimiter:       rateLimiter,
		TokenTracker:      tokenTracker,
		PromptManager:     promptManager,
		CacheManager:      cacheManager,
		HealthChecker:     healthChecker,
		MonitoringService: monitoringService,
		AuditLogger:       auditLogger,
		EncryptionService: encryptionService,
	}
}

// SetupDefaultAIConfigs sets up default AI configurations
func (c *AIContainer) SetupDefaultAIConfigs() error {
	ctx := context.Background()

	// Create OpenAI configuration
	openAIConfig := &domain.AIConfig{
		Service:     domain.AIServiceOpenAI,
		Model:       "gpt-4",
		BaseURL:     "https://api.openai.com/v1",
		MaxTokens:   2000,
		Temperature: 0.1,
		Timeout:     30 * time.Second,
		RateLimit:   20,
		Enabled:     false, // Disabled by default until API key is provided
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Encrypt API key (empty for now)
	encryptedKey, err := c.EncryptionService.EncryptAPIKey(ctx, "")
	if err != nil {
		return err
	}
	openAIConfig.APIKey = encryptedKey

	// Save configuration
	err = c.AIRepository.CreateAIConfig(ctx, openAIConfig)
	if err != nil {
		return err
	}

	// Create Claude configuration
	claudeConfig := &domain.AIConfig{
		Service:     domain.AIServiceClaude,
		Model:       "claude-3-sonnet-20240229",
		BaseURL:     "https://api.anthropic.com",
		MaxTokens:   2000,
		Temperature: 0.1,
		Timeout:     30 * time.Second,
		RateLimit:   15,
		Enabled:     false, // Disabled by default until API key is provided
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Encrypt API key (empty for now)
	encryptedKey, err = c.EncryptionService.EncryptAPIKey(ctx, "")
	if err != nil {
		return err
	}
	claudeConfig.APIKey = encryptedKey

	// Save configuration
	err = c.AIRepository.CreateAIConfig(ctx, claudeConfig)
	if err != nil {
		return err
	}

	return nil
}

// UpdateAIConfig updates an AI service configuration
func (c *AIContainer) UpdateAIConfig(service domain.AIService, apiKey string, enabled bool) error {
	ctx := context.Background()

	// Get existing config
	config, err := c.AIRepository.GetAIConfig(ctx, service)
	if err != nil {
		return err
	}

	// Encrypt new API key
	encryptedKey, err := c.EncryptionService.EncryptAPIKey(ctx, apiKey)
	if err != nil {
		return err
	}

	// Update configuration
	config.APIKey = encryptedKey
	config.Enabled = enabled
	config.UpdatedAt = time.Now()

	// Save updated configuration
	err = c.AIRepository.UpdateAIConfig(ctx, config)
	if err != nil {
		return err
	}

	// Refresh AI service to load new configuration
	// This would need to be implemented in the AI service

	return nil
}
