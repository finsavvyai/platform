package services_test

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"

	"github.com/queryflux/backend/internal/application/services"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/tests/mocks"
)

// TestAIService_ConvertNLToSQL tests natural language to SQL conversion
func TestAIService_ConvertNLToSQL(t *testing.T) {
	logger := zaptest.NewLogger(t)

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

	tests := []struct {
		name        string
		request     *domain.NLToSQLRequest
		setupMocks  func()
		wantError   bool
		errorMsg    string
		expectSQL   bool
		expectSteps bool
	}{
		{
			name: "successful NL to SQL conversion",
			request: &domain.NLToSQLRequest{
				ID:           "test-1",
				NLQuery:      "Show me all users",
				DatabaseType: "postgresql",
				Schema: domain.DatabaseSchema{
					Tables: []domain.TableSchema{
						{
							Name: "users",
							Columns: []domain.ColumnSchema{
								{Name: "id", Type: "integer"},
								{Name: "name", Type: "varchar"},
								{Name: "email", Type: "varchar"},
							},
						},
					},
				},
				UserID:    "user-123",
				CreatedAt: time.Now(),
			},
			setupMocks: func() {
				// Set up OpenAI config
				config := &domain.AIConfig{
					Service:     domain.AIServiceOpenAI,
					APIKey:      "test-key",
					Model:       "gpt-4",
					MaxTokens:   1000,
					Temperature: 0.7,
					Enabled:     true,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}
				repo.CreateAIConfig(context.Background(), config)
				encryptionService.EncryptAPIKey(context.Background(), "test-key")
			},
			wantError:   false,
			expectSQL:   true,
			expectSteps: true,
		},
		{
			name: "rate limit exceeded",
			request: &domain.NLToSQLRequest{
				ID:           "test-2",
				NLQuery:      "Show me all users",
				DatabaseType: "postgresql",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// Set rate limit to 0 to trigger rate limiting
				rateLimiter.SetLimit("user-123", domain.AIServiceOpenAI, 0)
			},
			wantError: true,
			errorMsg:  "rate limit",
		},
		{
			name: "cache hit",
			request: &domain.NLToSQLRequest{
				ID:           "test-3",
				NLQuery:      "Show me all users",
				DatabaseType: "postgresql",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// Pre-populate cache
				cachedResponse := &domain.NLToSQLResponse{
					ID:          "cached-1",
					RequestID:   "test-3",
					SQLQuery:    "SELECT * FROM users",
					Explanation: "Simple query to get all users",
					Confidence:  0.95,
					CreatedAt:   time.Now(),
				}
				cacheManager.Set(context.Background(), "nl_to_sql:Show me all users:postgresql", cachedResponse, time.Hour)
			},
			wantError:   false,
			expectSQL:   true,
			expectSteps: false, // Cached response won't have detailed steps
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMocks()

			ctx := context.Background()
			result, err := aiService.ConvertNLToSQL(ctx, tt.request)

			if tt.wantError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)

				if tt.expectSQL {
					assert.NotEmpty(t, result.SQLQuery)
				}

				if tt.expectSteps {
					assert.NotEmpty(t, result.Explanation)
				}
			}
		})
	}
}

