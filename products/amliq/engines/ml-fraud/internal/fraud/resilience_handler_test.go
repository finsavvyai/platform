package fraud

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// TestResilience_Handler_QuantumFallbackToClassical verifies that a quantum
// timeout triggers a classical fallback with correct response.
func TestResilience_Handler_QuantumFallbackToClassical(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("tx-res-001", 100.0, "credit_card")

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)

	// Quantum fails with deadline exceeded
	fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return(&models.FraudResult{}, context.DeadlineExceeded)

	// Classical succeeds as fallback
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "tx-res-001", FraudScore: 0.3,
			RiskLevel: "medium", Confidence: 0.85,
			ProcessingTimeMs: 15, ModelVersion: "v1.0",
		}, nil)

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp AnalyzeTransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "classical", resp.ProcessingMethod)
	assert.NotEmpty(t, resp.RequestID)
}

// TestResilience_Handler_DualFailure verifies that both quantum and
// classical failure returns 500 with dual error details.
func TestResilience_Handler_DualFailure(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("tx-res-002", 200.0, "credit_card")

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)

	fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return(&models.FraudResult{}, errors.New("quantum backend offline"))

	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{}, errors.New("classical model unavailable"))

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "PROCESSING_ERROR", errResp.ErrorCode)
	assert.Contains(t, errResp.Details, "quantum_error")
	assert.Contains(t, errResp.Details, "classical_error")
}

// TestResilience_Handler_RouterFailure verifies that a routing error
// returns 500 with ROUTING_ERROR code.
func TestResilience_Handler_RouterFailure(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("tx-res-003", 300.0, "credit_card")

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethod(""), errors.New("router unreachable"))

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "ROUTING_ERROR", errResp.ErrorCode)
}

// TestResilience_Handler_BatchQuantumFallback verifies batch quantum
// failure falls back to classical batch processing.
func TestResilience_Handler_BatchQuantumFallback(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	txs := []*models.TransactionData{
		newTestTransaction("tx-b-001", 100.0, "credit_card"),
		newTestTransaction("tx-b-002", 200.0, "credit_card"),
	}

	// All transactions route to quantum (>30% threshold)
	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)

	// Quantum batch fails
	fraudService.On("AnalyzeBatchQuantum", mock.Anything, mock.Anything).
		Return([]*models.FraudResult{}, errors.New("quantum batch failed"))

	// Classical fallback succeeds per-transaction
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "tx-b-fallback", FraudScore: 0.2,
			RiskLevel: "low", Confidence: 0.9,
			ProcessingTimeMs: 10, ModelVersion: "v1.0",
		}, nil)

	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: txs})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp AnalyzeBatchResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "classical", resp.ProcessingMethod)
	assert.Equal(t, 2, resp.TotalProcessed)
	assert.Equal(t, 2, resp.SuccessCount)
}
