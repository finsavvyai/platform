package fraud

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/interfaces"
)

// newIntegrationGraphRouter creates a Gin engine with real graph routes.
func newIntegrationGraphRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	graph := &TransactionGraph{
		Users: map[string]*UserNode{
			"user_A": {RiskScore: 0.6, TransactionCount: 5, TotalAmount: 500, Connections: []string{"merchant_X"}},
			"user_B": {RiskScore: 0.4, TransactionCount: 3, TotalAmount: 300, Connections: []string{"merchant_X"}},
			"user_C": {RiskScore: 0.7, TransactionCount: 7, TotalAmount: 800, Connections: []string{"merchant_X"}},
		},
		Merchants: map[string]*MerchantNode{
			"merchant_X": {RiskScore: 0.8, TransactionCount: 15, TotalAmount: 5000, Connections: []string{"user_A", "user_B", "user_C"}},
		},
		Edges: []*TransactionEdge{
			{Source: "user_A", Target: "merchant_X", Weight: 3, EdgeType: "transaction"},
			{Source: "user_B", Target: "merchant_X", Weight: 2, EdgeType: "transaction"},
			{Source: "user_C", Target: "merchant_X", Weight: 4, EdgeType: "refund"},
		},
	}
	result := &interfaces.QuantumCommunityResult{
		Communities: []interfaces.Community{
			{ID: "comm-1", Members: []string{"user_A", "user_B"}, FraudScore: 0.7, RiskLevel: "high"},
		},
		FraudRings: []interfaces.FraudRing{
			{RingID: "ring-1", Members: []string{"user_A", "user_C"}, ConfidenceScore: 0.85,
				TransactionCount: 10, TotalAmount: 2500, DetectionMethod: "louvain"},
		},
	}
	repo := NewInMemoryGraphRepository(result, graph)
	v1 := router.Group("/v1")
	RegisterGraphRoutes(v1, repo)
	return router
}

// TestIntegration_Graph_QueryReturnsNodesEdges verifies full graph query.
func TestIntegration_Graph_QueryReturnsNodesEdges(t *testing.T) {
	r := newIntegrationGraphRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
	var resp GraphQueryResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.GreaterOrEqual(t, len(resp.Nodes), 4)
	assert.GreaterOrEqual(t, len(resp.Edges), 3)
	assert.Len(t, resp.Communities, 1)
	assert.Len(t, resp.FraudRings, 1)
	assert.NotNil(t, resp.Stats)
}

// TestIntegration_Graph_StatsEndpoint verifies /stats returns aggregates.
func TestIntegration_Graph_StatsEndpoint(t *testing.T) {
	r := newIntegrationGraphRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/stats?tenant_id=t1", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "stats")
	assert.Contains(t, body, "request_id")
}

// TestIntegration_Graph_NodeDetailOK verifies existing node lookup.
func TestIntegration_Graph_NodeDetailOK(t *testing.T) {
	r := newIntegrationGraphRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/nodes/user_A?tenant_id=t1", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "node")
}

// TestIntegration_Graph_NodeDetailNotFound verifies missing node returns 404.
func TestIntegration_Graph_NodeDetailNotFound(t *testing.T) {
	r := newIntegrationGraphRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/nodes/bogus?tenant_id=t1", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// TestIntegration_Graph_CommunityDetailOK verifies community lookup.
func TestIntegration_Graph_CommunityDetailOK(t *testing.T) {
	r := newIntegrationGraphRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/communities/comm-1?tenant_id=t1", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "community")
}

// TestIntegration_Graph_MissingTenantBadRequest verifies validation.
func TestIntegration_Graph_MissingTenantBadRequest(t *testing.T) {
	r := newIntegrationGraphRouter()
	paths := []string{
		"/v1/fraud-rings/graph",
		"/v1/fraud-rings/graph/stats",
		"/v1/fraud-rings/graph/nodes/user_A",
		"/v1/fraud-rings/graph/communities/comm-1",
	}
	for _, path := range paths {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, path, nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code, "expected 400 for %s", path)
	}
}

// TestIntegration_Graph_PaginationLimitsNodes verifies offset/limit.
func TestIntegration_Graph_PaginationLimitsNodes(t *testing.T) {
	r := newIntegrationGraphRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph?tenant_id=t1&offset=0&limit=2", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var resp GraphQueryResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.LessOrEqual(t, len(resp.Nodes), 2)
}
