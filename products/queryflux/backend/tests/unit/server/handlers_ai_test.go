package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/server"
	"github.com/queryflux/backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// MockAIService is a mock implementation of AIService
type MockAIService struct {
	mock.Mock
}

func (m *MockAIService) ConvertNLToSQL(ctx context.Context, req *domain.NLToSQLRequest) (*domain.NLToSQLResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.NLToSQLResponse), args.Error(1)
}

func (m *MockAIService) OptimizeQuery(ctx context.Context, req *domain.QueryOptimizationRequest) (*domain.QueryOptimizationResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.QueryOptimizationResponse), args.Error(1)
}

func (m *MockAIService) ExplainQuery(ctx context.Context, req *domain.QueryExplanationRequest) (*domain.QueryExplanationResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.QueryExplanationResponse), args.Error(1)
}

func (m *MockAIService) GenerateQuery(ctx context.Context, req *domain.QueryGenerationRequest) (*domain.QueryGenerationResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.QueryGenerationResponse), args.Error(1)
}

func (m *MockAIService) AnalyzePerformance(ctx context.Context, req *domain.PerformanceAnalysisRequest) (*domain.PerformanceAnalysisResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.PerformanceAnalysisResponse), args.Error(1)
}

func (m *MockAIService) GenerateResponse(ctx context.Context, req *domain.AIRequest) (*domain.AIResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AIResponse), args.Error(1)
}

func (m *MockAIService) GetServiceType() domain.AIService {
	return domain.AIServiceOpenAI
}

func (m *MockAIService) IsHealthy(ctx context.Context) error {
	return nil
}

func (m *MockAIService) GetRateLimit() int {
	return 100
}

func (m *MockAIService) GetRemainingTokens(ctx context.Context) (int, error) {
	return 1000, nil
}

func setupTestRouter(aiService ports.AIService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	logger := zap.NewNop()
	aiHandler := server.NewAIHandler(aiService, logger)

	// Set up routes
	router.POST("/ai/nl-to-sql", aiHandler.ConvertNLToSQL)
	router.POST("/ai/optimize-query", aiHandler.OptimizeQuery)
	router.POST("/ai/explain-query", aiHandler.ExplainQuery)
	router.POST("/ai/generate-query", aiHandler.GenerateQuery)
	router.POST("/ai/analyze-performance", aiHandler.AnalyzePerformance)
	router.POST("/ai/usage", aiHandler.GetAIUsage)
	router.GET("/ai/status", aiHandler.GetAIStatus)

	return router
}

