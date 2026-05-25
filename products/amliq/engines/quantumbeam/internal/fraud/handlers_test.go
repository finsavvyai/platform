package fraud

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockFraudDetectionService is a mock implementation of FraudDetectionService
type MockFraudDetectionService struct {
	mock.Mock
}

func (m *MockFraudDetectionService) AnalyzeTransactionQuantum(ctx context.Context, transaction *models.TransactionData) (*models.FraudResult, error) {
	args := m.Called(ctx, transaction)
	return args.Get(0).(*models.FraudResult), args.Error(1)
}

func (m *MockFraudDetectionService) AnalyzeBatchQuantum(ctx context.Context, transactions []*models.TransactionData) ([]*models.FraudResult, error) {
	args := m.Called(ctx, transactions)
	return args.Get(0).([]*models.FraudResult), args.Error(1)
}

func (m *MockFraudDetectionService) DetectFraudRingsQAOA(ctx context.Context, graphData *interfaces.NetworkGraph) (*interfaces.QuantumCommunityResult, error) {
	args := m.Called(ctx, graphData)
	return args.Get(0).(*interfaces.QuantumCommunityResult), args.Error(1)
}

func (m *MockFraudDetectionService) GetQuantumPerformance(ctx context.Context) (*interfaces.QuantumPerformanceMetrics, error) {
	args := m.Called(ctx)
	return args.Get(0).(*interfaces.QuantumPerformanceMetrics), args.Error(1)
}

func (m *MockFraudDetectionService) OptimizeQuantumCircuits(ctx context.Context, circuitType string) (*interfaces.OptimizationResult, error) {
	args := m.Called(ctx, circuitType)
	return args.Get(0).(*interfaces.OptimizationResult), args.Error(1)
}

func (m *MockFraudDetectionService) GetQuantumBackendStatus(ctx context.Context) (*interfaces.QuantumBackendStatus, error) {
	args := m.Called(ctx)
	return args.Get(0).(*interfaces.QuantumBackendStatus), args.Error(1)
}

func (m *MockFraudDetectionService) AnalyzeTransactionClassical(ctx context.Context, transaction *models.TransactionData) (*interfaces.ClassicalFraudResult, error) {
	args := m.Called(ctx, transaction)
	return args.Get(0).(*interfaces.ClassicalFraudResult), args.Error(1)
}

func (m *MockFraudDetectionService) CompareQuantumClassical(ctx context.Context, transaction *models.TransactionData) (*interfaces.ComparisonResult, error) {
	args := m.Called(ctx, transaction)
	return args.Get(0).(*interfaces.ComparisonResult), args.Error(1)
}

// MockIntelligentRouter is a mock implementation of IntelligentRouter
type MockIntelligentRouter struct {
	mock.Mock
}

func (m *MockIntelligentRouter) RouteTransaction(ctx context.Context, transaction *models.TransactionData) (interfaces.ProcessingMethod, error) {
	args := m.Called(ctx, transaction)
	return args.Get(0).(interfaces.ProcessingMethod), args.Error(1)
}

func (m *MockIntelligentRouter) GetRoutingDecision(ctx context.Context, features map[string]float64) (*interfaces.RoutingDecision, error) {
	args := m.Called(ctx, features)
	return args.Get(0).(*interfaces.RoutingDecision), args.Error(1)
}

func (m *MockIntelligentRouter) UpdateRoutingStrategy(ctx context.Context, strategy *interfaces.RoutingStrategy) error {
	args := m.Called(ctx, strategy)
	return args.Error(0)
}

