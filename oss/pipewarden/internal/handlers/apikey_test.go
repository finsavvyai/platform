package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newAPIKeyTestHandlers(t *testing.T) *Handlers {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("NewInMemory: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return &Handlers{db: db, ProgressRegistry: NewScanProgressRegistry()}
}

func TestGenerateAPIKey(t *testing.T) {
	h := newAPIKeyTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/my-conn/apikey", nil)
	rw := httptest.NewRecorder()
	h.GenerateAPIKey(rw, req)

	if rw.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rw.Code, rw.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(rw.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	key := resp["api_key"]
	if !strings.HasPrefix(key, "pw_") {
		t.Errorf("expected key to start with 'pw_', got %q", key)
	}
	if len(key) <= 20 {
		t.Errorf("expected key length > 20, got %d", len(key))
	}
}

func TestRevokeAPIKey(t *testing.T) {
	h := newAPIKeyTestHandlers(t)

	// Generate first
	genReq := httptest.NewRequest(http.MethodPost, "/api/v1/connections/my-conn/apikey", nil)
	genRW := httptest.NewRecorder()
	h.GenerateAPIKey(genRW, genReq)
	if genRW.Code != http.StatusOK {
		t.Fatalf("generate failed: %d %s", genRW.Code, genRW.Body.String())
	}

	// Revoke
	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/connections/my-conn/apikey", nil)
	delRW := httptest.NewRecorder()
	h.RevokeAPIKey(delRW, delReq)

	if delRW.Code != http.StatusOK {
		t.Fatalf("expected 200 on revoke, got %d: %s", delRW.Code, delRW.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(delRW.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["status"] != "revoked" {
		t.Errorf("expected status=revoked, got %q", resp["status"])
	}
}

func TestAPIKeyValidation(t *testing.T) {
	h := newAPIKeyTestHandlers(t)

	// Generate a key for connection "embed-conn"
	genReq := httptest.NewRequest(http.MethodPost, "/api/v1/connections/embed-conn/apikey", nil)
	genRW := httptest.NewRecorder()
	h.GenerateAPIKey(genRW, genReq)
	if genRW.Code != http.StatusOK {
		t.Fatalf("generate failed: %d", genRW.Code)
	}

	var genResp map[string]string
	if err := json.NewDecoder(genRW.Body).Decode(&genResp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	key := genResp["api_key"]

	// Use the key to call the embed findings endpoint
	embedReq := httptest.NewRequest(http.MethodGet, "/api/v1/embed/findings?apikey="+key, nil)
	embedRW := httptest.NewRecorder()
	h.EmbedFindings(embedRW, embedReq)

	if embedRW.Code != http.StatusOK {
		t.Fatalf("embed findings with valid key: expected 200, got %d: %s", embedRW.Code, embedRW.Body.String())
	}
}

func TestAPIKeyInvalid(t *testing.T) {
	h := newAPIKeyTestHandlers(t)

	// Use a garbage key — ValidateEmbedAPIKey should return 401
	embedReq := httptest.NewRequest(http.MethodGet, "/api/v1/embed/findings?apikey=pw_notavalidkey", nil)
	embedRW := httptest.NewRecorder()
	h.EmbedFindings(embedRW, embedReq)

	if embedRW.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid key, got %d: %s", embedRW.Code, embedRW.Body.String())
	}
}
