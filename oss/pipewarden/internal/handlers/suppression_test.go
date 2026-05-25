package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newSuppressionTestHandler(t *testing.T) (*Handlers, *storage.DB) {
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
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil), db
}

func insertTestFinding(t *testing.T, db *storage.DB) int64 {
	t.Helper()
	f := &storage.FindingRecord{
		ConnectionName: "test-conn",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "secrets",
		Title:          "Test finding",
		Description:    "A test finding",
		Remediation:    "Fix it",
		Status:         "open",
		CreatedAt:      time.Now().UTC(),
	}
	if err := db.CreateFinding(f); err != nil {
		t.Fatalf("failed to create test finding: %v", err)
	}
	return f.ID
}

func TestSuppressFinding(t *testing.T) {
	h, db := newSuppressionTestHandler(t)
	id := insertTestFinding(t, db)

	body, _ := json.Marshal(SuppressionRequest{Reason: "false_positive", Note: "not a real issue"})
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/findings/%d/suppress", id), bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.SuppressFinding(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if resp["status"] != "suppressed" {
		t.Errorf("expected status=suppressed, got %v", resp["status"])
	}

	// Verify in DB
	findings, err := db.ListFindings("test-conn")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	if len(findings) == 0 || findings[0].Status != "suppressed" {
		t.Errorf("expected suppressed status in DB, got %v", findings)
	}
}

func TestReopenFinding(t *testing.T) {
	h, db := newSuppressionTestHandler(t)
	id := insertTestFinding(t, db)

	// Suppress first
	suppBody, _ := json.Marshal(SuppressionRequest{Reason: "accepted_risk", Note: "ok"})
	suppReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/findings/%d/suppress", id), bytes.NewReader(suppBody))
	suppW := httptest.NewRecorder()
	h.SuppressFinding(suppW, suppReq)
	if suppW.Code != http.StatusOK {
		t.Fatalf("suppress setup failed: %d", suppW.Code)
	}

	// Now reopen
	reopenReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/findings/%d/reopen", id), nil)
	reopenW := httptest.NewRecorder()
	h.ReopenFinding(reopenW, reopenReq)

	if reopenW.Code != http.StatusOK {
		t.Fatalf("expected 200 on reopen, got %d: %s", reopenW.Code, reopenW.Body.String())
	}

	// Verify status is back to open in DB
	findings, err := db.ListFindings("test-conn")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	if len(findings) == 0 || findings[0].Status != "open" {
		t.Errorf("expected open status after reopen, got %v", findings)
	}
}

func TestSuppressInvalidReason(t *testing.T) {
	h, db := newSuppressionTestHandler(t)
	id := insertTestFinding(t, db)

	body, _ := json.Marshal(SuppressionRequest{Reason: "bad_reason", Note: ""})
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/findings/%d/suppress", id), bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.SuppressFinding(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid reason, got %d: %s", w.Code, w.Body.String())
	}
}
