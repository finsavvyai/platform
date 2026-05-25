package fraud

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// assertSnakeCaseKeys recursively verifies all map keys are snake_case.
func assertSnakeCaseKeys(t *testing.T, v interface{}, path string) {
	t.Helper()
	switch val := v.(type) {
	case map[string]interface{}:
		for key, child := range val {
			assert.Equal(t, strings.ToLower(key), key, "field %s.%s not lowercase", path, key)
			assert.NotContains(t, key, "-", "field %s.%s uses hyphens", path, key)
			assertSnakeCaseKeys(t, child, path+"."+key)
		}
	case []interface{}:
		for i, item := range val {
			assertSnakeCaseKeys(t, item, path+"[]")
			_ = i
		}
	}
}

// assertISO8601 verifies a string field parses as RFC3339.
func assertISO8601(t *testing.T, raw map[string]interface{}, key string) {
	t.Helper()
	ts, ok := raw[key].(string)
	assert.True(t, ok, "field %s should be a string", key)
	_, err := time.Parse(time.RFC3339Nano, ts)
	assert.NoError(t, err, "%s must be ISO 8601 / RFC3339", key)
}

func TestContract_SuccessFormat_Analyze(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(svc, rtr)

	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)
	svc.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "txn-s1", FraudScore: 0.15, RiskLevel: "low",
			Confidence: 0.9, ProcessingTimeMs: 10, ModelVersion: "v1",
		}, nil)

	tx := newTestTransaction("txn-s1", 50.0, "credit_card")
	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))

	// Required top-level fields
	assert.Contains(t, raw, "result")
	assert.Contains(t, raw, "processing_method")
	assert.Contains(t, raw, "request_id")
	assert.Contains(t, raw, "processed_at")

	assertISO8601(t, raw, "processed_at")
	assertSnakeCaseKeys(t, raw, "root")

	// request_id matches header
	assert.Equal(t, raw["request_id"], w.Header().Get("X-Request-ID"))
}

func TestContract_SuccessFormat_Batch(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(svc, rtr)

	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)
	svc.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "txn-b", FraudScore: 0.1, RiskLevel: "low",
			Confidence: 0.8, ProcessingTimeMs: 5, ModelVersion: "v1",
		}, nil)

	txs := []*models.TransactionData{
		newTestTransaction("txn-b1", 10.0, "credit_card"),
		newTestTransaction("txn-b2", 20.0, "debit_card"),
	}
	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: txs})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))

	assert.Contains(t, raw, "results")
	assert.Contains(t, raw, "total_processed")
	assert.Contains(t, raw, "success_count")
	assert.Contains(t, raw, "error_count")
	assert.Contains(t, raw, "processing_method")
	assert.Contains(t, raw, "request_id")
	assert.Contains(t, raw, "processed_at")

	assertISO8601(t, raw, "processed_at")
	assertSnakeCaseKeys(t, raw, "root")
	assert.Equal(t, float64(2), raw["total_processed"])
}

func TestContract_SuccessFormat_Performance(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(svc, rtr)

	svc.On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{
			AverageProcessingTime: 42.0,
		}, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))

	assert.Contains(t, raw, "metrics")
	assert.Contains(t, raw, "request_id")
	assert.Contains(t, raw, "timestamp")
	assertSnakeCaseKeys(t, raw, "root")
}

func TestContract_SuccessFormat_BackendStatus(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(svc, rtr)

	svc.On("GetQuantumBackendStatus", mock.Anything).
		Return(&interfaces.QuantumBackendStatus{
			RecommendedBackend: "sim",
		}, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/backends/status", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))

	assert.Contains(t, raw, "status")
	assert.Contains(t, raw, "request_id")
	assertSnakeCaseKeys(t, raw, "root")
}

func TestContract_SuccessFormat_RoutingDecision(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(svc, rtr)

	rtr.On("GetRoutingDecision", mock.Anything, mock.Anything).
		Return(&interfaces.RoutingDecision{
			Method: interfaces.ProcessingMethodQuantum, Confidence: 0.9,
		}, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/routing/decision?amount=100", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))

	assert.Contains(t, raw, "decision")
	assert.Contains(t, raw, "features")
	assert.Contains(t, raw, "request_id")
	assertSnakeCaseKeys(t, raw, "root")
}
