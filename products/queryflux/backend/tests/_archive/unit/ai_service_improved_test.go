package services_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"

	services "github.com/queryflux/backend/internal/application/services/ai"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/infrastructure/security"
	"github.com/queryflux/backend/tests/mocks"
)

func TestImprovedAIService_ConvertNLToSQL(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	// 1. Setup Dependencies
	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService, err := security.NewAES256EncryptionService("test-master-key-32-characters-long!!", logger)
	require.NoError(t, err)

	encryptedKey, _ := encryptionService.EncryptAPIKey(ctx, "sk-test-key")

	config := &domain.AIConfig{
		Service:     domain.AIServiceOpenAI,
		APIKey:      encryptedKey,
		Model:       "gpt-4",
		BaseURL:     "https://api.openai.com/v1",
		MaxTokens:   1000,
		Temperature: 0.1,
		Timeout:     30 * time.Second,
		RateLimit:   10,
		Enabled:     true,
	}
	repo.On("ListAIConfigs", mock.Anything).Return([]*domain.AIConfig{config}, nil)

	aiService := services.NewImprovedAIService(
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

	mockClient := mocks.NewMockOpenAIClient()
	mockClient.SetResponse("/chat/completions", *mocks.CreateMockNLToSQLResponse("SELECT * FROM users", "Selects all users", 50))
	aiService.SetOpenAIClient(mockClient)

	request := &domain.NLToSQLRequest{
		ID:           "test-req-1",
		NLQuery:      "Show all users",
		DatabaseType: "postgresql",
		UserID:       "user-1",
		Schema: domain.DatabaseSchema{
			Tables: []domain.TableSchema{
				{
					Name: "users",
					Columns: []domain.ColumnSchema{
						{Name: "id", Type: "int"},
						{Name: "name", Type: "text"},
					},
				},
			},
		},
	}

	rateLimiter.On("Allow", ctx, "user-1", domain.AIServiceOpenAI).Return(true, time.Duration(0))
	cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("cache miss"))
	cacheManager.On("Set", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "nl_to_sql").Return(&domain.AIPromptTemplate{
		Template: "Translate {{.NLQuery}}",
	}, nil)
	promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("Translate Show all users", nil)

	auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
	auditLogger.On("LogResponse", ctx, mock.Anything).Return(nil)
	auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil).Maybe()
	monitoringService.On("RecordError", ctx, mock.Anything, mock.Anything, mock.Anything).Return().Maybe()

	tokenTracker.On("TrackUsage", ctx, "user-1", domain.AIServiceOpenAI, 50, mock.Anything).Return(nil)
	monitoringService.On("RecordRequest", ctx, domain.AIServiceOpenAI, "nl_to_sql", mock.Anything, 50, true).Return()

	response, err := aiService.ConvertNLToSQL(ctx, request)

	require.NoError(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, "SELECT * FROM users", response.SQLQuery)
	
	repo.AssertExpectations(t)
	rateLimiter.AssertExpectations(t)
	cacheManager.AssertExpectations(t)
	promptManager.AssertExpectations(t)
	tokenTracker.AssertExpectations(t)
	auditLogger.AssertExpectations(t)
	monitoringService.AssertExpectations(t)
}

