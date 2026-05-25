package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func seedSearchFindings(t *testing.T, h *Handlers) {
	t.Helper()
	rows := []storage.FindingRecord{
		{ConnectionName: "c", RunID: "r1", Severity: "high", Category: "secrets",
			Title:       "AWS access key leaked in workflow.yml",
			Description: "Hardcoded AWS access key found in actions/checkout step",
			Remediation: "Move to repository secrets", File: "ci.yml", Line: 7, Confidence: 0.95, Status: "open"},
		{ConnectionName: "c", RunID: "r1", Severity: "medium", Category: "supply-chain",
			Title:       "Outdated dependency lodash",
			Description: "lodash@4.17.10 has CVE-2019-10744",
			Remediation: "Bump to 4.17.21", File: "package.json", Confidence: 0.9, Status: "open"},
		{ConnectionName: "c", RunID: "r1", Severity: "low", Category: "policy",
			Title:       "Job missing timeout-minutes",
			Description: "Long-running jobs without timeouts can hang CI",
			Remediation: "Set timeout-minutes on the job", File: ".github/workflows/test.yml", Confidence: 0.7, Status: "open"},
	}
	for i := range rows {
		if err := h.db.CreateFinding(&rows[i]); err != nil {
			t.Fatalf("seed finding: %v", err)
		}
		h.localSearch.Add(findingDoc{rows[i]})
	}
}

func TestSearchFindings_HybridFindsKeywordMatch(t *testing.T) {
	h := newTestHandlers(t)
	seedSearchFindings(t, h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/search?q=AWS+access+key&mode=hybrid", nil)
	rec := httptest.NewRecorder()
	h.SearchFindings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Hits  []map[string]any `json:"hits"`
		Count int              `json:"count"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Count == 0 {
		t.Fatal("expected at least one hit")
	}
	// First hit must be the AWS finding (id 1, the seed order).
	if int(resp.Hits[0]["id"].(float64)) != 1 {
		t.Errorf("first hit should be AWS finding; got %+v", resp.Hits[0])
	}
}

func TestSearchFindings_SemanticPartialWord(t *testing.T) {
	h := newTestHandlers(t)
	seedSearchFindings(t, h)

	// "credential" doesn't appear as a token; trigrams of "credentials"
	// would catch it, but here we test "leaked" → "leak" via semantic.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/search?q=leak&mode=semantic", nil)
	rec := httptest.NewRecorder()
	h.SearchFindings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d", rec.Code)
	}
	var resp struct {
		Hits []map[string]any `json:"hits"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if len(resp.Hits) == 0 {
		t.Errorf("semantic query 'leak' should find the 'leaked' finding")
	}
}

func TestSearchFindings_RequiresQ(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/search", nil)
	rec := httptest.NewRecorder()
	h.SearchFindings(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("missing q: got %d want 400", rec.Code)
	}
}

func TestSearchFindings_RejectsBadMode(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/search?q=x&mode=fuzzy", nil)
	rec := httptest.NewRecorder()
	h.SearchFindings(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("bad mode: got %d want 400", rec.Code)
	}
}

func TestSearchFindings_RejectsNonGET(t *testing.T) {
	h := newTestHandlers(t)
	for _, m := range []string{http.MethodPost, http.MethodPut} {
		t.Run(m, func(t *testing.T) {
			req := httptest.NewRequest(m, "/api/v1/findings/search?q=x", nil)
			rec := httptest.NewRecorder()
			h.SearchFindings(rec, req)
			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("%s: got %d want 405", m, rec.Code)
			}
		})
	}
}
