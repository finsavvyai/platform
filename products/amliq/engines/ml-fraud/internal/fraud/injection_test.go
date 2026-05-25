package fraud

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// sqlInjectionPayloads is a table of attack strings that must be
// safely handled (400 bad input or harmless processing, never 500).
var sqlInjectionPayloads = []struct {
	name    string
	payload string
}{
	{"basic OR 1=1", "' OR 1=1 --"},
	{"drop table", "'; DROP TABLE users; --"},
	{"union select", "1 UNION SELECT * FROM users"},
	{"bobby tables", "Robert'); DROP TABLE users;--"},
	{"comment injection", "admin'--"},
	{"hex encoded", "0x27206F722031003D31"},
	{"double dash", "test -- "},
	{"semicolon batch", "1; SELECT * FROM secrets"},
}

func setupInjectionRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	mockService := new(MockFraudDetectionService)
	mockRouter := new(MockIntelligentRouter)

	// Let the router always choose classical processing
	mockRouter.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)

	// The classical analysis succeeds with a safe result
	mockService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID:    "txn-1",
			FraudScore:       0.1,
			RiskLevel:        "low",
			Confidence:       0.9,
			ProcessingTimeMs: 5,
			ModelVersion:     "test",
		}, nil)
	mockService.On("AnalyzeBatchQuantum", mock.Anything, mock.Anything).
		Return([]*models.FraudResult{}, nil)

	h := NewHandler(mockService, mockRouter)
	r := gin.New()
	r.POST("/v1/analyze", h.AnalyzeTransaction)
	r.POST("/v1/analyze/batch", h.AnalyzeBatch)
	return r
}

func TestSQLInjection_TransactionID(t *testing.T) {
	router := setupInjectionRouter(t)

	for _, tc := range sqlInjectionPayloads {
		t.Run(tc.name, func(t *testing.T) {
			body := injectionAnalyzeRequest(tc.payload, "merch-1", "user-1")
			req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.NotEqual(t, http.StatusInternalServerError, w.Code,
				"SQL injection in transaction_id must not cause 500")
		})
	}
}

func TestSQLInjection_MerchantID(t *testing.T) {
	router := setupInjectionRouter(t)

	for _, tc := range sqlInjectionPayloads {
		t.Run(tc.name, func(t *testing.T) {
			body := injectionAnalyzeRequest("txn-safe", tc.payload, "user-1")
			req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.NotEqual(t, http.StatusInternalServerError, w.Code,
				"SQL injection in merchant_id must not cause 500")
		})
	}
}

func TestSQLInjection_UserID(t *testing.T) {
	router := setupInjectionRouter(t)

	for _, tc := range sqlInjectionPayloads {
		t.Run(tc.name, func(t *testing.T) {
			body := injectionAnalyzeRequest("txn-safe", "merch-1", tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.NotEqual(t, http.StatusInternalServerError, w.Code,
				"SQL injection in user_id must not cause 500")
		})
	}
}

func TestSQLInjection_Description(t *testing.T) {
	router := setupInjectionRouter(t)

	for _, tc := range sqlInjectionPayloads {
		t.Run(tc.name, func(t *testing.T) {
			body := injectionAnalyzeWithDesc("txn-1", "merch-1", "user-1", tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/v1/analyze", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.NotEqual(t, http.StatusInternalServerError, w.Code,
				"SQL injection in description must not cause 500")
		})
	}
}

func TestSQLInjection_BatchEndpoint(t *testing.T) {
	router := setupInjectionRouter(t)

	for _, tc := range sqlInjectionPayloads {
		t.Run(tc.name, func(t *testing.T) {
			body := injectionBatchRequest(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/v1/analyze/batch", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.NotEqual(t, http.StatusInternalServerError, w.Code,
				"SQL injection in batch must not cause 500")
		})
	}
}

// --- helpers ---

func injectionAnalyzeRequest(txnID, merchantID, userID string) string {
	m := map[string]interface{}{
		"transaction": map[string]interface{}{
			"transaction_id": txnID,
			"amount":         "100.00",
			"timestamp":      "2026-01-15T10:30:00Z",
			"merchant_id":    merchantID,
			"user_id":        userID,
			"payment_method": "credit_card",
		},
	}
	b, _ := json.Marshal(m)
	return string(b)
}

func injectionAnalyzeWithDesc(txnID, merchantID, userID, desc string) string {
	m := map[string]interface{}{
		"transaction": map[string]interface{}{
			"transaction_id": txnID,
			"amount":         "100.00",
			"timestamp":      "2026-01-15T10:30:00Z",
			"merchant_id":    merchantID,
			"user_id":        userID,
			"payment_method": "credit_card",
			"description":    desc,
		},
	}
	b, _ := json.Marshal(m)
	return string(b)
}

func injectionBatchRequest(txnID string) string {
	m := map[string]interface{}{
		"transactions": []map[string]interface{}{{
			"transaction_id": txnID,
			"amount":         "50.00",
			"timestamp":      "2026-01-15T10:30:00Z",
			"merchant_id":    "merch-1",
			"user_id":        "user-1",
			"payment_method": "credit_card",
		}},
	}
	b, _ := json.Marshal(m)
	return string(b)
}
