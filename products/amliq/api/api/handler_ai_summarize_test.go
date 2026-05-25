package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/storage"
)

// fakeSummarizer is a deterministic AISummarizer for the table tests.
// Configured controls /503; complete returns either a summary or an
// error per the test case.
type fakeSummarizer struct {
	configured bool
	summary    string
	err        error
}

func (f fakeSummarizer) IsConfigured() bool { return f.configured }
func (f fakeSummarizer) Complete(_ context.Context, _ string) (string, error) {
	return f.summary, f.err
}

func TestHandleAISummarize(t *testing.T) {
	tests := []struct {
		name    string
		body    interface{}
		auth    bool
		summ    fakeSummarizer
		audit   storage.AuditRepository
		expect  int
	}{
		{"missing auth", AISummaryRequest{Text: "x", Type: "alert"},
			false, fakeSummarizer{configured: true, summary: "ok"},
			storage.NewInMemoryAuditRepo(), http.StatusUnauthorized},
		{"bad body", "not-json",
			true, fakeSummarizer{configured: true},
			storage.NewInMemoryAuditRepo(), http.StatusBadRequest},
		{"missing text", AISummaryRequest{Type: "alert"},
			true, fakeSummarizer{configured: true},
			storage.NewInMemoryAuditRepo(), http.StatusBadRequest},
		{"bad type", AISummaryRequest{Text: "hi", Type: "bogus"},
			true, fakeSummarizer{configured: true},
			storage.NewInMemoryAuditRepo(), http.StatusBadRequest},
		{"unconfigured AI", AISummaryRequest{Text: "Entity: X", Type: "alert"},
			true, fakeSummarizer{configured: false},
			storage.NewInMemoryAuditRepo(), http.StatusServiceUnavailable},
		{"AI error", AISummaryRequest{Text: "Entity: X", Type: "alert"},
			true, fakeSummarizer{configured: true, err: errors.New("boom")},
			storage.NewInMemoryAuditRepo(), http.StatusBadGateway},
		{"audit nil fails closed", AISummaryRequest{Text: "Entity: X", Type: "alert"},
			true, fakeSummarizer{configured: true, summary: "fine"},
			nil, http.StatusInternalServerError},
		{"happy path", AISummaryRequest{Text: "Entity: Smith", Type: "alert"},
			true, fakeSummarizer{configured: true, summary: "ok"},
			storage.NewInMemoryAuditRepo(), http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest("POST", "/api/v1/ai/summarize",
				bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if tt.auth {
				req = req.WithContext(ContextWithClaims(req.Context(),
					&Claims{TenantID: "tnt_abc123def456", UserID: "usr_test"}))
			}
			rec := httptest.NewRecorder()
			handleAISummarize(aiHandlerDeps{client: tt.summ, audit: tt.audit})(rec, req)
			if rec.Code != tt.expect {
				t.Fatalf("status: want %d got %d body=%s",
					tt.expect, rec.Code, rec.Body.String())
			}
		})
	}
}
