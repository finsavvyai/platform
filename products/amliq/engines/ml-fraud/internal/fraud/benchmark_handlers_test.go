package fraud

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// benchSetupRouter returns a Gin engine with mocked services that return
// classical results for deterministic benchmarks.
func benchSetupRouter() (*MockFraudDetectionService, *MockIntelligentRouter) {
	svc := new(MockFraudDetectionService)
	rtr := new(MockIntelligentRouter)

	rtr.On("RouteTransaction", mock.Anything, mock.Anything).
		Return(interfaces.ProcessingMethodClassical, nil)
	rtr.On("GetRoutingDecision", mock.Anything, mock.Anything).
		Return(&interfaces.RoutingDecision{
			Method: interfaces.ProcessingMethodClassical, Confidence: 0.8,
		}, nil)
	svc.On("AnalyzeTransactionClassical", mock.Anything, mock.Anything).
		Return(&interfaces.ClassicalFraudResult{
			TransactionID: "bench", FraudScore: 0.1, RiskLevel: "low",
			Confidence: 0.9, ProcessingTimeMs: 5, ModelVersion: "v1",
		}, nil)

	return svc, rtr
}

func benchSingleBody() []byte {
	tx := newTestTransaction("bench-tx", 100.0, "credit_card")
	body, _ := json.Marshal(AnalyzeTransactionRequest{Transaction: tx})
	return body
}

func benchBatchBodyN(n int) []byte {
	txs := make([]*models.TransactionData, n)
	for i := range txs {
		txs[i] = newTestTransaction("bench-batch", 50.0, "debit_card")
	}
	body, _ := json.Marshal(AnalyzeBatchRequest{Transactions: txs})
	return body
}

func BenchmarkHandler_Analyze(b *testing.B) {
	svc, rtr := benchSetupRouter()
	router := setupFraudRoutesRouter(svc, rtr)
	body := benchSingleBody()

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/v1/analyze",
			bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", "bench-handler-single")
		router.ServeHTTP(w, req)
	}
}

func BenchmarkHandler_AnalyzeBatch10(b *testing.B) {
	svc, rtr := benchSetupRouter()
	router := setupFraudRoutesRouter(svc, rtr)
	body := benchBatchBodyN(10)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch",
			bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", "bench-handler-batch10")
		router.ServeHTTP(w, req)
	}
}

func BenchmarkHandler_AnalyzeBatch100(b *testing.B) {
	svc, rtr := benchSetupRouter()
	router := setupFraudRoutesRouter(svc, rtr)
	body := benchBatchBodyN(100)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/v1/analyze/batch",
			bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", "bench-handler-batch100")
		router.ServeHTTP(w, req)
	}
}

func BenchmarkHandler_RoutingDecision(b *testing.B) {
	svc, rtr := benchSetupRouter()
	router := setupFraudRoutesRouter(svc, rtr)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet,
			"/v1/routing/decision?amount=100&risk_score=0.5", nil)
		req.Header.Set("X-API-Key", "bench-handler-routing")
		router.ServeHTTP(w, req)
	}
}
