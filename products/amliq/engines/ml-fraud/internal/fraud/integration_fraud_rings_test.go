package fraud

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/models"
)

func newFraudRingTransactions(count int) []*models.TransactionData {
	txns := make([]*models.TransactionData, count)
	now := time.Now()
	for i := range count {
		txns[i] = &models.TransactionData{
			TransactionID: "fr-" + string(rune('A'+i)),
			Amount:        decimal.NewFromFloat(100.0 + float64(i)*50),
			Timestamp:     now.Add(-time.Duration(i) * time.Hour),
			MerchantID:    "merchant_" + string(rune('A'+(i%3))),
			UserID:        "user_" + string(rune('A'+(i%4))),
			PaymentMethod: "credit_card",
			Features:      map[string]float64{"risk_indicator": 0.5},
		}
	}
	return txns
}

// TestIntegration_FraudRings_ValidRequest verifies 200 with graph stats.
func TestIntegration_FraudRings_ValidRequest(t *testing.T) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(svc, rtr)

	txns := newFraudRingTransactions(5)
	body, _ := json.Marshal(DetectFraudRingsRequest{Transactions: txns})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/fraud-rings/detect", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	var resp DetectFraudRingsResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotNil(t, resp.Result)
	assert.NotNil(t, resp.GraphStats)
	assert.NotEmpty(t, resp.RequestID)
	assert.Greater(t, resp.GraphStats.NodeCount, 0)
	assert.Greater(t, resp.GraphStats.UserCount, 0)
	assert.Greater(t, resp.GraphStats.MerchantCount, 0)
}

// TestIntegration_FraudRings_ReversedTimeWindow verifies 400 for end < start.
func TestIntegration_FraudRings_ReversedTimeWindow(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	now := time.Now()
	txns := newFraudRingTransactions(3)
	body, _ := json.Marshal(DetectFraudRingsRequest{
		Transactions: txns,
		TimeWindow: &TimeWindowRequest{
			Start: now,
			End:   now.Add(-24 * time.Hour), // reversed
		},
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/fraud-rings/detect", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var errResp ErrorResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &errResp))
	assert.Equal(t, "INVALID_TIME_WINDOW", errResp.ErrorCode)
}

// TestIntegration_FraudRings_CustomOptions verifies options propagation.
func TestIntegration_FraudRings_CustomOptions(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	txns := newFraudRingTransactions(5)
	body, _ := json.Marshal(DetectFraudRingsRequest{
		Transactions: txns,
		Options: &FraudRingOptions{
			MinRingSize:    3,
			FraudThreshold: 0.7,
			EnableQuantum:  true,
		},
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/fraud-rings/detect", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp DetectFraudRingsResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "quantum_enhanced", resp.ProcessingMethod)
}

// TestIntegration_FraudRings_GraphStatsFields verifies all graph stat fields.
func TestIntegration_FraudRings_GraphStatsFields(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))

	txns := newFraudRingTransactions(6)
	body, _ := json.Marshal(DetectFraudRingsRequest{Transactions: txns})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/fraud-rings/detect", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var raw map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))

	gs, ok := raw["graph_stats"].(map[string]interface{})
	assert.True(t, ok)
	assert.Contains(t, gs, "node_count")
	assert.Contains(t, gs, "edge_count")
	assert.Contains(t, gs, "user_count")
	assert.Contains(t, gs, "merchant_count")
	assert.Contains(t, gs, "transaction_count")
	assert.Contains(t, gs, "average_connectivity")
}

// TestIntegration_FraudRings_EmptyTransactions verifies 400 for empty tx list.
func TestIntegration_FraudRings_EmptyTransactions(t *testing.T) {
	r := setupFraudRoutesRouter(new(MockFraudDetectionService), new(MockIntelligentRouter))
	body, _ := json.Marshal(DetectFraudRingsRequest{
		Transactions: []*models.TransactionData{},
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/fraud-rings/detect", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