// TestAIService_OptimizeQuery tests query optimization
func TestAIService_OptimizeQuery(t *testing.T) {
	logger := zaptest.NewLogger(t)

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

	tests := []struct {
		name               string
		request            *domain.QueryOptimizationRequest
		setupMocks         func()
		wantError          bool
		errorMsg           string
		expectOptimized    bool
		expectImprovements bool
	}{
		{
			name: "successful query optimization",
			request: &domain.QueryOptimizationRequest{
				ID:       "opt-1",
				SQLQuery: "SELECT * FROM users WHERE name LIKE '%john%'",
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
				DatabaseType: "postgresql",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// Set up Claude config
				config := &domain.AIConfig{
					Service:     domain.AIServiceClaude,
					APIKey:      "test-key",
					Model:       "claude-3-sonnet-20240229",
					MaxTokens:   1000,
					Temperature: 0.3,
					Enabled:     true,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}
				repo.CreateAIConfig(context.Background(), config)
				encryptionService.EncryptAPIKey(context.Background(), "test-key")
			},
			wantError:          false,
			expectOptimized:    true,
			expectImprovements: true,
		},
		{
			name: "invalid SQL query",
			request: &domain.QueryOptimizationRequest{
				ID:           "opt-2",
				SQLQuery:     "INVALID SQL SYNTAX",
				DatabaseType: "postgresql",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// No config setup - will fail gracefully
			},
			wantError: true,
			errorMsg:  "invalid",
		},
		{
			name: "AI service unhealthy",
			request: &domain.QueryOptimizationRequest{
				ID:           "opt-3",
				SQLQuery:     "SELECT * FROM users",
				DatabaseType: "postgresql",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				healthChecker.SetHealthStatus(domain.AIServiceOpenAI, fmt.Errorf("service unavailable"))
			},
			wantError: true,
			errorMsg:  "unhealthy",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMocks()

			ctx := context.Background()
			result, err := aiService.OptimizeQuery(ctx, tt.request)

			if tt.wantError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)

				if tt.expectOptimized {
					assert.NotEmpty(t, result.OptimizedQuery)
				}

				if tt.expectImprovements {
					assert.NotEmpty(t, result.Improvements)
				}
			}
		})
	}
}

// TestAIService_ExplainQuery tests query explanation
func TestAIService_ExplainQuery(t *testing.T) {
	logger := zaptest.NewLogger(t)

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

	tests := []struct {
		name              string
		request           *domain.QueryExplanationRequest
		setupMocks        func()
		wantError         bool
		errorMsg          string
		expectExplanation bool
		expectSteps       bool
	}{
		{
			name: "successful query explanation",
			request: &domain.QueryExplanationRequest{
				ID:           "exp-1",
				SQLQuery:     "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE u.created_at > '2023-01-01'",
				DatabaseType: "postgresql",
				Complexity:   "moderate",
				Audience:     "beginner",
				Language:     "english",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// Set up OpenAI config
				config := &domain.AIConfig{
					Service:     domain.AIServiceOpenAI,
					APIKey:      "test-key",
					Model:       "gpt-4",
					MaxTokens:   1500,
					Temperature: 0.5,
					Enabled:     true,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}
				repo.CreateAIConfig(context.Background(), config)
				encryptionService.EncryptAPIKey(context.Background(), "test-key")
			},
			wantError:         false,
			expectExplanation: true,
			expectSteps:       true,
		},
		{
			name: "empty query",
			request: &domain.QueryExplanationRequest{
				ID:           "exp-2",
				SQLQuery:     "",
				DatabaseType: "postgresql",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// No config needed
			},
			wantError: true,
			errorMsg:  "empty",
		},
		{
			name: "complex query for expert audience",
			request: &domain.QueryExplanationRequest{
				ID:           "exp-3",
				SQLQuery:     "WITH RECURSIVE employee_hierarchy AS (SELECT id, name, manager_id, 1 as level FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id, eh.level + 1 FROM employees e JOIN employee_hierarchy eh ON e.manager_id = eh.id) SELECT * FROM employee_hierarchy ORDER BY level, name",
				DatabaseType: "postgresql",
				Complexity:   "complex",
				Audience:     "expert",
				Language:     "english",
				UserID:       "user-123",
				CreatedAt:    time.Now(),
			},
			setupMocks: func() {
				// Set up Claude config for complex queries
				config := &domain.AIConfig{
					Service:     domain.AIServiceClaude,
					APIKey:      "test-key",
					Model:       "claude-3-opus-20240229",
					MaxTokens:   2000,
					Temperature: 0.2,
					Enabled:     true,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}
				repo.CreateAIConfig(context.Background(), config)
				encryptionService.EncryptAPIKey(context.Background(), "test-key")
			},
			wantError:         false,
			expectExplanation: true,
			expectSteps:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMocks()

			ctx := context.Background()
			result, err := aiService.ExplainQuery(ctx, tt.request)

			if tt.wantError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)

				if tt.expectExplanation {
					assert.NotEmpty(t, result.Explanation)
				}

				if tt.expectSteps {
					assert.NotEmpty(t, result.Steps)
				}
			}
		})
	}
}

