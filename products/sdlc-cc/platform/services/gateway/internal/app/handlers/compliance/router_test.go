package compliance

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestDataFlowHandler_StableSHA(t *testing.T) {
	h := DataFlowHandler()
	rr1 := httptest.NewRecorder()
	rr2 := httptest.NewRecorder()
	h(rr1, httptest.NewRequest(http.MethodGet, "/compliance/data-flow", nil))
	h(rr2, httptest.NewRequest(http.MethodGet, "/compliance/data-flow", nil))
	if rr1.Code != http.StatusOK || rr2.Code != http.StatusOK {
		t.Fatalf("status: %d %d", rr1.Code, rr2.Code)
	}
	sha1 := rr1.Header().Get("X-Data-Flow-Sha")
	sha2 := rr2.Header().Get("X-Data-Flow-Sha")
	if sha1 == "" || sha1 != sha2 {
		t.Fatalf("sha not stable: %q vs %q", sha1, sha2)
	}
}

func TestRetentionStatusHandler(t *testing.T) {
	tid := uuid.New()
	last := time.Now().Add(-24 * time.Hour).UTC()
	ret := &fakeRet{rep: RetentionReport{
		Items: []RetentionStatus{{DataType: "chat_history", RetentionDays: 30, LastSweepAt: &last}},
	}}
	rr := httptest.NewRecorder()
	RetentionStatusHandler(RetentionDeps{Reader: ret})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/retention-status?tenant_id="+tid.String(), nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestDLPEventsHandler_BadAction(t *testing.T) {
	tid := uuid.New()
	rr := httptest.NewRecorder()
	DLPEventsHandler(DLPEventDeps{Reader: &fakeDLP{}})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/dlp-events?tenant_id="+tid.String()+"&action=bogus", nil),
	)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 got %d", rr.Code)
	}
}

func TestDLPEventsHandler_OK(t *testing.T) {
	tid := uuid.New()
	dlp := &fakeDLP{page: DLPEventPage{Rows: []DLPEventRow{{
		ID: uuid.New(), TenantID: tid, Detector: "ssn", Direction: "inbound",
		Action: "redact", MatchCount: 1, OccurredAt: time.Now().UTC(),
	}}}}
	rr := httptest.NewRecorder()
	DLPEventsHandler(DLPEventDeps{Reader: dlp})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/dlp-events?tenant_id="+tid.String()+"&action=redact", nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rr.Code, rr.Body.String())
	}
	if dlp.got.TenantID != tid || dlp.got.Action != "redact" {
		t.Fatalf("query not parsed: %+v", dlp.got)
	}
}

func TestMount_AllRoutesRespond(t *testing.T) {
	tid := uuid.New()
	router := Mount(Deps{
		Audit:     &fakeAudit{},
		RBAC:      &fakeRBAC{snap: RBACSnapshot{}},
		Retention: &fakeRet{rep: RetentionReport{}},
		DLP:       &fakeDLP{page: DLPEventPage{}},
	})
	cases := []struct {
		path string
		want int
	}{
		{"/audit-events", http.StatusOK},
		{"/access-controls?tenant_id=" + tid.String(), http.StatusOK},
		{"/data-flow", http.StatusOK},
		{"/retention-status?tenant_id=" + tid.String(), http.StatusOK},
		{"/dlp-events?tenant_id=" + tid.String(), http.StatusOK},
	}
	for _, c := range cases {
		t.Run(c.path, func(t *testing.T) {
			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, c.path, nil))
			if rr.Code != c.want {
				t.Fatalf("path=%s want=%d got=%d body=%s", c.path, c.want, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestSetDeprecation(t *testing.T) {
	rr := httptest.NewRecorder()
	SetDeprecation(rr, "Tue, 01 Jul 2026 00:00:00 GMT", "https://docs.example/sunset")
	if rr.Header().Get("Deprecation") == "" {
		t.Fatalf("missing Deprecation header")
	}
	if rr.Header().Get("Link") == "" {
		t.Fatalf("missing Link header")
	}
}
