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

func newSecretLifecycleHandler(t *testing.T) (*Handlers, *storage.DB) {
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

func insertFindingForLifecycle(t *testing.T, db *storage.DB) int64 {
	t.Helper()
	f := &storage.FindingRecord{
		ConnectionName: "conn-1",
		RunID:          "run-sl",
		Severity:       "critical",
		Category:       "secrets",
		Title:          "Secret lifecycle test finding",
		Description:    "desc",
		Remediation:    "rotate",
		Status:         "open",
		CreatedAt:      time.Now().UTC(),
	}
	if err := db.CreateFinding(f); err != nil {
		t.Fatalf("failed to create finding: %v", err)
	}
	return f.ID
}

// TestSecretLifecycleUpsert verifies that upserting twice yields a single row
// with updated last_seen_at.
func TestSecretLifecycleUpsert(t *testing.T) {
	_, db := newSecretLifecycleHandler(t)
	fid := insertFindingForLifecycle(t, db)

	if err := db.UpsertSecretLifecycle(fid, "AWS Access Key", "AKIA...LE"); err != nil {
		t.Fatalf("first upsert failed: %v", err)
	}

	// Wait a tiny bit so timestamps differ
	time.Sleep(2 * time.Millisecond)
	firstRows, _ := db.ListSecretLifecycle("")
	if len(firstRows) != 1 {
		t.Fatalf("expected 1 row after first upsert, got %d", len(firstRows))
	}
	firstLastSeen := firstRows[0].LastSeenAt

	time.Sleep(2 * time.Millisecond)
	if err := db.UpsertSecretLifecycle(fid, "AWS Access Key", "AKIA...LE"); err != nil {
		t.Fatalf("second upsert failed: %v", err)
	}

	rows, err := db.ListSecretLifecycle("")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row after second upsert (dedup), got %d", len(rows))
	}
	if !rows[0].LastSeenAt.After(firstLastSeen) {
		t.Errorf("expected last_seen_at to be updated on second upsert")
	}
}

// TestSecretRevoke verifies that revoking sets status=revoked and revoked_at.
func TestSecretRevoke(t *testing.T) {
	_, db := newSecretLifecycleHandler(t)
	fid := insertFindingForLifecycle(t, db)

	if err := db.UpsertSecretLifecycle(fid, "AWS Access Key", "AKIA...LE"); err != nil {
		t.Fatalf("upsert failed: %v", err)
	}
	if err := db.RevokeSecret(fid, "rotated 2026-04-22"); err != nil {
		t.Fatalf("revoke failed: %v", err)
	}

	rows, err := db.ListSecretLifecycle("")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("expected 1 row")
	}
	if rows[0].Status != "revoked" {
		t.Errorf("expected status=revoked, got %s", rows[0].Status)
	}
	if rows[0].RevokedAt == nil {
		t.Error("expected revoked_at to be set")
	}
}

// TestSecretListByStatus verifies filtering by status returns only matching rows.
func TestSecretListByStatus(t *testing.T) {
	_, db := newSecretLifecycleHandler(t)

	// Create 3 findings, upsert 2 as active, 1 as revoked
	for i := 0; i < 3; i++ {
		fid := insertFindingWithTitle(t, db, fmt.Sprintf("finding-%d", i))
		if err := db.UpsertSecretLifecycle(fid, "AWS Access Key", fmt.Sprintf("AKIA...%02d", i)); err != nil {
			t.Fatalf("upsert %d failed: %v", i, err)
		}
		if i == 2 {
			if err := db.RevokeSecret(fid, "rotated"); err != nil {
				t.Fatalf("revoke failed: %v", err)
			}
		}
	}

	active, err := db.ListSecretLifecycle("active")
	if err != nil {
		t.Fatalf("list active error: %v", err)
	}
	if len(active) != 2 {
		t.Errorf("expected 2 active secrets, got %d", len(active))
	}

	revoked, err := db.ListSecretLifecycle("revoked")
	if err != nil {
		t.Fatalf("list revoked error: %v", err)
	}
	if len(revoked) != 1 {
		t.Errorf("expected 1 revoked secret, got %d", len(revoked))
	}
}

// TestSecretSummary verifies summary counts and oldest age computation.
func TestSecretSummary(t *testing.T) {
	h, db := newSecretLifecycleHandler(t)

	fid1 := insertFindingWithTitle(t, db, "finding-a")
	fid2 := insertFindingWithTitle(t, db, "finding-b")
	fid3 := insertFindingWithTitle(t, db, "finding-c")

	_ = db.UpsertSecretLifecycle(fid1, "Pat1", "AKIA...A1")
	_ = db.UpsertSecretLifecycle(fid2, "Pat2", "AKIA...B2")
	_ = db.UpsertSecretLifecycle(fid3, "Pat3", "AKIA...C3")
	_ = db.RevokeSecret(fid3, "rotated")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/secrets/summary", nil)
	w := httptest.NewRecorder()
	h.SecretLifecycleSummary(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	counts, ok := resp["counts"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected counts map in response, got %T", resp["counts"])
	}
	if counts["active"] != float64(2) {
		t.Errorf("expected active=2, got %v", counts["active"])
	}
	if counts["revoked"] != float64(1) {
		t.Errorf("expected revoked=1, got %v", counts["revoked"])
	}

	total, ok := resp["total"].(float64)
	if !ok || total != 3 {
		t.Errorf("expected total=3, got %v", resp["total"])
	}

	if _, ok := resp["oldest_active_days"]; !ok {
		t.Error("expected oldest_active_days in response")
	}
}

// RevokeHandler HTTP test
func TestRevokeSecretHandler(t *testing.T) {
	h, db := newSecretLifecycleHandler(t)
	fid := insertFindingForLifecycle(t, db)
	_ = db.UpsertSecretLifecycle(fid, "AWS Access Key", "AKIA...LE")

	body, _ := json.Marshal(map[string]string{"notes": "rotated 2026-04-22"})
	req := httptest.NewRequest(http.MethodPost,
		fmt.Sprintf("/api/v1/secrets/%d/revoke", fid),
		bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RevokeSecret(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["status"] != "revoked" {
		t.Errorf("expected status=revoked, got %v", resp["status"])
	}
}

// insertFindingWithTitle is a helper that creates a finding with a unique title.
func insertFindingWithTitle(t *testing.T, db *storage.DB, title string) int64 {
	t.Helper()
	f := &storage.FindingRecord{
		ConnectionName: "conn-1",
		RunID:          "run-sl-" + title,
		Severity:       "critical",
		Category:       "secrets",
		Title:          title,
		Description:    "desc",
		Remediation:    "rotate",
		Status:         "open",
		CreatedAt:      time.Now().UTC(),
	}
	if err := db.CreateFinding(f); err != nil {
		t.Fatalf("failed to create finding %s: %v", title, err)
	}
	return f.ID
}
