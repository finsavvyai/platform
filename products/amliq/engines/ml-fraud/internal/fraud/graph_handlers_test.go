package fraud

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockGraphRepository mocks the GraphRepository interface.
type MockGraphRepository struct {
	mock.Mock
}

func (m *MockGraphRepository) QueryGraph(req *GraphQueryRequest) (*GraphQueryResponse, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*GraphQueryResponse), args.Error(1)
}

func (m *MockGraphRepository) GetGraphStatistics(tenantID string) (*GraphStats, error) {
	args := m.Called(tenantID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*GraphStats), args.Error(1)
}

func (m *MockGraphRepository) GetNodeDetail(tenantID, nodeID string) (*GraphNode, error) {
	args := m.Called(tenantID, nodeID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*GraphNode), args.Error(1)
}

func (m *MockGraphRepository) GetCommunityDetail(tenantID, communityID string) (*GraphCommunity, error) {
	args := m.Called(tenantID, communityID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*GraphCommunity), args.Error(1)
}

func setupGraphRouter(repo GraphRepository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewGraphHandler(repo)
	g := r.Group("/v1/fraud-rings/graph")
	g.GET("", h.QueryGraph)
	g.GET("/stats", h.GetGraphStats)
	g.GET("/nodes/:id", h.GetNodeDetail)
	g.GET("/communities/:id", h.GetCommunityDetail)
	return r
}

func TestQueryGraph_Success(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("QueryGraph", mock.Anything).Return(&GraphQueryResponse{
		Nodes: []GraphNode{{ID: "n1", Type: "user"}},
		Stats: &GraphStats{NodeCount: 1},
	}, nil)

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))

	var body GraphQueryResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Len(t, body.Nodes, 1)
}

func TestQueryGraph_MissingTenant(t *testing.T) {
	r := setupGraphRouter(new(MockGraphRepository))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var body ErrorResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "MISSING_TENANT", body.ErrorCode)
}

func TestQueryGraph_RepoError(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("QueryGraph", mock.Anything).Return(nil, fmt.Errorf("bad query"))

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetGraphStats_Success(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("GetGraphStatistics", "t1").Return(&GraphStats{NodeCount: 5, EdgeCount: 10}, nil)

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/stats?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestGetGraphStats_MissingTenant(t *testing.T) {
	r := setupGraphRouter(new(MockGraphRepository))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/stats", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetNodeDetail_Success(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("GetNodeDetail", "t1", "user_1").Return(
		&GraphNode{ID: "user_1", Type: "user", RiskScore: 0.8}, nil)

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/nodes/user_1?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGetNodeDetail_NotFound(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("GetNodeDetail", "t1", "missing").Return(nil, fmt.Errorf("not found"))

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/nodes/missing?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetNodeDetail_MissingTenant(t *testing.T) {
	r := setupGraphRouter(new(MockGraphRepository))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/nodes/user_1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetCommunityDetail_Success(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("GetCommunityDetail", "t1", "c_0").Return(
		&GraphCommunity{ID: "c_0", Members: []string{"u1", "u2"}, FraudScore: 0.7}, nil)

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/communities/c_0?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGetCommunityDetail_NotFound(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("GetCommunityDetail", "t1", "nope").Return(nil, fmt.Errorf("not found"))

	r := setupGraphRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/communities/nope?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