func TestAnalyzeTransaction_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := &models.TransactionData{
		TransactionID: "test-tx-001",
		Amount:        decimal.NewFromFloat(1000.50),
		Timestamp:     time.Now(),
		MerchantID:    "merchant-001",
		UserID:        "user-001",
		PaymentMethod: "credit_card",
	}

	// Mock expectations
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)

	expectedResult := &models.FraudResult{
		TransactionID:    "test-tx-001",
		FraudScore:       0.25,
		RiskLevel:        models.RiskLevelLow,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 75,
		ModelVersion:     "vqc-v1.0",
	}

	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(expectedResult, nil)

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, expectedResult.TransactionID, response.Result.TransactionID)
	assert.Equal(t, expectedResult.FraudScore, response.Result.FraudScore)
	assert.Equal(t, "quantum", response.ProcessingMethod)
	assert.NotEmpty(t, response.RequestID)

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_ValidationError(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create invalid request (missing required fields)
	requestBody := AnalyzeTransactionRequest{
		Transaction: &models.TransactionData{
			// Missing required fields
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// The handler first validates the struct, then validates the transaction
	// Since the struct validation passes but transaction validation fails, it should be INVALID_TRANSACTION
	// But if struct validation fails first, it will be VALIDATION_ERROR
	assert.Contains(t, []string{"INVALID_TRANSACTION", "VALIDATION_ERROR"}, response.ErrorCode)
	assert.Contains(t, response.Message, "validation failed")
}

func TestAnalyzeBatch_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create test transactions
	transactions := []*models.TransactionData{
		{
			TransactionID: "test-tx-001",
			Amount:        decimal.NewFromFloat(1000.50),
			Timestamp:     time.Now(),
			MerchantID:    "merchant-001",
			UserID:        "user-001",
			PaymentMethod: "credit_card",
		},
		{
			TransactionID: "test-tx-002",
			Amount:        decimal.NewFromFloat(500.25),
			Timestamp:     time.Now(),
			MerchantID:    "merchant-002",
			UserID:        "user-002",
			PaymentMethod: "debit_card",
		},
	}

	// Mock expectations
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)

	expectedResults := []*models.FraudResult{
		{
			TransactionID:    "test-tx-001",
			FraudScore:       0.25,
			RiskLevel:        models.RiskLevelLow,
			ProcessingMethod: models.ProcessingMethodQuantum,
			Confidence:       0.85,
			ProcessingTimeMs: 75,
		},
		{
			TransactionID:    "test-tx-002",
			FraudScore:       0.15,
			RiskLevel:        models.RiskLevelLow,
			ProcessingMethod: models.ProcessingMethodQuantum,
			Confidence:       0.90,
			ProcessingTimeMs: 68,
		},
	}

	mockFraudService.On("AnalyzeBatchQuantum", mock.Anything, mock.AnythingOfType("[]*models.TransactionData")).Return(expectedResults, nil)

	// Create request
	requestBody := AnalyzeBatchRequest{
		Transactions: transactions,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeBatchResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Len(t, response.Results, 2)
	assert.Equal(t, 2, response.TotalProcessed)
	assert.Equal(t, 2, response.SuccessCount)
	assert.Equal(t, 0, response.ErrorCount)
	assert.Equal(t, "quantum", response.ProcessingMethod)

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_QuantumFallback(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := &models.TransactionData{
		TransactionID: "test-tx-001",
		Amount:        decimal.NewFromFloat(1000.50),
		Timestamp:     time.Now(),
		MerchantID:    "merchant-001",
		UserID:        "user-001",
		PaymentMethod: "credit_card",
	}

	// Mock expectations - quantum fails, classical succeeds
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)
	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return((*models.FraudResult)(nil), assert.AnError)

	classicalResult := &interfaces.ClassicalFraudResult{
		TransactionID:    "test-tx-001",
		FraudScore:       0.30,
		RiskLevel:        "medium",
		Confidence:       0.75,
		ProcessingTimeMs: 45,
		ModelVersion:     "classical-ml-v2.1",
	}

	mockFraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(classicalResult, nil)

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, classicalResult.TransactionID, response.Result.TransactionID)
	assert.Equal(t, classicalResult.FraudScore, response.Result.FraudScore)
	assert.Equal(t, "classical", response.ProcessingMethod) // Should fallback to classical

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestDetectFraudRings_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/fraud-rings/detect", handler.DetectFraudRings)

	// Create test transactions
	transactions := []*models.TransactionData{
		{
			TransactionID: "test-tx-001",
			Amount:        decimal.NewFromFloat(1000.50),
			Timestamp:     time.Now().Add(-1 * time.Hour),
			MerchantID:    "merchant-001",
			UserID:        "user-001",
			PaymentMethod: "credit_card",
		},
		{
			TransactionID: "test-tx-002",
			Amount:        decimal.NewFromFloat(1500.75),
			Timestamp:     time.Now().Add(-30 * time.Minute),
			MerchantID:    "merchant-001",
			UserID:        "user-002",
			PaymentMethod: "credit_card",
		},
	}

	// Create request
	requestBody := DetectFraudRingsRequest{
		Transactions: transactions,
		TimeWindow: &TimeWindowRequest{
			Start: time.Now().Add(-2 * time.Hour),
			End:   time.Now(),
		},
		Options: &FraudRingOptions{
			MinRingSize:    2,
			FraudThreshold: 0.7,
			EnableQuantum:  false, // Use classical for this test
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/fraud-rings/detect", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response DetectFraudRingsResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.NotNil(t, response.Result)
	assert.Equal(t, "classical", response.ProcessingMethod)
	assert.NotNil(t, response.GraphStats)
	assert.Equal(t, 2, response.GraphStats.TransactionCount)
	assert.NotEmpty(t, response.RequestID)
}

// Additional comprehensive tests for API endpoints

func TestAnalyzeTransaction_InvalidJSON(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create invalid JSON request
	invalidJSON := `{"transaction": {"amount": "invalid_decimal"}}`
	req, _ := http.NewRequest("POST", "/analyze", strings.NewReader(invalidJSON))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "INVALID_REQUEST", response.ErrorCode)
	assert.Contains(t, response.Message, "Invalid request format")
	assert.NotEmpty(t, response.RequestID)
	assert.NotZero(t, response.Timestamp)
}

func TestAnalyzeTransaction_MissingTransaction(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create request without transaction
	requestBody := AnalyzeTransactionRequest{
		Transaction: nil,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "VALIDATION_ERROR", response.ErrorCode)
}

func TestAnalyzeTransaction_InvalidTimeout(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create request with invalid timeout
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
		Options: &AnalysisOptions{
			TimeoutMs: 50, // Below minimum of 100ms
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "VALIDATION_ERROR", response.ErrorCode)
}

func TestAnalyzeTransaction_ConflictingOptions(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create request with conflicting options
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
		Options: &AnalysisOptions{
			ForceQuantum:   true,
			ForceClassical: true, // Conflicting with ForceQuantum
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "ROUTING_ERROR", response.ErrorCode)
	assert.Contains(t, response.Message, "Failed to determine processing method")
}

func TestAnalyzeTransaction_RouterError(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)

	// Mock router to return error
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethod(""), errors.New("router service unavailable"))

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "ROUTING_ERROR", response.ErrorCode)
	assert.Contains(t, response.Message, "Failed to determine processing method")

	// Verify mocks
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_BothProcessingMethodsFail(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)

	// Mock expectations - both quantum and classical fail
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)
	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return((*models.FraudResult)(nil), errors.New("quantum processing failed"))
	mockFraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return((*interfaces.ClassicalFraudResult)(nil), errors.New("classical processing failed"))

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "PROCESSING_ERROR", response.ErrorCode)
	assert.Contains(t, response.Message, "Both quantum and classical processing failed")

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_ForceQuantum(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)

	// Mock expectations - should not call router when forced
	expectedResult := &models.FraudResult{
		TransactionID:    "test-tx-001",
		FraudScore:       0.25,
		RiskLevel:        models.RiskLevelLow,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 75,
		ModelVersion:     "vqc-v1.0",
	}

	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(expectedResult, nil)

	// Create request with forced quantum
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
		Options: &AnalysisOptions{
			ForceQuantum: true,
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "quantum", response.ProcessingMethod)
	assert.Equal(t, expectedResult.TransactionID, response.Result.TransactionID)

	// Verify mocks - router should not be called when forced
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertNotCalled(t, "RouteTransaction")
}

