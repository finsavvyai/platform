package fraud

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func setupPatternRoutesRouter(svc PatternSharingService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")
	RegisterPatternRoutes(v1, svc)
	return r
}

func TestRegisterPatternRoutes_RegistersExpectedPaths(t *testing.T) {
	svc := new(MockPatternSharingService)
	router := setupPatternRoutesRouter(svc)

	registered := map[string]bool{}
	for _, route := range router.Routes() {
		registered[route.Method+" "+route.Path] = true
	}

	assert.True(t, registered["GET /v1/patterns/aggregate"])
	assert.True(t, registered["POST /v1/patterns/contribute"])
	assert.True(t, registered["GET /v1/patterns/config"])
	assert.True(t, registered["PUT /v1/patterns/config"])
	assert.True(t, registered["GET /v1/patterns/stats"])
}

func TestPatternRoutes_RequestIDMiddleware(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("GetAggregateStats").Return(&AggregatePatternStats{TotalPatterns: 1}, nil)

	router := setupPatternRoutesRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/stats", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestPatternRoutes_WriteRequiresJSON(t *testing.T) {
	svc := new(MockPatternSharingService)
	router := setupPatternRoutesRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/patterns/contribute", nil)
	// No content-type set
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnsupportedMediaType, w.Code)
}
