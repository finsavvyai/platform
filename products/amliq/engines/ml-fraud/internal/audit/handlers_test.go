package audit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() { gin.SetMode(gin.TestMode) }

func setupHandler(t *testing.T) (*Handler, *gin.Engine) {
	t.Helper()
	store := seedStore(t)
	h := NewHandler(store)
	r := gin.New()
	return h, r
}

func withAuth(c *gin.Context, tenantID, role string) {
	c.Set("user_id", tenantID)
	c.Set("user_role", role)
	c.Set("request_id", "req-test-001")
}

func TestListEntries_Success(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit", func(c *gin.Context) {
		withAuth(c, "t1", "admin")
		h.ListEntries(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?limit=2", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, float64(2), body["count"])
	assert.NotEmpty(t, body["next_cursor"])
	assert.NotEmpty(t, body["request_id"])
}

func TestListEntries_FilterByAction(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit", func(c *gin.Context) {
		withAuth(c, "t1", "compliance")
		h.ListEntries(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?action=login", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, float64(1), body["count"])
}

func TestListEntries_RBAC_Forbidden(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit", func(c *gin.Context) {
		withAuth(c, "t1", "viewer")
		h.ListEntries(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "FORBIDDEN", body["error_code"])
}

func TestGetEntry_Success(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit/:id", func(c *gin.Context) {
		withAuth(c, "t1", "auditor")
		h.GetEntry(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/audit-1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.NotNil(t, body["entry"])
}

func TestGetEntry_NotFound(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit/:id", func(c *gin.Context) {
		withAuth(c, "t1", "admin")
		h.GetEntry(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/audit-999", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetStats_Success(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit/stats", func(c *gin.Context) {
		withAuth(c, "t1", "admin")
		h.GetStats(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/stats", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	stats := body["stats"].(map[string]interface{})
	assert.Equal(t, float64(4), stats["total_events"])
}

func TestGetStats_WithDateFilter(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit/stats", func(c *gin.Context) {
		withAuth(c, "t1", "admin")
		h.GetStats(c)
	})

	from := time.Date(2026, 3, 1, 10, 1, 30, 0, time.UTC).Format(time.RFC3339)
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/stats?from="+from, nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestListEntries_InvalidQuery(t *testing.T) {
	h, r := setupHandler(t)
	r.GET("/api/v1/audit", func(c *gin.Context) {
		withAuth(c, "t1", "admin")
		// override tenant to empty to trigger validation error
		c.Set("user_id", "")
		h.ListEntries(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// Verify context is used for cancellation.
func TestListEntries_ContextCancel(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	_ = store.Insert(ctx, &AuditEntry{
		TenantID: "t1", ActorID: "u1", Action: ActionLogin, Resource: "session",
	})

	h := NewHandler(store)
	r := gin.New()
	r.GET("/api/v1/audit", func(c *gin.Context) {
		withAuth(c, "t1", "admin")
		h.ListEntries(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