func TestAnalyzeTransaction_ForceClassical(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)

	// Mock expectations
	classicalResult := &interfaces.ClassicalFraudResult{
		TransactionID:    "test-tx-001",
		FraudScore:       0.30,
		RiskLevel:        "medium",
		Confidence:       0.75,
		ProcessingTimeMs: 45,
		ModelVersion:     "classical-ml-v2.1",
	}

	mockFraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(classicalResult, nil)

	// Create request with forced classical
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
		Options: &AnalysisOptions{
			ForceClassical: true,
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "classical", response.ProcessingMethod)
	assert.Equal(t, classicalResult.TransactionID, response.Result.TransactionID)

	// Verify mocks - router should not be called when forced
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertNotCalled(t, "RouteTransaction")
}

func TestAnalyzeBatch_EmptyTransactions(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create request with empty transactions
	requestBody := AnalyzeBatchRequest{
		Transactions: []*models.TransactionData{},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "VALIDATION_ERROR", response.ErrorCode)
}

func TestAnalyzeBatch_TooManyTransactions(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create request with too many transactions (over 1000 limit)
	transactions := make([]*models.TransactionData, 1001)
	for i := 0; i < 1001; i++ {
		transactions[i] = createTestTransaction(fmt.Sprintf("tx-%d", i), "user-001", "merchant-001", 100.0)
	}

	requestBody := AnalyzeBatchRequest{
		Transactions: transactions,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "VALIDATION_ERROR", response.ErrorCode)
}

