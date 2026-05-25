package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/search"
)

func newTestLogger(t *testing.T) *logging.Logger {
	t.Helper()
	l, err := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	if err != nil {
		t.Fatalf("logger: %v", err)
	}
	return l
}

func TestExtractFindingIDFromSimilarPath(t *testing.T) {
	cases := []struct {
		path string
		want int64
	}{
		{"/api/v1/findings/42/similar", 42},
		{"/api/v1/findings/1/similar", 1},
	}
	for _, c := range cases {
		got, err := extractFindingIDFromSimilarPath(c.path)
		if err != nil {
			t.Errorf("%s: unexpected err %v", c.path, err)
		}
		if got != c.want {
			t.Errorf("%s: got %d want %d", c.path, got, c.want)
		}
	}

	if _, err := extractFindingIDFromSimilarPath("/api/v1/findings/notanumber/similar"); err == nil {
		t.Error("expected error on non-numeric id")
	}
}

func TestGetSimilarFindingsDisabled(t *testing.T) {
	h := &Handlers{logger: newTestLogger(t), searchClient: search.New()}
	// env unset → client disabled
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/1/similar", nil)
	rec := httptest.NewRecorder()
	h.GetSimilarFindings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 when disabled, got %d — body: %s", rec.Code, rec.Body.String())
	}
	var resp SimilarFindingsResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Enabled {
		t.Error("expected enabled=false when client disabled")
	}
	if len(resp.Hits) != 0 {
		t.Errorf("expected empty hits, got %d", len(resp.Hits))
	}
}

func TestGetSimilarFindingsRejectsPOST(t *testing.T) {
	h := &Handlers{logger: newTestLogger(t), searchClient: search.New()}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/1/similar", nil)
	rec := httptest.NewRecorder()
	h.GetSimilarFindings(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", rec.Code)
	}
}

func TestGetSimilarFindingsBadID(t *testing.T) {
	h := &Handlers{logger: newTestLogger(t), searchClient: search.New()}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/abc/similar", nil)
	rec := httptest.NewRecorder()
	h.GetSimilarFindings(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "invalid finding ID") {
		t.Errorf("wrong body: %s", rec.Body.String())
	}
}
