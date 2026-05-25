package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// ListConnections
// ---------------------------------------------------------------------------

func TestListConnections_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections", nil)
	w := httptest.NewRecorder()
	h.ListConnections(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["count"])
}

// ---------------------------------------------------------------------------
// CreateConnection
// ---------------------------------------------------------------------------

func TestCreateConnection_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewBufferString("{bad json"))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateConnection_MissingName(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"platform": "github"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateConnection_MissingPlatform(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"name": "myconn"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateConnection_UnsupportedPlatform(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"name": "myconn", "platform": "notarealplatform"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateConnection_VaultRequired_WithToken(t *testing.T) {
	// Token present but no vault configured → 503.
	h := newTestHandlersNoVault(t)

	body, _ := json.Marshal(map[string]string{
		"name":     "gh-main",
		"platform": "github",
		"token":    "ghp_something",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestCreateConnection_NoCredentials_UnsupportedPlatform(t *testing.T) {
	// Platform supported but no credentials provided. Since the platform is
	// unsupported ("demo" requires specific auth method), the unsupported error
	// should surface before the vault check.
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{
		"name":     "circleci-conn",
		"platform": "circleci",
		// no token — vault check skipped, but platform requires experimental flag
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)

	// Without experimental flag and no vault, platform returns nil → 400.
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ---------------------------------------------------------------------------
// GetConnection
// ---------------------------------------------------------------------------

func TestGetConnection_Empty_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	// Path has no name component → treated as method-not-allowed.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/", nil)
	w := httptest.NewRecorder()
	h.GetConnection(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetConnection_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/nonexistent", nil)
	w := httptest.NewRecorder()
	h.GetConnection(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// DeleteConnection
// ---------------------------------------------------------------------------

func TestDeleteConnection_Empty_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/connections/", nil)
	w := httptest.NewRecorder()
	h.DeleteConnection(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestDeleteConnection_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/connections/ghost", nil)
	w := httptest.NewRecorder()
	h.DeleteConnection(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// UpdateConnection
// ---------------------------------------------------------------------------

func TestUpdateConnection_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateConnection_MissingName(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"token": "abc"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateConnection_ConnectionNotFound(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"name": "does-not-exist"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// TestConnection handler
// ---------------------------------------------------------------------------

func TestTestConnectionHandler_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	// Path without /test suffix → method-not-allowed
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections//test", nil)
	w := httptest.NewRecorder()
	h.TestConnection(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestTestConnectionHandler_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/noconn/test", nil)
	w := httptest.NewRecorder()
	h.TestConnection(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// TestAllConnections
// ---------------------------------------------------------------------------

func TestTestAllConnections_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/test", nil)
	w := httptest.NewRecorder()
	h.TestAllConnections(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}