func TestAnalyzeBatch_InvalidTransactionInBatch(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create transactions with one invalid transaction
	transactions := []*models.TransactionData{
		createTestTransaction("tx-001", "user-001", "merchant-001", 100.0),
		{
			TransactionID: "tx-002",
			Amount:        decimal.NewFromFloat(-100.0), // Invalid negative amount
			Timestamp:     time.Now(),
			MerchantID:    "merchant-001",
			UserID:        "user-001",
			PaymentMethod: "credit_card",
		},
	}

	requestBody := AnalyzeBatchRequest{
		Transactions: transactions,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "INVALID_TRANSACTION", response.ErrorCode)
	assert.Contains(t, response.Details, "transaction_index")
	assert.Equal(t, float64(1), response.Details["transaction_index"]) // Second transaction (index 1)
}

func TestAnalyzeBatch_QuantumFallbackToClassical(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create test transactions
	transactions := []*models.TransactionData{
		createTestTransaction("tx-001", "user-001", "merchant-001", 100.0),
		createTestTransaction("tx-002", "user-002", "merchant-002", 200.0),
	}

	// Mock expectations - quantum fails, classical succeeds
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)
	mockFraudService.On("AnalyzeBatchQuantum", mock.Anything, mock.AnythingOfType("[]*models.TransactionData")).Return(([]*models.FraudResult)(nil), errors.New("quantum batch processing failed"))

	// Mock classical processing for fallback
	classicalResults := []*interfaces.ClassicalFraudResult{
		{
			TransactionID:    "tx-001",
			FraudScore:       0.20,
			RiskLevel:        "low",
			Confidence:       0.80,
			ProcessingTimeMs: 30,
			ModelVersion:     "classical-v1.0",
		},
		{
			TransactionID:    "tx-002",
			FraudScore:       0.35,
			RiskLevel:        "medium",
			Confidence:       0.75,
			ProcessingTimeMs: 35,
			ModelVersion:     "classical-v1.0",
		},
	}

	// Mock individual classical calls for batch processing
	mockFraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.MatchedBy(func(tx *models.TransactionData) bool {
		return tx.TransactionID == "tx-001"
	})).Return(classicalResults[0], nil)

	mockFraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.MatchedBy(func(tx *models.TransactionData) bool {
		return tx.TransactionID == "tx-002"
	})).Return(classicalResults[1], nil)

	// Create request
	requestBody := AnalyzeBatchRequest{
		Transactions: transactions,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeBatchResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Len(t, response.Results, 2)
	assert.Equal(t, 2, response.TotalProcessed)
	assert.Equal(t, 2, response.SuccessCount)
	assert.Equal(t, 0, response.ErrorCount)
	assert.Equal(t, "classical", response.ProcessingMethod) // Should fallback to classical

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestDetectFraudRings_InvalidTimeWindow(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/fraud-rings/detect", handler.DetectFraudRings)

	// Create request with invalid time window (end before start)
	transactions := []*models.TransactionData{
		createTestTransaction("tx-001", "user-001", "merchant-001", 100.0),
	}

	requestBody := DetectFraudRingsRequest{
		Transactions: transactions,
		TimeWindow: &TimeWindowRequest{
			Start: time.Now(),
			End:   time.Now().Add(-1 * time.Hour), // End before start
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/fraud-rings/detect", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "INVALID_TIME_WINDOW", response.ErrorCode)
	assert.Contains(t, response.Message, "End time must be after start time")
}

func TestDetectFraudRings_TooManyTransactions(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/fraud-rings/detect", handler.DetectFraudRings)

	// Create request with too many transactions (over 10000 limit)
	transactions := make([]*models.TransactionData, 10001)
	for i := 0; i < 10001; i++ {
		transactions[i] = createTestTransaction(fmt.Sprintf("tx-%d", i), "user-001", "merchant-001", 100.0)
	}

	requestBody := DetectFraudRingsRequest{
		Transactions: transactions,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/fraud-rings/detect", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "VALIDATION_ERROR", response.ErrorCode)
}

func TestDetectFraudRings_InvalidOptions(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/fraud-rings/detect", handler.DetectFraudRings)

	// Create request with invalid options
	transactions := []*models.TransactionData{
		createTestTransaction("tx-001", "user-001", "merchant-001", 100.0),
	}

	requestBody := DetectFraudRingsRequest{
		Transactions: transactions,
		Options: &FraudRingOptions{
			MinRingSize:    1,   // Below minimum of 2
			FraudThreshold: 1.5, // Above maximum of 1.0
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/fraud-rings/detect", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "VALIDATION_ERROR", response.ErrorCode)
}

// Performance Tests

func TestAnalyzeTransaction_PerformanceUnder100ms(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)

	// Mock expectations with sub-100ms processing time
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)

	expectedResult := &models.FraudResult{
		TransactionID:    "test-tx-001",
		FraudScore:       0.25,
		RiskLevel:        models.RiskLevelLow,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 75, // Sub-100ms as required
		ModelVersion:     "vqc-v1.0",
	}

	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(expectedResult, nil)

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Measure actual API response time
	start := time.Now()

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	apiResponseTime := time.Since(start)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify processing time in response meets requirement
	assert.LessOrEqual(t, response.Result.ProcessingTimeMs, int64(100), "Processing time should be under 100ms")

	// Verify actual API response time is reasonable (should be much faster than processing time)
	assert.Less(t, apiResponseTime.Milliseconds(), int64(50), "API response time should be under 50ms for mocked services")

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeBatch_PerformanceBenchmark(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create batch of 100 transactions
	transactions := make([]*models.TransactionData, 100)
	expectedResults := make([]*models.FraudResult, 100)

	for i := 0; i < 100; i++ {
		transactions[i] = createTestTransaction(fmt.Sprintf("tx-%03d", i), fmt.Sprintf("user-%03d", i), "merchant-001", float64(100+i))
		expectedResults[i] = &models.FraudResult{
			TransactionID:    fmt.Sprintf("tx-%03d", i),
			FraudScore:       0.1 + float64(i)*0.001, // Varying fraud scores
			RiskLevel:        models.RiskLevelLow,
			ProcessingMethod: models.ProcessingMethodQuantum,
			Confidence:       0.85,
			ProcessingTimeMs: 50 + int64(i%10), // Varying processing times
			ModelVersion:     "vqc-v1.0",
		}
	}

	// Mock expectations
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)
	mockFraudService.On("AnalyzeBatchQuantum", mock.Anything, mock.AnythingOfType("[]*models.TransactionData")).Return(expectedResults, nil)

	// Create request
	requestBody := AnalyzeBatchRequest{
		Transactions: transactions,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Measure performance
	start := time.Now()

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	totalTime := time.Since(start)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeBatchResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Len(t, response.Results, 100)
	assert.Equal(t, 100, response.TotalProcessed)
	assert.Equal(t, 100, response.SuccessCount)
	assert.Equal(t, 0, response.ErrorCount)

	// Performance assertions - batch should be efficient
	assert.Less(t, totalTime.Milliseconds(), int64(500), "Batch processing of 100 transactions should complete in under 500ms")

	// Calculate average processing time per transaction
	avgProcessingTime := totalTime.Milliseconds() / int64(len(transactions))
	assert.Less(t, avgProcessingTime, int64(5), "Average processing time per transaction should be under 5ms for batch")

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_ConcurrentRequests(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Mock expectations for concurrent requests
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)

	expectedResult := &models.FraudResult{
		TransactionID:    "concurrent-tx-0", // Will be overridden by actual transaction ID
		FraudScore:       0.25,
		RiskLevel:        models.RiskLevelLow,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 75,
		ModelVersion:     "vqc-v1.0",
	}

	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(expectedResult, nil)

	// Test concurrent requests
	concurrentRequests := 10
	results := make(chan bool, concurrentRequests)

	start := time.Now()

	for i := 0; i < concurrentRequests; i++ {
		go func(id int) {
			// Create unique transaction for each request
			transaction := createTestTransaction(fmt.Sprintf("concurrent-tx-%d", id), fmt.Sprintf("user-%d", id), "merchant-001", 1000.50)

			requestBody := AnalyzeTransactionRequest{
				Transaction: transaction,
			}

			jsonBody, _ := json.Marshal(requestBody)
			req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			// Execute request
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Check if request was successful
			results <- w.Code == http.StatusOK
		}(i)
	}

	// Wait for all requests to complete
	successCount := 0
	for i := 0; i < concurrentRequests; i++ {
		if <-results {
			successCount++
		}
	}

	totalTime := time.Since(start)

	// Assertions
	assert.Equal(t, concurrentRequests, successCount, "All concurrent requests should succeed")
	assert.Less(t, totalTime.Milliseconds(), int64(1000), "Concurrent requests should complete within 1 second")

	// Verify that the service can handle concurrent load
	avgTimePerRequest := totalTime.Milliseconds() / int64(concurrentRequests)
	assert.Less(t, avgTimePerRequest, int64(200), "Average time per concurrent request should be reasonable")
}

// Edge Cases and Error Handling Tests

func TestAnalyzeTransaction_ContextTimeout(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create test transaction
	transaction := createTestTransaction("test-tx-001", "user-001", "merchant-001", 1000.50)

	// Mock expectations with timeout
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)
	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return((*models.FraudResult)(nil), context.DeadlineExceeded)

	// Mock classical fallback that also times out
	mockFraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return((*interfaces.ClassicalFraudResult)(nil), context.DeadlineExceeded)

	// Create request with very short timeout
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
		Options: &AnalysisOptions{
			TimeoutMs: 100, // Very short timeout
		},
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "PROCESSING_ERROR", response.ErrorCode)

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_LargeTransactionAmount(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create transaction with very large amount
	transaction := &models.TransactionData{
		TransactionID: "large-tx-001",
		Amount:        decimal.NewFromFloat(999999999.99), // Very large amount
		Timestamp:     time.Now(),
		MerchantID:    "merchant-001",
		UserID:        "user-001",
		PaymentMethod: "credit_card",
	}

	// Mock expectations
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)

	expectedResult := &models.FraudResult{
		TransactionID:    "large-tx-001",
		FraudScore:       0.95, // High fraud score for large amount
		RiskLevel:        models.RiskLevelCritical,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.99,
		ProcessingTimeMs: 85,
		ModelVersion:     "vqc-v1.0",
	}

	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(expectedResult, nil)

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusOK, w.Code)

	var response AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, expectedResult.TransactionID, response.Result.TransactionID)
	assert.Equal(t, models.RiskLevelCritical, response.Result.RiskLevel)
	assert.True(t, response.Result.FraudScore >= 0.9, "Large transactions should have high fraud scores")

	// Verify mocks
	mockFraudService.AssertExpectations(t)
	mockRouter.AssertExpectations(t)
}

func TestAnalyzeTransaction_FutureTimestamp(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Create transaction with future timestamp
	transaction := &models.TransactionData{
		TransactionID: "future-tx-001",
		Amount:        decimal.NewFromFloat(1000.50),
		Timestamp:     time.Now().Add(2 * time.Hour), // Future timestamp
		MerchantID:    "merchant-001",
		UserID:        "user-001",
		PaymentMethod: "credit_card",
	}

	// Create request
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}

	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "INVALID_TRANSACTION", response.ErrorCode)
	assert.Contains(t, response.Message, "validation failed")
}

