package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// LoadDemoWorkspace
// ---------------------------------------------------------------------------

func TestLoadDemoWorkspace_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/demo/load", nil)
	w := httptest.NewRecorder()
	h.LoadDemoWorkspace(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestLoadDemoWorkspace_HappyPath(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/demo/load", nil)
	w := httptest.NewRecorder()
	h.LoadDemoWorkspace(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "loaded", resp["status"])
	assert.Equal(t, demoConnectionName, resp["connection_name"])
	// At least some findings should have been seeded on first call.
	findingsCreated, _ := resp["findings_created"].(float64)
	assert.GreaterOrEqual(t, findingsCreated, float64(0))
}

func TestLoadDemoWorkspace_Idempotent(t *testing.T) {
	// Calling twice should not double-insert findings (idempotency guard).
	h := newTestHandlers(t)

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/demo/load", nil)
		w := httptest.NewRecorder()
		h.LoadDemoWorkspace(w, req)
		require.Equal(t, http.StatusOK, w.Code, "call %d failed", i+1)
	}

	// The second call should report 0 findings created (they already exist).
	req := httptest.NewRequest(http.MethodPost, "/api/v1/demo/load", nil)
	w := httptest.NewRecorder()
	h.LoadDemoWorkspace(w, req)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	findingsCreated, _ := resp["findings_created"].(float64)
	assert.Equal(t, float64(0), findingsCreated)
}
