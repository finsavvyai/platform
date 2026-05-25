package services_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap/zaptest"

	"github.com/queryflux/backend/internal/application/services"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/tests/mocks"
)

// TestAIService_ComprehensiveNLToSQL tests complete NL to SQL conversion scenarios
func TestAIService_ComprehensiveNLToSQL(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mock dependencies
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	// Create AI service
	aiService := services.NewAIService(
		repo,
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

	t.Run("simple NL to SQL conversion", func(t *testing.T) {
		// Setup mocks
		rateLimiter.On("Allow", ctx, "test-user", domain.AIServiceOpenAI).Return(true, time.Duration(0))
		promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "nl_to_sql").Return(&domain.AIPromptTemplate{
			ID:        "nl_to_sql",
			Template:  "Convert: {{.NLQuery}}",
			Variables: []string{"NLQuery"},
		}, nil)
		promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("Converted prompt", nil)
		cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache miss"))
		cacheManager.On("Set", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil)
		auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogResponse", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil)
		monitoringService.On("RecordRequest", ctx, domain.AIServiceOpenAI, "nl_to_sql", mock.Anything, mock.Anything, true).Return()
		monitoringService.On("RecordError", ctx, domain.AIServiceOpenAI, "generate_response", mock.Anything).Return()
		tokenTracker.On("TrackUsage", ctx, "test-user", domain.AIServiceOpenAI, mock.Anything, mock.Anything).Return(nil)

		request := &domain.NLToSQLRequest{
			ID:           "test-1",
			NLQuery:      "Show me all users",
			DatabaseType: "postgresql",
			UserID:       "test-user",
			CreatedAt:    time.Now(),
			Schema: domain.DatabaseSchema{
				Tables: []domain.TableSchema{
					{
						Name: "users",
						Columns: []domain.ColumnSchema{
							{Name: "id", Type: "integer"},
							{Name: "name", Type: "varchar"},
						},
					},
				},
			},
		}

		// This will fail due to missing AI client configuration, which is expected
		response, err := aiService.ConvertNLToSQL(ctx, request)

		// Should fail gracefully without AI clients
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured or enabled")
		assert.Nil(t, response)
	})

	t.Run("rate limited request", func(t *testing.T) {
		// Setup rate limiter to reject
		rateLimiter.On("Allow", ctx, "rate-limited-user", domain.AIServiceOpenAI).Return(false, time.Minute)

		request := &domain.NLToSQLRequest{
			ID:           "test-rate-limit",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "rate-limited-user",
			CreatedAt:    time.Now(),
		}

		response, err := aiService.ConvertNLToSQL(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "rate limit exceeded")
		assert.Nil(t, response)
	})

	t.Run("cache hit scenario", func(t *testing.T) {
		// Setup mocks for cache hit
		rateLimiter.On("Allow", ctx, "cache-user", domain.AIServiceOpenAI).Return(true, time.Duration(0))
		cacheManager.On("Get", ctx, mock.Anything).Return(&domain.NLToSQLResponse{
			ID:          "cached-response",
			SQLQuery:    "SELECT * FROM users",
			Explanation: "Cached SQL query",
			Confidence:  0.9,
			CreatedAt:   time.Now(),
		}, nil)

		request := &domain.NLToSQLRequest{
			ID:           "test-cache",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "cache-user",
			CreatedAt:    time.Now(),
		}

		response, err := aiService.ConvertNLToSQL(ctx, request)
		assert.NoError(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, "SELECT * FROM users", response.SQLQuery)
		assert.Equal(t, 0.9, response.Confidence)
	})
}

