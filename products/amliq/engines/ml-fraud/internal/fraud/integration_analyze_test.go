package fraud

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// TestIntegration_Analyze_ValidTransaction verifies 200 with correct response shape.
func TestIntegration_Analyze_ValidTransaction(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("txn-001", 250.00, "credit_card")
	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)
	fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return(&models.FraudResult{
			TransactionID: "txn-001", FraudScore: 0.35, RiskLevel: models.RiskLevelMedium,
			ProcessingMethod: models.ProcessingMethodQuantum, Confidence: 0.9,
			ProcessingTimeMs: 42, ModelVersion: "v1.0",
		}, nil)

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"))

	var resp AnalyzeTransactionResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "quantum", resp.ProcessingMethod)
	assert.NotEmpty(t, resp.RequestID)
	assert.NotNil(t, resp.Result)
}

// TestIntegration_Analyze_MissingContentType verifies 415 for missing Content-Type.
func TestIntegration_Analyze_MissingContentType(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(`{}`))
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnsupportedMediaType, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

// TestIntegration_Analyze_OversizedBody verifies 413 for body > 1 MiB.
func TestIntegration_Analyze_OversizedBody(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))
	large := bytes.Repeat([]byte("x"), (1<<20)+1)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(large))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

// TestIntegration_Analyze_InvalidJSON verifies 400 for malformed JSON.
func TestIntegration_Analyze_InvalidJSON(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(`{bad`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestIntegration_Analyze_QuantumFallbackToClassical verifies quantum failure triggers classical.
func TestIntegration_Analyze_QuantumFallbackToClassical(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("txn-002", 500.00, "credit_card")
	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)
	fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return((*models.FraudResult)(nil), errors.New("quantum unavailable"))
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "txn-002", FraudScore: 0.45, RiskLevel: "medium",
			Confidence: 0.85, ProcessingTimeMs: 15, ModelVersion: "v1.0",
		}, nil)

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp AnalyzeTransactionResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "classical", resp.ProcessingMethod)
}

// TestIntegration_Analyze_BothMethodsFail verifies 500 when quantum+classical fail.
func TestIntegration_Analyze_BothMethodsFail(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("txn-003", 100.00, "credit_card")
	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)
	fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return((*models.FraudResult)(nil), errors.New("quantum fail"))
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return((*interfaces.ClassicalFraudResult)(nil), errors.New("classical fail"))

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	var errResp ErrorResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &errResp))
	assert.Equal(t, "PROCESSING_ERROR", errResp.ErrorCode)
	assert.NotEmpty(t, errResp.RequestID)
}

// TestIntegration_Analyze_RateLimitHeaders verifies rate limit headers on success.
func TestIntegration_Analyze_RateLimitHeaders(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "txn-rl", FraudScore: 0.1, RiskLevel: "low",
			Confidence: 0.9, ProcessingTimeMs: 5, ModelVersion: "v1.0",
		}, nil)

	tx := newTestTransaction("txn-rl", 50.00, "debit_card")
	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, "120", w.Header().Get("X-RateLimit-Limit"))
}
