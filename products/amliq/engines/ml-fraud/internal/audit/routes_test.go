package audit

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRegisterRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := NewMemoryStore()
	handler := NewHandler(store)

	router := gin.New()
	group := router.Group("/api/v1/audit")
	RegisterRoutes(group, handler)

	routes := router.Routes()

	// Collect registered paths
	registered := make(map[string]bool)
	for _, r := range routes {
		registered[r.Method+":"+r.Path] = true
	}

	// Gin groups register with trailing slash when using GET ""
	assert.True(t, registered["GET:/api/v1/audit/"] || registered["GET:/api/v1/audit"],
		"list route should be registered")
	assert.True(t, registered["GET:/api/v1/audit/stats"] || registered["GET:/api/v1/audit/stats/"],
		"stats route should be registered")
	assert.True(t, registered["GET:/api/v1/audit/:id"],
		"detail route should be registered")
}

func TestRoutes_MiddlewareChain(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := NewMemoryStore()
	handler := NewHandler(store)

	router := gin.New()

	// Mock auth middleware sets user context
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "t1")
		c.Set("user_role", "admin")
		c.Next()
	})

	group := router.Group("/api/v1/audit")
	RegisterRoutes(group, handler)

	// Use the stats endpoint which has a concrete path
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/stats", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