// TestAIService_GenerateResponse tests general AI response generation
func TestAIService_GenerateResponse(t *testing.T) {
	logger := zaptest.NewLogger(t)

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

	tests := []struct {
		name       string
		request    *domain.AIRequest
		setupMocks func()
		wantError  bool
		errorMsg   string
		expectResp bool
	}{
		{
			name: "successful response generation",
			request: &domain.AIRequest{
				ID:      "ai-1",
				Service: domain.AIServiceOpenAI,
				Model:   "gpt-4",
				Prompt:  "What is database indexing?",
				Messages: []domain.AIMessage{
					{Role: "system", Content: "You are a database expert assistant."},
					{Role: "user", Content: "What is database indexing?"},
				},
				MaxTokens:   500,
				Temperature: 0.7,
				UserID:      "user-123",
				CreatedAt:   time.Now(),
			},
			setupMocks: func() {
				// Set up OpenAI config
				config := &domain.AIConfig{
					Service:     domain.AIServiceOpenAI,
					APIKey:      "test-key",
					Model:       "gpt-4",
					MaxTokens:   1000,
					Temperature: 0.7,
					Enabled:     true,
					CreatedAt:   time.Now(),
					UpdatedAt:   time.Now(),
				}
				repo.CreateAIConfig(context.Background(), config)
				encryptionService.EncryptAPIKey(context.Background(), "test-key")
			},
			wantError:  false,
			expectResp: true,
		},
		{
			name: "missing API key",
			request: &domain.AIRequest{
				ID:        "ai-2",
				Service:   domain.AIServiceOpenAI,
				Prompt:    "Test prompt",
				UserID:    "user-123",
				CreatedAt: time.Now(),
			},
			setupMocks: func() {
				// No config - will fail due to missing API key
			},
			wantError: true,
			errorMsg:  "API key",
		},
		{
			name: "invalid service",
			request: &domain.AIRequest{
				ID:        "ai-3",
				Service:   domain.AIService("invalid"),
				Prompt:    "Test prompt",
				UserID:    "user-123",
				CreatedAt: time.Now(),
			},
			setupMocks: func() {
				// No config needed
			},
			wantError: true,
			errorMsg:  "unsupported",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupMocks()

			ctx := context.Background()
			result, err := aiService.GenerateResponse(ctx, tt.request)

			if tt.wantError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)

				if tt.expectResp {
					assert.NotEmpty(t, result.Content)
					assert.Equal(t, tt.request.ID, result.RequestID)
					assert.Equal(t, tt.request.Service, result.Service)
				}
			}
		})
	}
}

// TestAIService_ErrorHandling tests error handling scenarios
func TestAIService_ErrorHandling(t *testing.T) {
	logger := zaptest.NewLogger(t)

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

	t.Run("nil request handling", func(t *testing.T) {
		ctx := context.Background()

		_, err := aiService.ConvertNLToSQL(ctx, nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "request cannot be nil")
	})

	t.Run("cancelled context", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		request := &domain.NLToSQLRequest{
			ID:           "test-cancel",
			NLQuery:      "test query",
			DatabaseType: "postgresql",
			UserID:       "user-123",
			CreatedAt:    time.Now(),
		}

		_, err := aiService.ConvertNLToSQL(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "context canceled")
	})

	t.Run("empty user ID", func(t *testing.T) {
		ctx := context.Background()

		request := &domain.NLToSQLRequest{
			ID:           "test-empty-user",
			NLQuery:      "test query",
			DatabaseType: "postgresql",
			UserID:       "", // Empty user ID
			CreatedAt:    time.Now(),
		}

		_, err := aiService.ConvertNLToSQL(ctx, request)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "user ID cannot be empty")
	})
}

