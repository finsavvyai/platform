package fraud

import (
	"bytes"
	"encoding/json"
	"errors"
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

// verifyErrorContract checks that an error body conforms to the ErrorResponse
// contract: error_code, message, timestamp (RFC3339), request_id, and an
// optional details map. No unexpected top-level fields are allowed.
func verifyErrorContract(t *testing.T, body []byte, expectedCode string, w *httptest.ResponseRecorder) {
	t.Helper()

	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(body, &raw))

	// Required fields present
	assert.Contains(t, raw, "error_code")
	assert.Contains(t, raw, "message")
	assert.Contains(t, raw, "timestamp")
	assert.Contains(t, raw, "request_id")

	// Type assertions
	assert.IsType(t, "", raw["error_code"])
	assert.IsType(t, "", raw["message"])
	assert.IsType(t, "", raw["timestamp"])
	assert.IsType(t, "", raw["request_id"])

	// error_code matches expected
	assert.Equal(t, expectedCode, raw["error_code"])

	// timestamp is valid RFC3339
	_, err := time.Parse(time.RFC3339Nano, raw["timestamp"].(string))
	assert.NoError(t, err, "timestamp must be ISO 8601 / RFC3339")

	// request_id matches X-Request-ID header
	assert.Equal(t, raw["request_id"], w.Header().Get("X-Request-ID"))

	// Only allowed top-level keys
	for key := range raw {
		assert.Contains(t, []string{"error_code", "message", "timestamp", "request_id", "details"}, key,
			"unexpected field %q in error response", key)
	}
}

func TestContract_ErrorFormat_400_InvalidRequest(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBufferString(`{bad json`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	verifyErrorContract(t, w.Body.Bytes(), "INVALID_REQUEST", w)
}

func TestContract_ErrorFormat_400_ValidationError(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	// Missing required transaction field
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	verifyErrorContract(t, w.Body.Bytes(), "VALIDATION_ERROR", w)
}

func TestContract_ErrorFormat_413_BodyTooLarge(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	large := bytes.Repeat([]byte("a"), (1<<20)+1)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(large))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
	// Middleware-level 413 uses gin.H, verify JSON is parseable
	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
	assert.Contains(t, raw, "error")
}

func TestContract_ErrorFormat_415_UnsupportedMediaType(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBufferString(`{}`))
	// No Content-Type header
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnsupportedMediaType, w.Code)
	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
	assert.Contains(t, raw, "error")
}

func TestContract_ErrorFormat_429_RateLimitExceeded(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	apiKey := "contract-rate-test-" + time.Now().Format("150405.000")
	// Exhaust rate limit (120 rpm for mutating endpoints)
	for i := 0; i < 121; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBufferString(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", apiKey)
		router.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			var raw map[string]interface{}
			assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
			assert.Contains(t, raw, "error")
			assert.Equal(t, "rate limit exceeded", raw["error"])
			// Rate limit headers present
			assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
			assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))
			return
		}
	}
	t.Fatal("expected 429 but never received it")
}

func TestContract_ErrorFormat_500_ProcessingError(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	router := setupFraudRoutesRouter(svc, rtr)

	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)
	svc.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return((*models.FraudResult)(nil), errors.New("quantum fail"))
	svc.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return((*interfaces.ClassicalFraudResult)(nil), errors.New("classical fail"))

	tx := newTestTransaction("txn-contract", 100.00, "credit_card")
	txJSON, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(txJSON))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	verifyErrorContract(t, w.Body.Bytes(), "PROCESSING_ERROR", w)
}

// TestContract_ErrorFormat_SnakeCase verifies all field names use snake_case.
func TestContract_ErrorFormat_SnakeCase(t *testing.T) {
	router := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBufferString(`{bad`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
	for key := range raw {
		assert.Equal(t, strings.ToLower(key), key, "field %q is not lowercase", key)
		assert.NotContains(t, key, "-", "field %q uses hyphens instead of underscores", key)
	}
}
