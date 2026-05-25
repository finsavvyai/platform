package fraud

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
)

func setupFraudRoutesRouter(fraudService *MockFraudDetectionService, intelligentRouter *MockIntelligentRouter) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	v1 := router.Group("/v1")
	RegisterRoutes(v1, fraudService, intelligentRouter)
	return router
}

func TestRegisterRoutes_RegistersExpectedPaths(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	registered := map[string]bool{}
	for _, route := range router.Routes() {
		registered[route.Method+" "+route.Path] = true
	}

	assert.True(t, registered["POST /v1/analyze"])
	assert.True(t, registered["POST /v1/analyze/batch"])
	assert.True(t, registered["POST /v1/fraud-rings/detect"])
	assert.True(t, registered["GET /v1/performance"])
	assert.True(t, registered["GET /v1/backends/status"])
	assert.True(t, registered["GET /v1/routing/decision"])
}

func TestGetPerformanceMetrics_SuccessAndError(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	intelligentRouter := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(fraudService, intelligentRouter)

	fraudService.
		On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{AverageProcessingTime: 42.0}, nil).
		Once()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	var successBody map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &successBody)
	assert.NoError(t, err)
	assert.Contains(t, successBody, "metrics")

	fraudService.
		On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{}, errors.New("metrics unavailable")).
		Once()

	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	router.ServeHTTP(wErr, reqErr)

	assert.Equal(t, http.StatusInternalServerError, wErr.Code)

	var errBody ErrorResponse
	unmarshalErr := json.Unmarshal(wErr.Body.Bytes(), &errBody)
	assert.NoError(t, unmarshalErr)
	assert.Equal(t, "PERFORMANCE_ERROR", errBody.ErrorCode)
}

func TestGetBackendStatus_SuccessAndError(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	intelligentRouter := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(fraudService, intelligentRouter)

	fraudService.
		On("GetQuantumBackendStatus", mock.Anything).
		Return(&interfaces.QuantumBackendStatus{RecommendedBackend: "local_simulator"}, nil).
		Once()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/backends/status", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	fraudService.
		On("GetQuantumBackendStatus", mock.Anything).
		Return(&interfaces.QuantumBackendStatus{}, errors.New("backend status unavailable")).
		Once()

	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest(http.MethodGet, "/v1/backends/status", nil)
	router.ServeHTTP(wErr, reqErr)

	assert.Equal(t, http.StatusInternalServerError, wErr.Code)

	var errBody ErrorResponse
	unmarshalErr := json.Unmarshal(wErr.Body.Bytes(), &errBody)
	assert.NoError(t, unmarshalErr)
	assert.Equal(t, "BACKEND_ERROR", errBody.ErrorCode)
}

func TestGetRoutingDecision_ParsesFeaturesAndHandlesError(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	intelligentRouter := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(fraudService, intelligentRouter)

	intelligentRouter.
		On(
			"GetRoutingDecision",
			mock.Anything,
			mock.MatchedBy(func(features map[string]float64) bool {
				return len(features) == 2 && features["amount"] == 100.5 && features["risk_score"] == 0.8
			}),
		).
		Return(&interfaces.RoutingDecision{
			Method:            interfaces.ProcessingMethodQuantum,
			Confidence:        0.9,
			Reasoning:         "high-value transaction",
			ExpectedAdvantage: 0.3,
		}, nil).
		Once()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/routing/decision?amount=100.5&risk_score=0.8", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	intelligentRouter.
		On(
			"GetRoutingDecision",
			mock.Anything,
			mock.MatchedBy(func(features map[string]float64) bool {
				_, hasAmount := features["amount"]
				_, hasRisk := features["risk_score"]
				return !hasAmount && !hasRisk
			}),
		).
		Return(&interfaces.RoutingDecision{}, errors.New("routing unavailable")).
		Once()

	wErr := httptest.NewRecorder()
	reqErr, _ := http.NewRequest(http.MethodGet, "/v1/routing/decision?amount=bad&risk_score=oops", nil)
	router.ServeHTTP(wErr, reqErr)

	assert.Equal(t, http.StatusInternalServerError, wErr.Code)

	var errBody ErrorResponse
	unmarshalErr := json.Unmarshal(wErr.Body.Bytes(), &errBody)
	assert.NoError(t, unmarshalErr)
	assert.Equal(t, "ROUTING_ERROR", errBody.ErrorCode)
}

func TestMutatingRoutes_RequireJSONContentType(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	intelligentRouter := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(fraudService, intelligentRouter)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBufferString(`{"transaction":{}}`))
	// Intentionally omit content-type to trigger middleware.
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnsupportedMediaType, w.Code)
}

func TestMutatingRoutes_EnforceRequestBodyLimit(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	intelligentRouter := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(fraudService, intelligentRouter)

	// Body larger than 1 MiB middleware limit.
	large := bytes.Repeat([]byte("a"), (1<<20)+1)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(large))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}
