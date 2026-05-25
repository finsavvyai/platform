package fraud

import (
	"bytes"
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

// TestIntegration_Batch_ValidBatch verifies 200 with correct counts for a valid batch.
func TestIntegration_Batch_ValidBatch(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	txns := []*models.TransactionData{
		newTestTransaction("b-1", 100, "credit_card"),
		newTestTransaction("b-2", 200, "debit_card"),
		newTestTransaction("b-3", 300, "bank_transfer"),
	}

	// All route to classical (below 30% quantum threshold)
	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)
	svc.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "b-x", FraudScore: 0.2, RiskLevel: "low",
			Confidence: 0.9, ProcessingTimeMs: 10, ModelVersion: "v1",
		}, nil)

	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: txns})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp AnalyzeBatchResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 3, resp.TotalProcessed)
	assert.Equal(t, 3, resp.SuccessCount)
	assert.Equal(t, 0, resp.ErrorCount)
	assert.NotEmpty(t, resp.RequestID)
}

// TestIntegration_Batch_EmptyTransactions verifies 400 for empty transactions array.
func TestIntegration_Batch_EmptyTransactions(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))
	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: []*models.TransactionData{}})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp ErrorResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &errResp))
	assert.Equal(t, "VALIDATION_ERROR", errResp.ErrorCode)
}

// TestIntegration_Batch_InvalidTransaction verifies 400 with transaction_index for invalid tx.
func TestIntegration_Batch_InvalidTransaction(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	validTx := newTestTransaction("b-ok", 100, "credit_card")
	badTx := newTestTransaction("b-bad", -5, "credit_card") // negative amount

	body, _ := json.Marshal(AnalyzeBatchRequest{
		Transactions: []*models.TransactionData{validTx, badTx},
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp ErrorResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_TRANSACTION", errResp.ErrorCode)
	assert.Contains(t, errResp.Details, "transaction_index")
}

// TestIntegration_Batch_QuantumRouting verifies quantum selection when >30% route to quantum.
func TestIntegration_Batch_QuantumRouting(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	txns := []*models.TransactionData{
		newTestTransaction("bq-1", 100, "credit_card"),
		newTestTransaction("bq-2", 200, "credit_card"),
		newTestTransaction("bq-3", 300, "credit_card"),
	}

	// All three route to quantum (100% > 30% threshold)
	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)
	results := []*models.FraudResult{
		{TransactionID: "bq-1", FraudScore: 0.3, ProcessingTimeMs: 20, ModelVersion: "v1"},
		{TransactionID: "bq-2", FraudScore: 0.4, ProcessingTimeMs: 20, ModelVersion: "v1"},
		{TransactionID: "bq-3", FraudScore: 0.5, ProcessingTimeMs: 20, ModelVersion: "v1"},
	}
	svc.On("AnalyzeBatchQuantum", mock.Anything, mock.Anything).Return(results, nil)

	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: txns})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp AnalyzeBatchResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "quantum", resp.ProcessingMethod)
}

// TestIntegration_Batch_QuantumFallbackToClassical verifies classical fallback for batch.
func TestIntegration_Batch_QuantumFallbackToClassical(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	txns := []*models.TransactionData{
		newTestTransaction("bf-1", 100, "credit_card"),
	}

	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)
	svc.On("AnalyzeBatchQuantum", mock.Anything, mock.Anything).
		Return(([]*models.FraudResult)(nil), errors.New("batch quantum fail"))
	svc.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "bf-1", FraudScore: 0.15, RiskLevel: "low",
			Confidence: 0.88, ProcessingTimeMs: 8, ModelVersion: "v1",
		}, nil)

	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: txns})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp AnalyzeBatchResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "classical", resp.ProcessingMethod)
}
