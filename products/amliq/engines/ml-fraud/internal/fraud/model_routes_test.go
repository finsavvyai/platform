package fraud

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRegisterModelRoutes_RoutesRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")

	repo := NewInMemoryModelRepository()
	abSvc := NewInMemoryABTestService(repo)

	RegisterModelRoutes(v1, repo, abSvc)

	routes := r.Routes()
	expectedPaths := map[string]string{
		"GET:/v1/models":              "list models",
		"GET:/v1/models/compare":      "compare models",
		"GET:/v1/models/:id":          "get model",
		"POST:/v1/models":             "create model",
		"PUT:/v1/models/:id/status":   "update status",
		"GET:/v1/models/abtest/active": "get active test",
		"POST:/v1/models/abtest":       "create test",
		"POST:/v1/models/abtest/stop":  "stop test",
	}

	registered := make(map[string]bool)
	for _, route := range routes {
		key := route.Method + ":" + route.Path
		registered[key] = true
	}

	for path, desc := range expectedPaths {
		assert.True(t, registered[path], "route not registered: %s (%s)", path, desc)
	}
}

func TestRegisterModelRoutes_RequestIDMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")

	repo := NewInMemoryModelRepository()
	abSvc := NewInMemoryABTestService(repo)
	RegisterModelRoutes(v1, repo, abSvc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models", nil)
	r.ServeHTTP(w, req)

	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestRegisterModelRoutes_RateLimitHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")

	repo := NewInMemoryModelRepository()
	abSvc := NewInMemoryABTestService(repo)
	RegisterModelRoutes(v1, repo, abSvc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models", nil)
	r.ServeHTTP(w, req)

	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
}
