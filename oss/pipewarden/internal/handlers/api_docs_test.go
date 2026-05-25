package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newDocsHandlers(t *testing.T) (*Handlers, func()) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("storage.NewInMemory: %v", err)
	}
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("logging.New: %v", err)
	}
	h := New(db, integrations.NewManager(logger), nil, nil, logger, nil)
	return h, func() { _ = db.Close() }
}

func TestAPIDocsEndpoint(t *testing.T) {
	h, cleanup := newDocsHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/docs", nil)
	w := httptest.NewRecorder()
	h.APIDocs(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var spec map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&spec); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	openapiVersion, ok := spec["openapi"].(string)
	if !ok {
		t.Fatal("openapi field missing or not a string")
	}
	if openapiVersion != "3.0.0" {
		t.Errorf("expected openapi=3.0.0, got %q", openapiVersion)
	}
}

func TestAPIDocsContentType(t *testing.T) {
	h, cleanup := newDocsHandlers(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/docs", nil)
	w := httptest.NewRecorder()
	h.APIDocs(w, req)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}