// Domain serialization tests for AI objects
func TestAIRequestSerialization(t *testing.T) {
	original := &domain.AIRequest{
		ID:      "test-1",
		Service: domain.AIServiceOpenAI,
		Model:   "gpt-4",
		Prompt:  "Test prompt",
		Messages: []domain.AIMessage{
			{Role: "system", Content: "You are a helpful assistant"},
			{Role: "user", Content: "Hello"},
		},
		MaxTokens:   1000,
		Temperature: 0.7,
		UserID:      "user-123",
		CreatedAt:   time.Now(),
	}

	// Serialize to JSON
	data, err := json.Marshal(original)
	require.NoError(t, err)

	// Deserialize from JSON
	var restored domain.AIRequest
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, original.ID, restored.ID)
	assert.Equal(t, original.Service, restored.Service)
	assert.Equal(t, original.Model, restored.Model)
	assert.Equal(t, original.Prompt, restored.Prompt)
	assert.Len(t, restored.Messages, 2)
}

func TestNLToSQLRequestSerialization(t *testing.T) {
	original := &domain.NLToSQLRequest{
		ID:           "nl-1",
		NLQuery:      "Show me all users",
		DatabaseType: "postgresql",
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
		UserID:    "user-123",
		CreatedAt: time.Now(),
	}

	// Serialize to JSON
	data, err := json.Marshal(original)
	require.NoError(t, err)

	// Deserialize from JSON
	var restored domain.NLToSQLRequest
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, original.ID, restored.ID)
	assert.Equal(t, original.NLQuery, restored.NLQuery)
	assert.Equal(t, original.DatabaseType, restored.DatabaseType)
	assert.Len(t, restored.Schema.Tables, 1)
	assert.Equal(t, "users", restored.Schema.Tables[0].Name)
}

func TestQueryOptimizationRequestSerialization(t *testing.T) {
	original := &domain.QueryOptimizationRequest{
		ID:       "opt-1",
		SQLQuery: "SELECT * FROM users WHERE name LIKE '%test%'",
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
		DatabaseType: "postgresql",
		UserID:       "user-123",
		CreatedAt:    time.Now(),
	}

	// Serialize to JSON
	data, err := json.Marshal(original)
	require.NoError(t, err)

	// Deserialize from JSON
	var restored domain.QueryOptimizationRequest
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, original.ID, restored.ID)
	assert.Equal(t, original.SQLQuery, restored.SQLQuery)
	assert.Equal(t, original.DatabaseType, restored.DatabaseType)
	assert.Len(t, restored.DatabaseSchema.Tables, 1)
}

// Benchmark tests for performance validation
func BenchmarkAIService_ConvertNLToSQL(b *testing.B) {
	logger := zaptest.NewLogger(b)

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

	// Setup config
	config := &domain.AIConfig{
		Service:     domain.AIServiceOpenAI,
		APIKey:      "test-key",
		Model:       "gpt-4",
		MaxTokens:   1000,
		Temperature: 0.7,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	repo.CreateAIConfig(context.Background(), config)
	encryptionService.EncryptAPIKey(context.Background(), "test-key")

	request := &domain.NLToSQLRequest{
		ID:           "bench-test",
		NLQuery:      "Show me all users who created orders in the last 30 days",
		DatabaseType: "postgresql",
		Schema: domain.DatabaseSchema{
			Tables: []domain.TableSchema{
				{
					Name: "users",
					Columns: []domain.ColumnSchema{
						{Name: "id", Type: "integer"},
						{Name: "name", Type: "varchar"},
						{Name: "created_at", Type: "timestamp"},
					},
				},
				{
					Name: "orders",
					Columns: []domain.ColumnSchema{
						{Name: "id", Type: "integer"},
						{Name: "user_id", Type: "integer"},
						{Name: "total", Type: "decimal"},
						{Name: "created_at", Type: "timestamp"},
					},
				},
			},
		},
		UserID:    "bench-user",
		CreatedAt: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := context.Background()
		_, err := aiService.ConvertNLToSQL(ctx, request)
		if err != nil {
			b.Fatalf("Unexpected error: %v", err)
		}
	}
}

func BenchmarkAIService_Create(b *testing.B) {
	logger := zaptest.NewLogger(b)

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

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
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
		if aiService == nil {
			b.Fatal("Failed to create AI service")
		}
	}
}