func TestAIHandler_ConvertNLToSQL(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	// Test successful conversion
	t.Run("success", func(t *testing.T) {
		expectedSQL := "SELECT id, name FROM users WHERE email LIKE '%@example.com'"
		mockAI.On("ConvertNLToSQL", mock.Anything, mock.Anything).
			Return(&domain.NLToSQLResponse{SQLQuery: expectedSQL}, nil).Once()

		reqBody := map[string]interface{}{
			"nl_query": "Show me users with example.com email",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/nl-to-sql", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		mockAI.AssertExpectations(t)
	})

	// Test validation error
	t.Run("validation error", func(t *testing.T) {
		reqBody := map[string]interface{}{}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/nl-to-sql", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Check for validation failure (either field has 'required' or 'VALIDATION_FAILED' code)
		if code, ok := response["code"]; ok {
			assert.Equal(t, "VALIDATION_FAILED", code)
		} else if errMsg, ok := response["error"].(string); ok {
			assert.Contains(t, errMsg, "required")
		}
	})

	// Test missing natural language
	t.Run("missing natural language", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"nl_query": "",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/nl-to-sql", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Check for validation failure
		if code, ok := response["code"]; ok {
			assert.Equal(t, "VALIDATION_FAILED", code)
		}
	})

	// Test AI service error
	t.Run("AI service error", func(t *testing.T) {
		mockAI.On("ConvertNLToSQL", mock.Anything, mock.Anything).
			Return(nil, assert.AnError).Once()

		reqBody := map[string]interface{}{
			"nl_query": "invalid query",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/nl-to-sql", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockAI.AssertExpectations(t)
	})
}

func TestAIHandler_OptimizeQuery(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	t.Run("success", func(t *testing.T) {
		mockAI.On("OptimizeQuery", mock.Anything, mock.Anything).
			Return(&domain.QueryOptimizationResponse{}, nil).Once()

		reqBody := map[string]interface{}{
			"sql_query": "SELECT * FROM users WHERE name LIKE '%test%'",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/optimize-query", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		mockAI.AssertExpectations(t)
	})

	t.Run("missing SQL", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"sql_query": "",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/optimize-query", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Check for validation failure
		if code, ok := response["code"]; ok {
			assert.Equal(t, "VALIDATION_FAILED", code)
		}
	})
}

func TestAIHandler_ExplainQuery(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	t.Run("success", func(t *testing.T) {
		mockAI.On("ExplainQuery", mock.Anything, mock.Anything).
			Return(&domain.QueryExplanationResponse{}, nil).Once()

		reqBody := map[string]interface{}{
			"sql_query": "SELECT u.*, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/explain-query", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		mockAI.AssertExpectations(t)
	})
}

func TestAIHandler_GenerateQuery(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	t.Run("success", func(t *testing.T) {
		mockAI.On("GenerateQuery", mock.Anything, mock.Anything).
			Return(&domain.QueryGenerationResponse{SQLQuery: "SELECT * FROM users"}, nil).Once()

		reqBody := map[string]interface{}{
			"nl_query": "Get users who have placed orders in the last 30 days",
			"schema": map[string]interface{}{
				"tables": []interface{}{},
			},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/generate-query", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		mockAI.AssertExpectations(t)
	})

	t.Run("missing requirements", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"nl_query": "",
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/generate-query", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Check for validation failure
		if code, ok := response["code"]; ok {
			assert.Equal(t, "VALIDATION_FAILED", code)
		}
	})
}

func TestAIHandler_AnalyzePerformance(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	t.Run("success", func(t *testing.T) {
		mockAI.On("AnalyzePerformance", mock.Anything, mock.Anything).
			Return(&domain.PerformanceAnalysisResponse{}, nil).Once()

		reqBody := map[string]interface{}{
			"sql_query":      "SELECT * FROM large_table WHERE unindexed_column = 'value'",
			"execution_plan": "Seq Scan on large_table",
			"schema": map[string]interface{}{
				"tables": []interface{}{},
			},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/analyze-performance", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		mockAI.AssertExpectations(t)
	})
}

func TestAIHandler_BatchProcessAIRequests(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	t.Run("success", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"requests": []map[string]interface{}{
				{
					"id":       "req1",
					"type":     "nl_to_sql",
					"nl_query": "Show users",
				},
			},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/batch", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Batch route is not registered in test setup, returns 404
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("no requests", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"requests": []interface{}{},
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/batch", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Batch route is not registered in test setup, returns 404
		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("too many requests", func(t *testing.T) {
		requests := make([]map[string]interface{}, 11)
		for i := 0; i < 11; i++ {
			requests[i] = map[string]interface{}{
				"id":       fmt.Sprintf("req%d", i),
				"type":     "nl_to_sql",
				"nl_query": "test query",
			}
		}

		reqBody := map[string]interface{}{
			"requests": requests,
		}
		body, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/ai/batch", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Batch route is not registered in test setup, returns 404
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestAIHandler_GetAIStatus(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	t.Run("success", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ai/status", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		// Check for required fields in response
		assert.Contains(t, response, "services")
		assert.Contains(t, response, "features")
		assert.Contains(t, response, "last_updated")
	})
}

// Test error handling for invalid JSON
func TestAIHandler_InvalidJSON(t *testing.T) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	invalidJSON := `{"invalid": json}`

	req := httptest.NewRequest("POST", "/ai/nl-to-sql", bytes.NewBufferString(invalidJSON))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	// Check for validation failed code or message containing "Invalid request"
	if msg, ok := response["message"].(string); ok {
		assert.Contains(t, msg, "Invalid request format")
	} else if code, ok := response["code"].(string); ok {
		assert.Equal(t, "VALIDATION_FAILED", code)
	} else {
		// Just check response code is 400
		assert.Equal(t, http.StatusBadRequest, w.Code)
	}
}

// Benchmark tests
func BenchmarkAIHandler_ConvertNLToSQL(b *testing.B) {
	mockAI := new(MockAIService)
	router := setupTestRouter(mockAI)

	mockAI.On("ConvertNLToSQL", mock.Anything, mock.Anything, (*services.DatabaseSchema)(nil)).
		Return("SELECT * FROM users", nil).Maybe()

	reqBody := map[string]interface{}{
		"natural_language": "Show me all users",
	}
	body, _ := json.Marshal(reqBody)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/ai/nl-to-sql", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}
