package fraud

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// setupFuzzRouter creates a Gin router wired to mock services so that
// the handler can process arbitrary JSON without hitting real backends.
func setupFuzzRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	mockService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)

	mockRouter.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)

	mockService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID:    "fuzz-txn",
			FraudScore:       0.1,
			RiskLevel:        "low",
			Confidence:       0.9,
			ProcessingTimeMs: 5,
			ModelVersion:     "fuzz",
		}, nil)
	mockService.On("AnalyzeBatchQuantum", mock.Anything, mock.Anything).
		Return([]*models.FraudResult{}, nil)

	h := NewHandler(mockService, mockRouter)
	r := gin.New()
	r.POST("/v1/analyze", h.AnalyzeTransaction)
	r.POST("/v1/analyze/batch", h.AnalyzeBatch)
	return r
}

// FuzzAnalyzeTransactionJSON sends random JSON to the /v1/analyze
// endpoint to verify the handler never panics.
func FuzzAnalyzeTransactionJSON(f *testing.F) {
	// Seed with valid, empty, malicious, and edge-case payloads.
	seeds := []string{
		`{"transaction":{"transaction_id":"t1","amount":"100","timestamp":"2026-01-15T10:30:00Z","merchant_id":"m1","user_id":"u1","payment_method":"credit_card"}}`,
		`{}`,
		`{"transaction":null}`,
		`{"transaction":{}}`,
		`not json`,
		`{"transaction":{"transaction_id":"' OR 1=1 --","amount":"0","timestamp":"invalid","merchant_id":"","user_id":"","payment_method":"invalid"}}`,
		`{"transaction":{"transaction_id":"t","amount":"-1","timestamp":"2026-01-15T10:30:00Z","merchant_id":"m","user_id":"u","payment_method":"credit_card","location":{"latitude":999,"longitude":-999}}}`,
	}

	for _, s := range seeds {
		f.Add(s)
	}

	f.Fuzz(func(t *testing.T, body string) {
		router := setupFuzzRouter(t)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		// Must not panic regardless of input.
		router.ServeHTTP(w, req)

		// Any response is acceptable as long as it is a valid HTTP
		// status code (2xx or 4xx or 5xx). A 500 is not ideal but
		// the critical property is no panic.
		if w.Code < 100 || w.Code > 599 {
			t.Fatalf("unexpected HTTP status %d", w.Code)
		}
	})
}

// FuzzAnalyzeBatchJSON sends random JSON to the /v1/analyze/batch
// endpoint to verify the handler never panics.
func FuzzAnalyzeBatchJSON(f *testing.F) {
	seeds := []string{
		`{"transactions":[{"transaction_id":"t1","amount":"50","timestamp":"2026-01-15T10:30:00Z","merchant_id":"m1","user_id":"u1","payment_method":"credit_card"}]}`,
		`{}`,
		`{"transactions":null}`,
		`{"transactions":[]}`,
		`not json at all`,
	}

	for _, s := range seeds {
		f.Add(s)
	}

	f.Fuzz(func(t *testing.T, body string) {
		router := setupFuzzRouter(t)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/v1/analyze/batch", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code < 100 || w.Code > 599 {
			t.Fatalf("unexpected HTTP status %d", w.Code)
		}
	})
}

// FuzzTransactionRequestFields builds structured JSON with fuzzed
// field values to stress the validation layer.
func FuzzTransactionRequestFields(f *testing.F) {
	f.Add("txn-1", "100.00", "merch-1", "user-1", "credit_card", "desc")
	f.Add("", "0", "", "", "", "")
	f.Add("' OR 1=1", "-1", "'; DROP TABLE", "admin'--", "invalid", "\x00\x01")

	f.Fuzz(func(t *testing.T, txnID, amount, merchant, user, method, desc string) {
		m := map[string]interface{}{
			"transaction": map[string]interface{}{
				"transaction_id": txnID,
				"amount":         amount,
				"timestamp":      "2026-01-15T10:30:00Z",
				"merchant_id":    merchant,
				"user_id":        user,
				"payment_method": method,
				"description":    desc,
			},
		}
		body, err := json.Marshal(m)
		if err != nil {
			return
		}

		router := setupFuzzRouter(t)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(string(body)))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		if w.Code < 100 || w.Code > 599 {
			t.Fatalf("unexpected HTTP status %d", w.Code)
		}
	})
}
