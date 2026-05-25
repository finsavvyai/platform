package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/sdlc-core/audit"
)

func TestHandleDLPScrub_RedactsAndCounts(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	body, _ := json.Marshal(scrubRequest{
		Text: "Email john.doe@example.com\nPAN 4111-1111-1111-1111",
	})
	req := httptest.NewRequest("POST", "/v1/dlp/scrub", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleDLPScrub(repo, nil)(rec, req)

	if rec.Code != 200 {
		t.Fatalf("got %d body=%s", rec.Code, rec.Body.String())
	}
	var resp scrubResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)

	if strings.Contains(resp.CleanText, "4111-1111-1111-1111") {
		t.Errorf("PAN leaked in clean_text: %s", resp.CleanText)
	}
	if resp.Redactions.PAN != 1 {
		t.Errorf("expected PAN count 1, got %d", resp.Redactions.PAN)
	}
	if resp.Redactions.Email != 1 {
		t.Errorf("expected Email count 1, got %d", resp.Redactions.Email)
	}
}

func TestHandleDLPScrub_AuditRowWritten(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	body, _ := json.Marshal(scrubRequest{Text: "Card 4111-1111-1111-1111"})
	req := httptest.NewRequest("POST", "/v1/dlp/scrub", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), tenantCtxKey{}, "tnt_audit"))
	rec := httptest.NewRecorder()
	HandleDLPScrub(repo, nil)(rec, req)

	rows, _ := repo.ListByTenant(req.Context(), "tnt_audit",
		time.Now().Add(-time.Minute), time.Now().Add(time.Minute), 10)
	if len(rows) != 1 || rows[0].SummaryType != "dlp_scrub" {
		t.Errorf("expected one dlp_scrub audit row, got %+v", rows)
	}
}

func TestHandleDLPScrub_PayloadTooLarge(t *testing.T) {
	body, _ := json.Marshal(scrubRequest{
		Text:     strings.Repeat("a", 100),
		MaxChars: 50,
	})
	req := httptest.NewRequest("POST", "/v1/dlp/scrub", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleDLPScrub(audit.NewInMemoryRepository(), nil)(rec, req)
	if rec.Code != 413 {
		t.Errorf("got %d, want 413", rec.Code)
	}
}

func TestHandleDLPScrub_MissingText(t *testing.T) {
	body, _ := json.Marshal(scrubRequest{})
	req := httptest.NewRequest("POST", "/v1/dlp/scrub", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleDLPScrub(audit.NewInMemoryRepository(), nil)(rec, req)
	if rec.Code != 400 {
		t.Errorf("got %d, want 400", rec.Code)
	}
}

func TestHandleDLPScrub_NoPII_ReturnsClean(t *testing.T) {
	body, _ := json.Marshal(scrubRequest{Text: "hello world"})
	req := httptest.NewRequest("POST", "/v1/dlp/scrub", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	HandleDLPScrub(audit.NewInMemoryRepository(), nil)(rec, req)
	var resp scrubResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.CleanText != "hello world" || resp.Redactions.Total() != 0 {
		t.Errorf("clean input mangled: text=%q counts=%+v", resp.CleanText, resp.Redactions)
	}
}
