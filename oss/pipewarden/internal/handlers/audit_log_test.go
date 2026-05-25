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

func newAuditTestHandler(t *testing.T) *Handlers {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("failed to create logger: %v", err)
	}
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil)
}

func TestAuditLogAppendAndList(t *testing.T) {
	h := newAuditTestHandler(t)

	for i := 0; i < 3; i++ {
		if err := h.db.AppendAuditLog("scan_completed", "system", "conn1", "connection", nil); err != nil {
			t.Fatalf("AppendAuditLog failed: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit", nil)
	w := httptest.NewRecorder()
	h.ListAuditLog(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	entries, ok := resp["entries"].([]interface{})
	if !ok {
		t.Fatalf("entries missing from response")
	}
	if len(entries) != 3 {
		t.Errorf("expected 3 entries, got %d", len(entries))
	}
}

func TestAuditLogFilterByAction(t *testing.T) {
	h := newAuditTestHandler(t)

	_ = h.db.AppendAuditLog("scan_started", "system", "conn1", "connection", nil)
	_ = h.db.AppendAuditLog("connection_added", "user", "conn1", "connection", nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?action=scan_started", nil)
	w := httptest.NewRecorder()
	h.ListAuditLog(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	entries, ok := resp["entries"].([]interface{})
	if !ok {
		t.Fatalf("entries missing from response")
	}
	if len(entries) != 1 {
		t.Errorf("expected 1 entry for scan_started filter, got %d", len(entries))
	}
}

func TestAuditLogPagination(t *testing.T) {
	h := newAuditTestHandler(t)

	for i := 0; i < 10; i++ {
		if err := h.db.AppendAuditLog("scan_completed", "system", "conn1", "connection", nil); err != nil {
			t.Fatalf("AppendAuditLog failed: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit?limit=3&offset=6", nil)
	w := httptest.NewRecorder()
	h.ListAuditLog(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	entries, ok := resp["entries"].([]interface{})
	if !ok {
		t.Fatalf("entries missing from response")
	}
	if len(entries) != 3 {
		t.Errorf("expected 3 entries (offset=6, limit=3 of 10), got %d", len(entries))
	}

	total := resp["total"].(float64)
	if total != 10 {
		t.Errorf("expected total=10, got %v", total)
	}
}