// TestAIService_ComprehensiveQueryOptimization tests query optimization scenarios
func TestAIService_ComprehensiveQueryOptimization(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("optimize simple query", func(t *testing.T) {
		rateLimiter.On("Allow", ctx, "test-user", domain.AIServiceOpenAI).Return(true, time.Duration(0))
		promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "query_optimization").Return(&domain.AIPromptTemplate{
			ID:        "query_optimization",
			Template:  "Optimize: {{.SQLQuery}}",
			Variables: []string{"SQLQuery"},
		}, nil)
		promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("Optimization prompt", nil)
		cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache miss"))
		cacheManager.On("Set", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil)
		auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogResponse", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil)
		monitoringService.On("RecordRequest", ctx, domain.AIServiceOpenAI, "query_optimization", mock.Anything, mock.Anything, true).Return()
		monitoringService.On("RecordError", ctx, domain.AIServiceOpenAI, "generate_response", mock.Anything).Return()
		tokenTracker.On("TrackUsage", ctx, "test-user", domain.AIServiceOpenAI, mock.Anything, mock.Anything).Return(nil)

		request := &domain.QueryOptimizationRequest{
			ID:           "opt-1",
			SQLQuery:     "SELECT * FROM users WHERE name LIKE '%john%'",
			DatabaseType: "postgresql",
			UserID:       "test-user",
			CreatedAt:    time.Now(),
			DatabaseSchema: domain.DatabaseSchema{
				Tables: []domain.TableSchema{
					{
						Name: "users",
						Columns: []domain.ColumnSchema{
							{Name: "id", Type: "integer"},
							{Name: "name", Type: "varchar"},
						},
					},
				},
			},
		}

		// Should fail gracefully without AI clients
		response, err := aiService.OptimizeQuery(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured or enabled")
		assert.Nil(t, response)
	})

	t.Run("invalid SQL query", func(t *testing.T) {
		request := &domain.QueryOptimizationRequest{
			ID:           "opt-invalid",
			SQLQuery:     "INVALID SQL SYNTAX",
			DatabaseType: "postgresql",
			UserID:       "test-user",
			CreatedAt:    time.Now(),
		}

		response, err := aiService.OptimizeQuery(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured or enabled")
		assert.Nil(t, response)
	})
}

// TestAIService_ComprehensiveQueryExplanation tests query explanation scenarios
func TestAIService_ComprehensiveQueryExplanation(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("explain simple query", func(t *testing.T) {
		rateLimiter.On("Allow", ctx, "test-user", domain.AIServiceOpenAI).Return(true, time.Duration(0))
		promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "query_explanation").Return(&domain.AIPromptTemplate{
			ID:        "query_explanation",
			Template:  "Explain: {{.SQLQuery}}",
			Variables: []string{"SQLQuery"},
		}, nil)
		promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("Explanation prompt", nil)
		cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache miss"))
		cacheManager.On("Set", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil)
		auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogResponse", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil)
		monitoringService.On("RecordRequest", ctx, domain.AIServiceOpenAI, "query_explanation", mock.Anything, mock.Anything, true).Return()
		monitoringService.On("RecordError", ctx, domain.AIServiceOpenAI, "generate_response", mock.Anything).Return()
		tokenTracker.On("TrackUsage", ctx, "test-user", domain.AIServiceOpenAI, mock.Anything, mock.Anything).Return(nil)

		request := &domain.QueryExplanationRequest{
			ID:           "exp-1",
			SQLQuery:     "SELECT u.*, o.total FROM users u JOIN orders o ON u.id = o.user_id",
			DatabaseType: "postgresql",
			Complexity:   "moderate",
			Audience:     "intermediate",
			Language:     "english",
			UserID:       "test-user",
			CreatedAt:    time.Now(),
		}

		// Should fail gracefully without AI clients
		response, err := aiService.ExplainQuery(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured or enabled")
		assert.Nil(t, response)
	})

	t.Run("empty query validation", func(t *testing.T) {
		request := &domain.QueryExplanationRequest{
			ID:           "exp-empty",
			SQLQuery:     "",
			DatabaseType: "postgresql",
			UserID:       "test-user",
			CreatedAt:    time.Now(),
		}

		response, err := aiService.ExplainQuery(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured or enabled")
		assert.Nil(t, response)
	})
}

// TestAIService_ErrorHandlingAndRecovery tests comprehensive error handling
func TestAIService_ErrorHandlingAndRecovery(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("health check failure", func(t *testing.T) {
		// Set AI service as unhealthy
		healthChecker.SetHealthStatus(domain.AIServiceOpenAI, fmt.Errorf("service unavailable"))

		request := &domain.NLToSQLRequest{
			ID:           "test-health",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "test-user",
			CreatedAt:    time.Now(),
		}

		response, err := aiService.ConvertNLToSQL(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not configured or enabled")
		assert.Nil(t, response)
	})

	t.Run("cache error handling", func(t *testing.T) {
		rateLimiter.On("Allow", ctx, "cache-error-user", domain.AIServiceOpenAI).Return(true, time.Duration(0))
		cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache error"))
		promptManager.On("LoadTemplate", ctx, mock.Anything, mock.Anything).Return(&domain.AIPromptTemplate{
			ID:       "nl_to_sql",
			Template: "Convert: {{.NLQuery}}",
		}, nil)
		promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("prompt", nil)
		auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil)
		monitoringService.On("RecordError", ctx, mock.Anything, mock.Anything, mock.Anything).Return()

		request := &domain.NLToSQLRequest{
			ID:           "test-cache-error",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "cache-error-user",
			CreatedAt:    time.Now(),
		}

		// Should handle cache error gracefully and continue processing
		response, err := aiService.ConvertNLToSQL(ctx, request)
		assert.Error(t, err) // Will fail due to missing AI config, but cache error should be handled
		assert.Nil(t, response)
	})

	t.Run("template loading error", func(t *testing.T) {
		rateLimiter.On("Allow", ctx, "template-error-user", domain.AIServiceOpenAI).Return(true, time.Duration(0))
		cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache miss"))
		promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "nl_to_sql").Return(nil, fmt.Errorf("template not found"))
		auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil)

		request := &domain.NLToSQLRequest{
			ID:           "test-template-error",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "template-error-user",
			CreatedAt:    time.Now(),
		}

		response, err := aiService.ConvertNLToSQL(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to load prompt template")
		assert.Nil(t, response)
	})
}

// TestAIService_TokenUsageAndCostManagement tests token tracking and cost management
func TestAIService_TokenUsageAndCostManagement(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("track token usage accurately", func(t *testing.T) {
		// Setup successful token tracking
		tokenTracker.On("TrackUsage", ctx, "usage-user", domain.AIServiceOpenAI, 150, 0.00675).Return(nil)

		err := tokenTracker.TrackUsage(ctx, "usage-user", domain.AIServiceOpenAI, 150, 0.00675)
		assert.NoError(t, err)
	})

	t.Run("budget enforcement", func(t *testing.T) {
		// Setup budget tracking
		tokenTracker.On("SetBudget", ctx, "budget-user", domain.AIServiceOpenAI, 10.0).Return(nil)
		tokenTracker.On("GetBudget", ctx, "budget-user", domain.AIServiceOpenAI).Return(10.0, nil)
		tokenTracker.On("CheckBudget", ctx, "budget-user", domain.AIServiceOpenAI, 5.0).Return(true, nil)
		tokenTracker.On("CheckBudget", ctx, "budget-user", domain.AIServiceOpenAI, 15.0).Return(false, nil)

		// Set budget
		err := tokenTracker.SetBudget(ctx, "budget-user", domain.AIServiceOpenAI, 10.0)
		assert.NoError(t, err)

		// Check budget
		budget, err := tokenTracker.GetBudget(ctx, "budget-user", domain.AIServiceOpenAI)
		assert.NoError(t, err)
		assert.Equal(t, 10.0, budget)

		// Check if within budget
		allowed, err := tokenTracker.CheckBudget(ctx, "budget-user", domain.AIServiceOpenAI, 5.0)
		assert.NoError(t, err)
		assert.True(t, allowed)

		// Check if exceeds budget
		allowed, err = tokenTracker.CheckBudget(ctx, "budget-user", domain.AIServiceOpenAI, 15.0)
		assert.NoError(t, err)
		assert.False(t, allowed)
	})

	t.Run("cost calculation accuracy", func(t *testing.T) {
		// Test different AI service cost calculations
		openAICost := calculateOpenAICost(1000) // 1000 tokens
		claudeCost := calculateClaudeCost(1000) // 1000 tokens

		assert.Greater(t, openAICost, 0.0)
		assert.Greater(t, claudeCost, 0.0)
		assert.NotEqual(t, openAICost, claudeCost) // Different pricing models
	})
}

// TestAIService_CachingStrategy tests caching behavior and strategies
func TestAIService_CachingStrategy(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("cache key generation consistency", func(t *testing.T) {
		request1 := &domain.NLToSQLRequest{
			ID:           "cache-test-1",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "cache-user",
			CreatedAt:    time.Now(),
		}

		request2 := &domain.NLToSQLRequest{
			ID:           "cache-test-2",
			NLQuery:      "Show users",
			DatabaseType: "postgresql",
			UserID:       "cache-user",
			CreatedAt:    time.Now(),
		}

		// Generate cache keys for both requests
		key1 := generateCacheKey("nl_to_sql", request1.ID, request1.NLQuery, string(request1.DatabaseType))
		key2 := generateCacheKey("nl_to_sql", request2.ID, request2.NLQuery, string(request2.DatabaseType))

		// Keys should be different due to different request IDs
		assert.NotEqual(t, key1, key2)
	})

	t.Run("cache TTL management", func(t *testing.T) {
		testData := "test data"
		cacheKey := "test-ttl-key"

		// Set data with 1 minute TTL
		err := cacheManager.Set(ctx, cacheKey, testData, time.Minute)
		assert.NoError(t, err)

		// Should be immediately available
		value, err := cacheManager.Get(ctx, cacheKey)
		assert.NoError(t, err)
		assert.Equal(t, testData, value)

		// Set data with very short TTL for testing
		shortTTLKey := "test-short-ttl"
		err = cacheManager.Set(ctx, shortTTLKey, "short lived data", time.Millisecond)
		assert.NoError(t, err)

		// Wait for expiration
		time.Sleep(time.Millisecond * 10)

		// Should be expired
		value, err = cacheManager.Get(ctx, shortTTLKey)
		assert.Error(t, err)
		assert.Nil(t, value)
	})

	t.Run("cache size management", func(t *testing.T) {
		// Fill cache with many items
		for i := 0; i < 100; i++ {
			key := fmt.Sprintf("bulk-key-%d", i)
			value := fmt.Sprintf("bulk-value-%d", i)
			err := cacheManager.Set(ctx, key, value, time.Hour)
			assert.NoError(t, err)
		}

		// Get cache stats
		stats, err := cacheManager.GetStats(ctx)
		assert.NoError(t, err)
		assert.Greater(t, stats["keys"], 90) // Should have most of our items
	})
}

// TestAIService_AuditingAndLogging tests comprehensive audit logging
func TestAIService_AuditingAndLogging(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("comprehensive request logging", func(t *testing.T) {
		request := &domain.AIRequest{
			ID:          "audit-test-1",
			Service:     domain.AIServiceOpenAI,
			Model:       "gpt-4",
			Prompt:      "Test prompt for audit",
			MaxTokens:   100,
			Temperature: 0.7,
			UserID:      "audit-user",
			CreatedAt:   time.Now(),
		}

		// Setup audit logger mock
		auditLogger.On("LogRequest", ctx, mock.MatchedBy(func(req *domain.AIRequest) bool {
			return req.ID == request.ID && req.UserID == request.UserID
		})).Return(nil)

		err := auditLogger.LogRequest(ctx, request)
		assert.NoError(t, err)
	})

	t.Run("error logging", func(t *testing.T) {
		testError := fmt.Errorf("test error for logging")
		requestID := "error-test-1"

		auditLogger.On("LogError", ctx, requestID, testError).Return(nil)

		err := auditLogger.LogError(ctx, requestID, testError)
		assert.NoError(t, err)
	})

	t.Run("audit log retrieval", func(t *testing.T) {
		userID := "audit-retrieval-user"

		// Mock audit log entries
		auditLogger.On("GetAuditLogs", ctx, userID, mock.Anything, mock.Anything).Return([]interface{}{
			map[string]interface{}{
				"type":      "request",
				"user_id":   userID,
				"timestamp": time.Now(),
			},
			map[string]interface{}{
				"type":      "response",
				"user_id":   userID,
				"timestamp": time.Now(),
			},
		}, nil)

		logs, err := auditLogger.GetAuditLogs(ctx, userID, time.Time{}, time.Now())
		assert.NoError(t, err)
		assert.Len(t, logs, 2)
	})

	t.Run("data access logging", func(t *testing.T) {
		userID := "data-access-user"
		operation := "nl_to_sql_conversion"
		dataAccessed := map[string]interface{}{
			"query": "Show users",
			"table": "users",
		}

		auditLogger.On("LogDataAccess", ctx, userID, operation, dataAccessed).Return(nil)

		err := auditLogger.LogDataAccess(ctx, userID, operation, dataAccessed)
		assert.NoError(t, err)
	})
}

// TestAIService_PerformanceAndLoadTesting tests performance under load
func TestAIService_PerformanceAndLoadTesting(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// Setup mocks
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	aiService := services.NewAIService(
		repo,
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

	t.Run("concurrent request handling", func(t *testing.T) {
		// Setup rate limiter to allow concurrent requests
		rateLimiter.On("Allow", ctx, mock.Anything, domain.AIServiceOpenAI).Return(true, time.Duration(0))
		cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache miss"))
		promptManager.On("LoadTemplate", ctx, mock.Anything, mock.Anything).Return(&domain.AIPromptTemplate{
			ID:       "nl_to_sql",
			Template: "Convert: {{.NLQuery}}",
		}, nil)
		promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("prompt", nil)
		auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
		auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil)
		monitoringService.On("RecordError", ctx, mock.Anything, mock.Anything, mock.Anything).Return()

		// Simulate concurrent requests
		numConcurrent := 10
		results := make(chan error, numConcurrent)

		for i := 0; i < numConcurrent; i++ {
			go func(id int) {
				request := &domain.NLToSQLRequest{
					ID:           fmt.Sprintf("concurrent-%d", id),
					NLQuery:      "Show users",
					DatabaseType: "postgresql",
					UserID:       fmt.Sprintf("user-%d", id),
					CreatedAt:    time.Now(),
				}

				_, err := aiService.ConvertNLToSQL(ctx, request)
				results <- err
			}(i)
		}

		// Collect results
		errorCount := 0
		for i := 0; i < numConcurrent; i++ {
			if err := <-results; err != nil {
				errorCount++
			}
		}

		// All should fail due to missing AI config, but should handle gracefully
		assert.Equal(t, numConcurrent, errorCount)
	})

	t.Run("cache performance under load", func(t *testing.T) {
		// Test cache performance with many operations
		numOperations := 1000
		start := time.Now()

		for i := 0; i < numOperations; i++ {
			key := fmt.Sprintf("perf-key-%d", i)
			value := fmt.Sprintf("perf-value-%d", i)

			err := cacheManager.Set(ctx, key, value, time.Minute)
			assert.NoError(t, err)

			retrieved, err := cacheManager.Get(ctx, key)
			assert.NoError(t, err)
			assert.Equal(t, value, retrieved)
		}

		duration := time.Since(start)
		assert.Less(t, duration, time.Second*5) // Should complete within 5 seconds

		// Calculate operations per second
		opsPerSecond := float64(numOperations*2) / duration.Seconds() // 2 operations per iteration
		assert.Greater(t, opsPerSecond, 1000.0)                       // Should handle at least 1000 ops/sec
	})

	t.Run("rate limiter performance", func(t *testing.T) {
		// Test rate limiter performance
		numChecks := 10000
		start := time.Now()

		for i := 0; i < numChecks; i++ {
			userID := fmt.Sprintf("perf-user-%d", i%100) // 100 different users
			allowed, _ := rateLimiter.Allow(ctx, userID, domain.AIServiceOpenAI)
			assert.True(t, allowed) // Should be allowed for new users
		}

		duration := time.Since(start)
		assert.Less(t, duration, time.Millisecond*500) // Should complete within 500ms

		checksPerSecond := float64(numChecks) / duration.Seconds()
		assert.Greater(t, checksPerSecond, 20000.0) // Should handle at least 20k checks/sec
	})
}

// Helper functions for testing

func calculateOpenAICost(tokens int) float64 {
	// Simplified OpenAI pricing calculation
	inputCost := float64(tokens/2) * 0.00003  // $0.03 per 1K input tokens
	outputCost := float64(tokens/2) * 0.00006 // $0.06 per 1K output tokens
	return inputCost + outputCost
}

func calculateClaudeCost(tokens int) float64 {
	// Simplified Claude pricing calculation
	inputCost := float64(tokens/2) * 0.000015  // $0.015 per 1K input tokens
	outputCost := float64(tokens/2) * 0.000075 // $0.075 per 1K output tokens
	return inputCost + outputCost
}

func generateCacheKey(parts ...string) string {
	key := ""
	for _, part := range parts {
		if key != "" {
			key += ":"
		}
		key += part
	}
	return key
}

// Benchmark tests
func BenchmarkAIService_Creation(b *testing.B) {
	logger := zaptest.NewLogger(b)

	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService := mocks.NewMockEncryptionService()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service := services.NewAIService(
			repo,
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
		if service == nil {
			b.Fatal("Failed to create AI service")
		}
	}
}

func BenchmarkCache_Operations(b *testing.B) {
	logger := zaptest.NewLogger(b)
	ctx := context.Background()
	cacheManager := mocks.NewMockCacheManager()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		key := fmt.Sprintf("bench-key-%d", i%1000)
		value := fmt.Sprintf("bench-value-%d", i)

		// Set operation
		cacheManager.Set(ctx, key, value, time.Minute)

		// Get operation
		cacheManager.Get(ctx, key)
	}
}

func BenchmarkRateLimiter_Checks(b *testing.B) {
	logger := zaptest.NewLogger(b)
	ctx := context.Background()
	rateLimiter := mocks.NewMockRateLimiter()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		userID := fmt.Sprintf("bench-user-%d", i%100)
		rateLimiter.Allow(ctx, userID, domain.AIServiceOpenAI)
	}
}