func TestImprovedAIService_OptimizeQuery(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService, _ := security.NewAES256EncryptionService("test-master-key-32-characters-long!!", logger)
	encryptedKey, _ := encryptionService.EncryptAPIKey(ctx, "sk-test-key")

	config := &domain.AIConfig{
		Service:     domain.AIServiceOpenAI,
		APIKey:      encryptedKey,
		Model:       "gpt-4",
		Enabled:     true,
	}
	repo.On("ListAIConfigs", mock.Anything).Return([]*domain.AIConfig{config}, nil)

	aiService := services.NewImprovedAIService(
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

	mockClient := mocks.NewMockOpenAIClient()
	mockClient.SetResponse("/chat/completions", *mocks.CreateMockQueryOptimizationResponse("SELECT * FROM users LIMIT 10", []string{"Added LIMIT"}, 60))
	aiService.SetOpenAIClient(mockClient)

	request := &domain.QueryOptimizationRequest{
		ID:           "opt-req-1",
		SQLQuery:     "SELECT * FROM users",
		DatabaseType: "postgresql",
		UserID:       "user-1",
	}

	rateLimiter.On("Allow", ctx, "user-1", domain.AIServiceOpenAI).Return(true, time.Duration(0))
	cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("miss"))
	cacheManager.On("Set", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	
	promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "query_optimization").Return(&domain.AIPromptTemplate{
		Template: "Optimize {{.SQLQuery}}",
	}, nil)
	promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("Optimize SELECT * FROM users", nil)
	
	auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
	auditLogger.On("LogResponse", ctx, mock.Anything).Return(nil)
	auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil).Maybe()
	monitoringService.On("RecordError", ctx, mock.Anything, mock.Anything, mock.Anything).Return().Maybe()
	
	tokenTracker.On("TrackUsage", ctx, "user-1", domain.AIServiceOpenAI, 60, mock.Anything).Return(nil)
	monitoringService.On("RecordRequest", ctx, domain.AIServiceOpenAI, "query_optimization", mock.Anything, 60, true).Return()

	resp, err := aiService.OptimizeQuery(ctx, request)

	require.NoError(t, err)
	assert.Equal(t, "SELECT * FROM users LIMIT 10", resp.OptimizedQuery)
}

func TestImprovedAIService_ExplainQuery(t *testing.T) {
	logger := zaptest.NewLogger(t)
	ctx := context.Background()

	repo := mocks.NewMockAIRepository()
	rateLimiter := mocks.NewMockRateLimiter()
	tokenTracker := mocks.NewMockTokenTracker()
	promptManager := mocks.NewMockPromptTemplateManager()
	cacheManager := mocks.NewMockCacheManager()
	healthChecker := mocks.NewMockAIHealthChecker()
	monitoringService := mocks.NewMockMonitoringService()
	auditLogger := mocks.NewMockAuditLogger()
	encryptionService, _ := security.NewAES256EncryptionService("test-master-key-32-characters-long!!", logger)
	encryptedKey, _ := encryptionService.EncryptAPIKey(ctx, "sk-test-key")

	config := &domain.AIConfig{
		Service:     domain.AIServiceOpenAI,
		APIKey:      encryptedKey,
		Model:       "gpt-4",
		Enabled:     true,
	}
	repo.On("ListAIConfigs", mock.Anything).Return([]*domain.AIConfig{config}, nil)

	aiService := services.NewImprovedAIService(
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

	mockClient := mocks.NewMockOpenAIClient()
	mockClient.SetResponse("/chat/completions", *mocks.CreateMockQueryExplanationResponse("This query selects users.", []string{"Scan table"}, 70))
	aiService.SetOpenAIClient(mockClient)

	request := &domain.QueryExplanationRequest{
		ID:           "exp-req-1",
		SQLQuery:     "SELECT * FROM users",
		DatabaseType: "postgresql",
		UserID:       "user-1",
	}

	rateLimiter.On("Allow", ctx, "user-1", domain.AIServiceOpenAI).Return(true, time.Duration(0))
	cacheManager.On("Get", ctx, mock.Anything).Return(nil, fmt.Errorf("miss"))
	cacheManager.On("Set", ctx, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	
	promptManager.On("LoadTemplate", ctx, domain.AIServiceOpenAI, "query_explanation").Return(&domain.AIPromptTemplate{
		Template: "Explain {{.SQLQuery}}",
	}, nil)
	promptManager.On("RenderTemplate", ctx, mock.Anything, mock.Anything).Return("Explain SELECT * FROM users", nil)
	
	auditLogger.On("LogRequest", ctx, mock.Anything).Return(nil)
	auditLogger.On("LogResponse", ctx, mock.Anything).Return(nil)
	auditLogger.On("LogError", ctx, mock.Anything, mock.Anything).Return(nil).Maybe()
	monitoringService.On("RecordError", ctx, mock.Anything, mock.Anything, mock.Anything).Return().Maybe()
	
	tokenTracker.On("TrackUsage", ctx, "user-1", domain.AIServiceOpenAI, 70, mock.Anything).Return(nil)
	monitoringService.On("RecordRequest", ctx, domain.AIServiceOpenAI, "query_explanation", mock.Anything, 70, true).Return()

	resp, err := aiService.ExplainQuery(ctx, request)

	require.NoError(t, err)
	assert.Contains(t, resp.Explanation, "This query selects users")
}
