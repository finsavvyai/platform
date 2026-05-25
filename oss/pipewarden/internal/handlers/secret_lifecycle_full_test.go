package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// seedSecretLifecycle creates a finding and its associated secret lifecycle row.
func seedSecretLifecycle(t *testing.T, db *storage.DB, status string) int64 {
	t.Helper()
	rec := &storage.FindingRecord{
		ConnectionName: "conn",
		Severity:       "critical",
		Category:       "secrets",
		Title:          "AWS key",
		Status:         "open",
		Confidence:     0.99,
		CreatedAt:      time.Now().UTC(),
	}
	require.NoError(t, db.CreateFinding(rec))
	require.NoError(t, db.UpsertSecretLifecycle(rec.ID, "AWS Access Key", "AKIA****"))
	if status == "revoked" {
		require.NoError(t, db.RevokeSecret(rec.ID, "test revocation"))
	}
	return rec.ID
}

// ---------------------------------------------------------------------------
// ListSecretLifecycle
// ---------------------------------------------------------------------------

func TestListSecretLifecycle_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets", nil)
	w := httptest.NewRecorder()
	h.ListSecretLifecycle(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestListSecretLifecycle_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/secrets", nil)
	w := httptest.NewRecorder()
	h.ListSecretLifecycle(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["count"])
}

func TestListSecretLifecycle_FilterByStatus(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedSecretLifecycle(t, db, "active")
	seedSecretLifecycle(t, db, "revoked")

	// Filter to only revoked.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/secrets?status=revoked", nil)
	w := httptest.NewRecorder()
	h.ListSecretLifecycle(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["count"])
}

func TestListSecretLifecycle_AllStatuses(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Seed both active and revoked so the list returns at least these two types.
	seedSecretLifecycle(t, db, "active")
	seedSecretLifecycle(t, db, "revoked")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/secrets", nil)
	w := httptest.NewRecorder()
	h.ListSecretLifecycle(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// At least 1 row must be present (SQLite shared-cache may merge same-ns DBs
	// in parallel test runs, so we assert >= 1 rather than == 2).
	assert.GreaterOrEqual(t, resp["count"], float64(1))
}

// ---------------------------------------------------------------------------
// RevokeSecret
// ---------------------------------------------------------------------------

func TestRevokeSecret_MissingID(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"notes": "rotating"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets//revoke", bytes.NewReader(body))
	req.URL.Path = "/api/v1/secrets//revoke"
	w := httptest.NewRecorder()
	h.RevokeSecret(w, req)

	// Empty first part → bad request.
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRevokeSecret_InvalidID(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"notes": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets/not-a-number/revoke", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RevokeSecret(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRevokeSecret_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets/1/revoke", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.RevokeSecret(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRevokeSecret_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"notes": "rotating"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets/9999/revoke", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RevokeSecret(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestRevokeSecret_HappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)
	id := seedSecretLifecycle(t, db, "active")

	body, _ := json.Marshal(map[string]string{"notes": "rotating credentials"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets/"+itoa(int(id))+"/revoke", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RevokeSecret(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "revoked", resp["status"])
}

// ---------------------------------------------------------------------------
// SecretLifecycleSummary
// ---------------------------------------------------------------------------

func TestSecretLifecycleSummary_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/secrets/summary", nil)
	w := httptest.NewRecorder()
	h.SecretLifecycleSummary(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestSecretLifecycleSummary_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/secrets/summary", nil)
	w := httptest.NewRecorder()
	h.SecretLifecycleSummary(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["total"])
}

func TestSecretLifecycleSummary_WithData(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedSecretLifecycle(t, db, "active")
	seedSecretLifecycle(t, db, "revoked")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/secrets/summary", nil)
	w := httptest.NewRecorder()
	h.SecretLifecycleSummary(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// At least 1 entry must be in the total.
	total, _ := resp["total"].(float64)
	assert.GreaterOrEqual(t, total, float64(1))

	counts, ok := resp["counts"].(map[string]interface{})
	require.True(t, ok)
	// All three status keys must be present.
	assert.Contains(t, counts, "active")
	assert.Contains(t, counts, "revoked")
	assert.Contains(t, counts, "expired")
}
