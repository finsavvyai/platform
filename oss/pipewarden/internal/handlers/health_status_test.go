package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealth_HappyPath(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	h.Health(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "ok", resp["status"])

	checks, ok := resp["checks"].(map[string]interface{})
	require.True(t, ok, "checks should be an object")
	assert.Equal(t, true, checks["database"])
}

func TestHealth_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/health", nil)
	w := httptest.NewRecorder()
	h.Health(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHealth_VaultAbsent(t *testing.T) {
	// No vault provided — vault check should report false.
	h := newTestHandlersNoVault(t)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	h.Health(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	checks := resp["checks"].(map[string]interface{})
	assert.Equal(t, false, checks["vault"])
}

func TestHealth_VaultPresent(t *testing.T) {
	h := newTestHandlers(t) // embed_test.go's newTestHandlers always has a vault

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	h.Health(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	checks := resp["checks"].(map[string]interface{})
	assert.Equal(t, true, checks["vault"])
}

func TestStatus_HappyPath(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp StatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// With a valid DB, status should be healthy or degraded (vault absent).
	assert.Contains(t, []string{"healthy", "degraded"}, resp.Status)
	assert.True(t, resp.Database.Healthy)
	assert.GreaterOrEqual(t, resp.Uptime, int64(0))
}

func TestStatus_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}
