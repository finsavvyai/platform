package fraud

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
)

// TestIntegration_ReadOnly_Performance verifies GET /v1/performance 200 and 500.
func TestIntegration_ReadOnly_Performance(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	svc.On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{AverageProcessingTime: 42.0}, nil).Once()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "metrics")
	assert.Contains(t, body, "request_id")

	// Error path
	svc.On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{}, errors.New("fail")).Once()

	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	r.ServeHTTP(wErr, reqErr)

	assert.Equal(t, http.StatusInternalServerError, wErr.Code)
	var errResp ErrorResponse
	assert.NoError(t, json.Unmarshal(wErr.Body.Bytes(), &errResp))
	assert.Equal(t, "PERFORMANCE_ERROR", errResp.ErrorCode)
}

// TestIntegration_ReadOnly_BackendStatus verifies GET /v1/backends/status 200 and 500.
func TestIntegration_ReadOnly_BackendStatus(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	svc.On("GetQuantumBackendStatus", mock.Anything).
		Return(&interfaces.QuantumBackendStatus{RecommendedBackend: "sim"}, nil).Once()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/backends/status", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "status")
	assert.Contains(t, body, "request_id")

	// Error path
	svc.On("GetQuantumBackendStatus", mock.Anything).
		Return(&interfaces.QuantumBackendStatus{}, errors.New("fail")).Once()

	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest(http.MethodGet, "/v1/backends/status", nil)
	r.ServeHTTP(wErr, reqErr)

	assert.Equal(t, http.StatusInternalServerError, wErr.Code)
}

// TestIntegration_ReadOnly_RoutingDecision verifies GET /v1/routing/decision with features.
func TestIntegration_ReadOnly_RoutingDecision(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	rtr.On("GetRoutingDecision", mock.Anything,
		mock.MatchedBy(func(f map[string]float64) bool {
			return f["amount"] == 100 && f["risk_score"] == 0.5
		}),
	).Return(&interfaces.RoutingDecision{
		Method: interfaces.ProcessingMethodQuantum, Confidence: 0.9,
	}, nil).Once()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/routing/decision?amount=100&risk_score=0.5", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "decision")
	assert.Contains(t, body, "features")

	// Error path
	rtr.On("GetRoutingDecision", mock.Anything, mock.Anything).
		Return(&interfaces.RoutingDecision{}, errors.New("fail")).Once()

	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest(http.MethodGet, "/v1/routing/decision", nil)
	r.ServeHTTP(wErr, reqErr)

	assert.Equal(t, http.StatusInternalServerError, wErr.Code)
}

// TestIntegration_ReadOnly_RateLimitHeader verifies 240 rpm limit on read-only endpoints.
func TestIntegration_ReadOnly_RateLimitHeader(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	svc.On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{}, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, "240", w.Header().Get("X-RateLimit-Limit"))
}
