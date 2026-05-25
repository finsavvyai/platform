package fraud

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func setupGraphRoutesRouter(repo GraphRepository) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")
	RegisterGraphRoutes(v1, repo)
	return r
}

func TestRegisterGraphRoutes_RegistersExpectedPaths(t *testing.T) {
	repo := new(MockGraphRepository)
	router := setupGraphRoutesRouter(repo)

	registered := map[string]bool{}
	for _, route := range router.Routes() {
		registered[route.Method+" "+route.Path] = true
	}

	assert.True(t, registered["GET /v1/fraud-rings/graph"])
	assert.True(t, registered["GET /v1/fraud-rings/graph/stats"])
	assert.True(t, registered["GET /v1/fraud-rings/graph/nodes/:id"])
	assert.True(t, registered["GET /v1/fraud-rings/graph/communities/:id"])
}

func TestGraphRoutes_RequestIDMiddlewareApplied(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("GetGraphStatistics", "t1").Return(&GraphStats{NodeCount: 1}, nil)

	router := setupGraphRoutesRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph/stats?tenant_id=t1", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestGraphRoutes_RateLimitHeadersPresent(t *testing.T) {
	repo := new(MockGraphRepository)
	repo.On("QueryGraph", mock.Anything).Return(&GraphQueryResponse{
		Nodes: []GraphNode{},
		Stats: &GraphStats{},
	}, nil)

	router := setupGraphRoutesRouter(repo)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/fraud-rings/graph?tenant_id=t1", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
}
