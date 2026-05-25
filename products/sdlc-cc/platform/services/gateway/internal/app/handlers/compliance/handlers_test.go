package compliance

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// In-memory fakes shared across the test files in this package.
// ---------------------------------------------------------------------------

type fakeAudit struct {
	got  AuditEventQuery
	page AuditEventPage
}

func (f *fakeAudit) Query(_ context.Context, q AuditEventQuery) (AuditEventPage, error) {
	f.got = q
	return f.page, nil
}

type fakeRBAC struct{ snap RBACSnapshot }

func (f *fakeRBAC) Snapshot(_ context.Context, _ uuid.UUID) (RBACSnapshot, error) {
	return f.snap, nil
}

type fakeRet struct{ rep RetentionReport }

func (f *fakeRet) Status(_ context.Context, _ uuid.UUID) (RetentionReport, error) {
	return f.rep, nil
}

type fakeDLP struct {
	got  DLPEventQuery
	page DLPEventPage
}

func (f *fakeDLP) List(_ context.Context, q DLPEventQuery) (DLPEventPage, error) {
	f.got = q
	return f.page, nil
}

// ---------------------------------------------------------------------------
// audit-events + access-controls
// ---------------------------------------------------------------------------

func TestAuditEventsHandler_OK(t *testing.T) {
	row := AuditEventRow{
		ID: uuid.New(), TenantID: uuid.New(),
		ActorType: "user", Action: "auth.login",
		CreatedAt: time.Unix(1_700_000_000, 0).UTC(),
	}
	r := &fakeAudit{page: AuditEventPage{Rows: []AuditEventRow{row}}}
	rr := httptest.NewRecorder()
	AuditEventsHandler(AuditEventDeps{Reader: r})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/audit-events", nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d body=%s", rr.Code, rr.Body.String())
	}
	if rr.Header().Get("X-Schema-Version") != SchemaVersion {
		t.Fatalf("missing schema header")
	}
	var page AuditEventPage
	if err := json.Unmarshal(rr.Body.Bytes(), &page); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(page.Rows) != 1 {
		t.Fatalf("rows: %+v", page.Rows)
	}
}

func TestAuditEventsHandler_BadQuery(t *testing.T) {
	rr := httptest.NewRecorder()
	AuditEventsHandler(AuditEventDeps{Reader: &fakeAudit{}})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/audit-events?limit=99999", nil),
	)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 got %d", rr.Code)
	}
}

func TestAccessControlsHandler_RequiresTenantID(t *testing.T) {
	rr := httptest.NewRecorder()
	AccessControlsHandler(AccessControlsDeps{Reader: &fakeRBAC{}})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/access-controls", nil),
	)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("want 400 got %d", rr.Code)
	}
}

func TestAccessControlsHandler_OK(t *testing.T) {
	tid := uuid.New()
	rbac := &fakeRBAC{snap: RBACSnapshot{
		Roles: []Role{{Name: "admin", Permissions: []string{"audit:read"}}},
	}}
	rr := httptest.NewRecorder()
	AccessControlsHandler(AccessControlsDeps{Reader: rbac})(
		rr, httptest.NewRequest(http.MethodGet, "/compliance/access-controls?tenant_id="+tid.String(), nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}
	var snap RBACSnapshot
	if err := json.Unmarshal(rr.Body.Bytes(), &snap); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if snap.TenantID != tid || len(snap.Roles) != 1 {
		t.Fatalf("body: %+v", snap)
	}
	if snap.GeneratedAt.IsZero() {
		t.Fatalf("generated_at not set")
	}
}
