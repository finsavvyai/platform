package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestCreateFixPRBatch_AllSkippedNoNetwork exercises the full HTTP path
// without hitting GitHub: every finding ID points to a non-existent row,
// so each worker resolves "skipped" before any github.com call.
func TestCreateFixPRBatch_AllSkippedNoNetwork(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  []int64{1001, 1002, 1003, 1004, 1005},
		Owner:       "fake-org",
		Repo:        "fake-repo",
		BaseBranch:  "main",
		GitHubToken: "ghp_unused_in_skip_path",
		MaxParallel: 4,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.CreateFixPRBatch(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp BatchFixPRResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Requested != 5 {
		t.Errorf("requested: got %d", resp.Requested)
	}
	if resp.Skipped != 5 {
		t.Errorf("expected all 5 skipped (findings absent); got %+v", resp)
	}
	if resp.Succeeded != 0 || resp.Failed != 0 {
		t.Errorf("expected only skipped, got %+v", resp)
	}
}

// TestCreateFixPRBatch_HonoursMaxParallelCap pushes a request with
// MaxParallel above batchMaxParallelCap and verifies the worker count
// is clamped (TotalTime stays bounded).
func TestCreateFixPRBatch_HonoursMaxParallelCap(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  []int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
		Owner:       "fake-org",
		Repo:        "fake-repo",
		GitHubToken: "ghp_unused",
		MaxParallel: 999, // above cap
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	start := time.Now()
	h.CreateFixPRBatch(rec, req)
	elapsed := time.Since(start)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d", rec.Code)
	}
	if elapsed > 10*time.Second {
		t.Errorf("batch took unreasonably long: %v", elapsed)
	}
	var resp BatchFixPRResponse
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if resp.Skipped != 10 {
		t.Errorf("expected 10 skipped: got %+v", resp)
	}
}

func TestCreateFixPRBatch_RejectsBadJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader([]byte("not-json")))
	rec := httptest.NewRecorder()
	h.CreateFixPRBatch(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d want 400", rec.Code)
	}
}

func TestCreateFixPRBatch_RejectsNonPOST(t *testing.T) {
	h := newTestHandlers(t)
	for _, m := range []string{http.MethodGet, http.MethodPut} {
		t.Run(m, func(t *testing.T) {
			req := httptest.NewRequest(m, "/api/v1/findings/fix/pr/batch", nil)
			rec := httptest.NewRecorder()
			h.CreateFixPRBatch(rec, req)
			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s: got %d want 405", m, rec.Code)
			}
		})
	}
}
