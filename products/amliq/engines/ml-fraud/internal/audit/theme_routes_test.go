package audit

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRegisterThemeRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := NewInMemoryThemeStore()
	handler := NewThemeHandler(store)

	r := gin.New()
	group := r.Group("/api/v1/themes")
	RegisterThemeRoutes(group, handler)

	routes := r.Routes()
	expectedPaths := map[string]bool{
		"/api/v1/themes":              false,
		"/api/v1/themes/:id":          false,
		"/api/v1/themes/:id/activate": false,
		"/api/v1/themes/preview":      false,
	}

	for _, route := range routes {
		if _, ok := expectedPaths[route.Path]; ok {
			expectedPaths[route.Path] = true
		}
	}

	for path, found := range expectedPaths {
		assert.True(t, found, "route %s should be registered", path)
	}
}

func TestRegisterThemeRoutes_RequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := NewInMemoryThemeStore()
	handler := NewThemeHandler(store)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "tenant-1")
		c.Set("user_role", "admin")
		c.Next()
	})
	group := r.Group("/api/v1/themes")
	RegisterThemeRoutes(group, handler)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/themes", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestRegisterThemeRoutes_RBACSplit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := NewInMemoryThemeStore()
	handler := NewThemeHandler(store)

	// Viewer can read
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "tenant-1")
		c.Set("user_role", "viewer")
		c.Next()
	})
	group := r.Group("/api/v1/themes")
	RegisterThemeRoutes(group, handler)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/themes", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "viewer should be able to list themes")
}