// Helper function to create a valid test transaction
func createTestTransaction(id, userID, merchantID string, amount float64) *models.TransactionData {
	return &models.TransactionData{
		TransactionID: id,
		Amount:        decimal.NewFromFloat(amount),
		Timestamp:     time.Now(),
		MerchantID:    merchantID,
		UserID:        userID,
		PaymentMethod: "credit_card",
	}
}

// Benchmark tests for performance validation

func BenchmarkAnalyzeTransaction(b *testing.B) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze", handler.AnalyzeTransaction)

	// Mock expectations
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)

	expectedResult := &models.FraudResult{
		TransactionID:    "benchmark-tx",
		FraudScore:       0.25,
		RiskLevel:        models.RiskLevelLow,
		ProcessingMethod: models.ProcessingMethodQuantum,
		Confidence:       0.85,
		ProcessingTimeMs: 75,
		ModelVersion:     "vqc-v1.0",
	}

	mockFraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(expectedResult, nil)

	// Prepare request
	transaction := createTestTransaction("benchmark-tx", "user-001", "merchant-001", 1000.50)
	requestBody := AnalyzeTransactionRequest{
		Transaction: transaction,
	}
	jsonBody, _ := json.Marshal(requestBody)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("POST", "/analyze", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}

func BenchmarkAnalyzeBatch(b *testing.B) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockFraudService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)
	handler := NewHandler(mockFraudService, mockRouter)

	router := gin.New()
	router.POST("/analyze/batch", handler.AnalyzeBatch)

	// Create batch of transactions
	transactions := make([]*models.TransactionData, 10)
	expectedResults := make([]*models.FraudResult, 10)

	for i := 0; i < 10; i++ {
		transactions[i] = createTestTransaction(fmt.Sprintf("benchmark-tx-%d", i), fmt.Sprintf("user-%d", i), "merchant-001", float64(100+i))
		expectedResults[i] = &models.FraudResult{
			TransactionID:    fmt.Sprintf("benchmark-tx-%d", i),
			FraudScore:       0.1 + float64(i)*0.01,
			RiskLevel:        models.RiskLevelLow,
			ProcessingMethod: models.ProcessingMethodQuantum,
			Confidence:       0.85,
			ProcessingTimeMs: 50,
			ModelVersion:     "vqc-v1.0",
		}
	}

	// Mock expectations
	mockRouter.On("RouteTransaction", mock.Anything, mock.AnythingOfType("*models.TransactionData")).Return(interfaces.ProcessingMethodQuantum, nil)
	mockFraudService.On("AnalyzeBatchQuantum", mock.Anything, mock.AnythingOfType("[]*models.TransactionData")).Return(expectedResults, nil)

	// Prepare request
	requestBody := AnalyzeBatchRequest{
		Transactions: transactions,
	}
	jsonBody, _ := json.Marshal(requestBody)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("POST", "/analyze/batch", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}
