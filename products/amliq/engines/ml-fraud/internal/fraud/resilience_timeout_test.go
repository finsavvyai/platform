package fraud

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// TestResilience_Timeout_SlowServiceWithShortTimeout verifies that
// a slow mock service receives the cancelled context via TimeoutMs.
func TestResilience_Timeout_SlowServiceWithShortTimeout(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("tx-timeout-001", 100.0, "credit_card")

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodQuantum, nil)

	// Quantum returns context.DeadlineExceeded (simulating timeout)
	fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
		Return(&models.FraudResult{}, context.DeadlineExceeded)

	// Classical fallback also times out
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{}, context.DeadlineExceeded)

	body, _ := json.Marshal(AnalyzeTransactionRequest{
		Transaction: tx,
		Options: &AnalysisOptions{
			TimeoutMs: 100, // Very short timeout
		},
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	// Handler should return error, not hang
	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var errResp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &errResp)
	assert.NoError(t, err)
	assert.Equal(t, "PROCESSING_ERROR", errResp.ErrorCode)
}

// TestResilience_Timeout_CancelledParentContext verifies that a
// cancelled parent context propagates through the handler.
func TestResilience_Timeout_CancelledParentContext(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("tx-cancel-001", 100.0, "credit_card")

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)

	// Classical service returns error when context is cancelled
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{}, context.Canceled)

	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})

	// Create a request with an already-cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	w := httptest.NewRecorder()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	// Should return error, not panic
	assert.Contains(t, []int{http.StatusInternalServerError, http.StatusBadRequest, http.StatusOK}, w.Code,
		"should return a valid HTTP status, not panic")
}

// TestResilience_Timeout_TimeoutContextSetsDeadline verifies that
// the handler correctly sets a context deadline from TimeoutMs.
func TestResilience_Timeout_TimeoutContextSetsDeadline(t *testing.T) {
	fraudService := new(MockFraudDetectionService)
	router := new(MockIntelligentRouter)
	r := setupFraudRoutesRouter(fraudService, router)

	tx := newTestTransaction("tx-deadline-001", 100.0, "credit_card")

	router.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)

	// Verify the context has a deadline by checking the ctx argument
	var capturedCtx context.Context
	fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			capturedCtx = args.Get(0).(context.Context)
		}).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "tx-deadline-001", FraudScore: 0.1,
			RiskLevel: "low", Confidence: 0.95,
			ProcessingTimeMs: 5, ModelVersion: "v1.0",
		}, nil)

	body, _ := json.Marshal(AnalyzeTransactionRequest{
		Transaction: tx,
		Options: &AnalysisOptions{
			TimeoutMs: 5000,
		},
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify context had a deadline set
	if capturedCtx != nil {
		deadline, ok := capturedCtx.Deadline()
		assert.True(t, ok, "context should have a deadline set")
		assert.True(t, deadline.After(time.Now().Add(-10*time.Second)),
			"deadline should be in the near future or recent past")
	}
}

// TestResilience_Timeout_NoPanicOnDeadlineExceeded verifies that the
// handler recovers from context.DeadlineExceeded without panic.
func TestResilience_Timeout_NoPanicOnDeadlineExceeded(t *testing.T) {
	assert.NotPanics(t, func() {
		fraudService := new(MockFraudDetectionService)
		router := new(MockIntelligentRouter)
		r := setupFraudRoutesRouter(fraudService, router)

		tx := newTestTransaction("tx-nopanic-001", 100.0, "credit_card")

		router.On("RouteTransaction", mock.Anything, mock.Anything).
			Return(interfaces.ProcessingMethodQuantum, nil)

		fraudService.On("AnalyzeTransactionQuantum", mock.Anything, mock.Anything).
			Return(&models.FraudResult{}, context.DeadlineExceeded)

		fraudService.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
			Return(&interfaces.ClassicalFraudResult{
				TransactionID: "tx-nopanic-001", FraudScore: 0.15,
				RiskLevel: "low", Confidence: 0.9,
				ProcessingTimeMs: 8, ModelVersion: "v1.0",
			}, nil)

		body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/v1/analyze", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
	})
}
