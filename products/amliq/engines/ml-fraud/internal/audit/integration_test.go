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

// Integration tests exercise the full audit log pipeline:
// insert entries -> query with filters -> verify pagination -> verify stats.

func setupIntegrationRouter(t *testing.T) (*gin.Engine, *MemoryStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	store := NewMemoryStore()
	h := NewHandler(store)
	r := gin.New()
	api := r.Group("/api/v1/audit")
	api.Use(func(c *gin.Context) {
		c.Set("user_id", "tenant-int")
		c.Set("user_role", "admin")
		c.Set("request_id", "req-int-001")
		c.Next()
	})
	api.GET("", h.ListEntries)
	api.GET("/stats", h.GetStats)
	api.GET("/:id", h.GetEntry)
	return r, store
}

func seedIntegrationData(t *testing.T, store *MemoryStore) {
	t.Helper()
	ctx := context.Background()
	base := time.Date(2026, 7, 10, 8, 0, 0, 0, time.UTC)
	entries := []AuditEntry{
		{TenantID: "tenant-int", ActorID: "admin-1", ActorRole: "admin", Action: ActionLogin, Resource: "session", Details: map[string]string{"browser": "Chrome"}, IPAddress: "10.0.0.1", Timestamp: base},
		{TenantID: "tenant-int", ActorID: "admin-1", ActorRole: "admin", Action: ActionRuleCreate, Resource: "rules", Details: map[string]string{"name": "velocity"}, IPAddress: "10.0.0.1", Timestamp: base.Add(time.Minute)},
		{TenantID: "tenant-int", ActorID: "auditor-2", ActorRole: "auditor", Action: ActionTransactionScan, Resource: "transactions", Details: map[string]string{"txn": "tx-200"}, IPAddress: "10.0.0.2", Timestamp: base.Add(2 * time.Minute)},
		{TenantID: "tenant-int", ActorID: "admin-1", ActorRole: "admin", Action: ActionConfigUpdate, Resource: "config", Details: map[string]string{"key": "threshold"}, IPAddress: "10.0.0.1", Timestamp: base.Add(3 * time.Minute)},
		{TenantID: "tenant-int", ActorID: "auditor-2", ActorRole: "auditor", Action: ActionLogin, Resource: "session", Details: map[string]string{"browser": "Firefox"}, IPAddress: "10.0.0.2", Timestamp: base.Add(4 * time.Minute)},
		{TenantID: "other-tenant", ActorID: "other-1", ActorRole: "admin", Action: ActionLogin, Resource: "session", Details: map[string]string{}, IPAddress: "10.0.1.1", Timestamp: base.Add(5 * time.Minute)},
	}
	for i := range entries {
		require.NoError(t, store.Insert(ctx, &entries[i]))
	}
}

func TestIntegration_InsertQueryFilterPaginateStats(t *testing.T) {
	r, store := setupIntegrationRouter(t)
	seedIntegrationData(t, store)

	t.Run("list all entries for tenant", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?limit=100", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, float64(5), body["count"])
	})

	t.Run("filter by action type", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?action=login", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, float64(2), body["count"])
	})

	t.Run("filter by actor", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?actor=auditor-2", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, float64(2), body["count"])
	})

	t.Run("keyword search across details", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?q=velocity", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		assert.Equal(t, float64(1), body["count"])
	})

	t.Run("pagination walks all entries", func(t *testing.T) {
		var allEntries []interface{}
		cursor := ""
		for pages := 0; pages < 10; pages++ {
			url := "/api/v1/audit?limit=2"
			if cursor != "" {
				url += "&cursor=" + cursor
			}
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, url, nil)
			r.ServeHTTP(w, req)
			assert.Equal(t, http.StatusOK, w.Code)
			var body map[string]interface{}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
			entries := body["entries"].([]interface{})
			allEntries = append(allEntries, entries...)
			next, _ := body["next_cursor"].(string)
			if next == "" {
				break
			}
			cursor = next
		}
		assert.Len(t, allEntries, 5, "all tenant entries returned via pagination")
	})

	t.Run("get single entry by ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/audit-1", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		entry := body["entry"].(map[string]interface{})
		assert.Equal(t, "tenant-int", entry["tenant_id"])
	})

	t.Run("stats reflect correct aggregation", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/stats", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		stats := body["stats"].(map[string]interface{})
		assert.Equal(t, float64(5), stats["total_events"])
		assert.Equal(t, float64(2), stats["unique_actors"])
	})

	t.Run("date range filter narrows stats", func(t *testing.T) {
		from := time.Date(2026, 7, 10, 8, 1, 30, 0, time.UTC).Format(time.RFC3339)
		to := time.Date(2026, 7, 10, 8, 3, 30, 0, time.UTC).Format(time.RFC3339)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/stats?from="+from+"&to="+to, nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		stats := body["stats"].(map[string]interface{})
		assert.Equal(t, float64(2), stats["total_events"])
	})

	t.Run("tenant isolation excludes other tenant", func(t *testing.T) {
		// other-tenant entry (audit-6) should not appear
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/audit/audit-6", nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}
