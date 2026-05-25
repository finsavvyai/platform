package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeAuditReader struct {
	gotQuery AuditQuery
	page     AuditPage
	err      error
}

func (f *fakeAuditReader) Query(_ context.Context, q AuditQuery) (AuditPage, error) {
	f.gotQuery = q
	return f.page, f.err
}

func TestAudit_JSONResponse(t *testing.T) {
	tenantID := uuid.New()
	row := AuditRow{
		ID:        uuid.New(),
		TenantID:  tenantID,
		ActorType: "user",
		Action:    "auth.login",
		CreatedAt: time.Unix(1_700_000_000, 0).UTC(),
	}
	reader := &fakeAuditReader{page: AuditPage{Rows: []AuditRow{row}, NextCursor: "next"}}
	rr := httptest.NewRecorder()
	QueryAuditLogs(AuditQueryDeps{Reader: reader})(rr, httptest.NewRequest(http.MethodGet, "/admin/audit-logs", nil))

	if rr.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d", rr.Code)
	}
	var page AuditPage
	if err := json.Unmarshal(rr.Body.Bytes(), &page); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if page.NextCursor != "next" || len(page.Rows) != 1 {
		t.Fatalf("body shape: %+v", page)
	}
}

func TestAudit_FilterParsing(t *testing.T) {
	tenantID := uuid.New()
	actorID := uuid.New()
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
	to := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)

	url := "/admin/audit-logs?tenant_id=" + tenantID.String() +
		"&actor_id=" + actorID.String() +
		"&action=auth.login&from=" + from + "&to=" + to + "&limit=42"

	reader := &fakeAuditReader{}
	rr := httptest.NewRecorder()
	QueryAuditLogs(AuditQueryDeps{Reader: reader})(rr, httptest.NewRequest(http.MethodGet, url, nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d, body=%s", rr.Code, rr.Body.String())
	}
	if reader.gotQuery.TenantID == nil || *reader.gotQuery.TenantID != tenantID {
		t.Fatalf("tenant filter not parsed: %+v", reader.gotQuery)
	}
	if reader.gotQuery.ActorID == nil || *reader.gotQuery.ActorID != actorID {
		t.Fatalf("actor filter not parsed: %+v", reader.gotQuery)
	}
	if reader.gotQuery.Action != "auth.login" {
		t.Fatalf("action filter: %q", reader.gotQuery.Action)
	}
	if reader.gotQuery.Limit != 42 {
		t.Fatalf("limit: %d", reader.gotQuery.Limit)
	}
}

func TestAudit_BadFilterReturns400(t *testing.T) {
	cases := []string{
		"/admin/audit-logs?tenant_id=not-uuid",
		"/admin/audit-logs?actor_id=not-uuid",
		"/admin/audit-logs?from=not-rfc3339",
		"/admin/audit-logs?to=not-rfc3339",
		"/admin/audit-logs?limit=0",
		"/admin/audit-logs?limit=99999",
	}
	for _, url := range cases {
		t.Run(url, func(t *testing.T) {
			rr := httptest.NewRecorder()
			QueryAuditLogs(AuditQueryDeps{Reader: &fakeAuditReader{}})(
				rr, httptest.NewRequest(http.MethodGet, url, nil),
			)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d for %s", rr.Code, url)
			}
		})
	}
}

func TestAudit_CSVStreaming(t *testing.T) {
	tenantID := uuid.New()
	row := AuditRow{
		ID:        uuid.New(),
		TenantID:  tenantID,
		ActorType: "user",
		Action:    "auth.login",
		CreatedAt: time.Unix(1_700_000_000, 0).UTC(),
	}
	reader := &fakeAuditReader{page: AuditPage{Rows: []AuditRow{row}}}

	req := httptest.NewRequest(http.MethodGet, "/admin/audit-logs", nil)
	req.Header.Set("Accept", "text/csv")
	rr := httptest.NewRecorder()
	QueryAuditLogs(AuditQueryDeps{Reader: reader})(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d", rr.Code)
	}
	if !strings.HasPrefix(rr.Header().Get("Content-Type"), "text/csv") {
		t.Fatalf("content-type: %q", rr.Header().Get("Content-Type"))
	}
	if !strings.Contains(rr.Header().Get("Content-Disposition"), "audit-logs.csv") {
		t.Fatalf("missing attachment header")
	}
	r := csv.NewReader(strings.NewReader(rr.Body.String()))
	rows, err := r.ReadAll()
	if err != nil {
		t.Fatalf("CSV parse: %v", err)
	}
	if len(rows) != 2 || rows[0][4] != "action" || rows[1][4] != "auth.login" {
		t.Fatalf("CSV shape: %+v", rows)
	}
}
