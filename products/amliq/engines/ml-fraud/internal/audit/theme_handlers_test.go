package audit

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupThemeRouter() (*gin.Engine, *ThemeHandler) {
	gin.SetMode(gin.TestMode)
	store := NewInMemoryThemeStore()
	handler := NewThemeHandler(store)
	r := gin.New()
	g := r.Group("/api/v1/themes")
	g.POST("", handler.CreateTheme)
	g.GET("", handler.ListThemes)
	g.GET("/:id", handler.GetTheme)
	g.PUT("/:id", handler.UpdateTheme)
	g.DELETE("/:id", handler.DeleteTheme)
	g.POST("/:id/activate", handler.ActivateTheme)
	g.POST("/preview", handler.PreviewTheme)
	return r, handler
}

func adminContext(c *gin.Context) {
	c.Set("user_id", "tenant-1")
	c.Set("user_role", "admin")
}

func themeJSON() []byte {
	t := validTheme()
	data, _ := json.Marshal(t)
	return data
}

func TestThemeHandler_CreateTheme(t *testing.T) {
	r, _ := setupThemeRouter()

	t.Run("admin can create theme", func(t *testing.T) {
		r := gin.New()
		store := NewInMemoryThemeStore()
		h := NewThemeHandler(store)
		r.Use(func(c *gin.Context) { adminContext(c); c.Next() })
		r.POST("/api/v1/themes", h.CreateTheme)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/themes", bytes.NewReader(themeJSON()))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusCreated, w.Code)
	})

	t.Run("non-admin is forbidden", func(t *testing.T) {
		routerWithViewer := gin.New()
		store := NewInMemoryThemeStore()
		h := NewThemeHandler(store)
		routerWithViewer.Use(func(c *gin.Context) {
			c.Set("user_id", "tenant-1")
			c.Set("user_role", "viewer")
			c.Next()
		})
		routerWithViewer.POST("/api/v1/themes", h.CreateTheme)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/themes", bytes.NewReader(themeJSON()))
		req.Header.Set("Content-Type", "application/json")
		routerWithViewer.ServeHTTP(w, req)
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	_ = r // silence unused
}

func TestThemeHandler_ListThemes(t *testing.T) {
	r := gin.New()
	store := NewInMemoryThemeStore()
	h := NewThemeHandler(store)
	r.Use(func(c *gin.Context) { adminContext(c); c.Next() })
	r.POST("/api/v1/themes", h.CreateTheme)
	r.GET("/api/v1/themes", h.ListThemes)

	// Create a theme first
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/themes", bytes.NewReader(themeJSON()))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// List themes
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/v1/themes", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, float64(1), body["count"])
}

func TestThemeHandler_GetTheme_NotFound(t *testing.T) {
	r := gin.New()
	store := NewInMemoryThemeStore()
	h := NewThemeHandler(store)
	r.Use(func(c *gin.Context) { adminContext(c); c.Next() })
	r.GET("/api/v1/themes/:id", h.GetTheme)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/themes/nonexistent", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestThemeHandler_DeleteActive_Conflict(t *testing.T) {
	r := gin.New()
	store := NewInMemoryThemeStore()
	h := NewThemeHandler(store)
	r.Use(func(c *gin.Context) { adminContext(c); c.Next() })
	r.POST("/api/v1/themes", h.CreateTheme)
	r.POST("/api/v1/themes/:id/activate", h.ActivateTheme)
	r.DELETE("/api/v1/themes/:id", h.DeleteTheme)

	// Create
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/themes", bytes.NewReader(themeJSON()))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var createResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &createResp)
	themeMap := createResp["theme"].(map[string]interface{})
	themeID := themeMap["id"].(string)

	// Activate
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/v1/themes/"+themeID+"/activate", nil)
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	// Try to delete active
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/v1/themes/"+themeID, nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestThemeHandler_PreviewTheme(t *testing.T) {
	r := gin.New()
	store := NewInMemoryThemeStore()
	h := NewThemeHandler(store)
	r.POST("/api/v1/themes/preview", h.PreviewTheme)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/themes/preview", bytes.NewReader(themeJSON()))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.NotNil(t, body["contrast_results"])
}
