// Behavior tests for the D3 compliance evidence export. Validates
// that the bundle includes events matching all four action
// prefixes, that the hash chain is deterministic, and that bad
// inputs produce clean errors.
package compliance_export

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

type fakeReader struct {
	events []Event
	gotQ   Query
}

func (f *fakeReader) List(_ context.Context, q Query) ([]Event, error) {
	f.gotQ = q
	return f.events, nil
}

func TestMount_NilReaderReturns503(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, nil)
	req := httptest.NewRequest(http.MethodGet,
		"/admin/tenants/11111111-1111-4111-8111-111111111111/compliance/export", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestExport_ReturnsBundleWithCorrectShape(t *testing.T) {
	now := time.Date(2026, 5, 1, 10, 0, 0, 0, time.UTC)
	reader := &fakeReader{
		events: []Event{
			{ID: "1", Action: "dlp.inbound", CreatedAt: now.Add(-3 * time.Hour),
				Details: map[string]any{"matches": float64(2)}},
			{ID: "2", Action: "policy.update", CreatedAt: now.Add(-2 * time.Hour)},
			{ID: "3", Action: "api_key.rotate", CreatedAt: now.Add(-1 * time.Hour)},
			{ID: "4", Action: "auth.login", CreatedAt: now},
		},
	}
	r := chi.NewRouter()
	Mount(r, reader)

	tenantID := "11111111-1111-4111-8111-111111111111"
	req := httptest.NewRequest(http.MethodGet,
		"/admin/tenants/"+tenantID+"/compliance/export", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%q", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Content-Disposition"); !strings.Contains(got, tenantID) {
		t.Errorf("Content-Disposition should include tenant id; got %q", got)
	}
	var bundle Bundle
	if err := json.Unmarshal(rec.Body.Bytes(), &bundle); err != nil {
		t.Fatalf("body not JSON: %v", err)
	}
	if bundle.TenantID != tenantID {
		t.Errorf("bundle tenant_id = %q, want %q", bundle.TenantID, tenantID)
	}
	if bundle.EventCount != 4 {
		t.Errorf("event_count = %d, want 4", bundle.EventCount)
	}
	if bundle.Hash == "" {
		t.Error("hash chain must be present")
	}
}

func TestExport_QueryWalksAllFourActionPrefixes(t *testing.T) {
	reader := &fakeReader{}
	r := chi.NewRouter()
	Mount(r, reader)
	tenantID := "11111111-1111-4111-8111-111111111111"
	r.ServeHTTP(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet,
			"/admin/tenants/"+tenantID+"/compliance/export", nil))

	wantPrefixes := []string{"dlp.%", "policy.%", "api_key.%", "auth.%", "session.%"}
	if len(reader.gotQ.ActionLikes) != len(wantPrefixes) {
		t.Fatalf("ActionLikes count = %d, want %d", len(reader.gotQ.ActionLikes), len(wantPrefixes))
	}
	for i, want := range wantPrefixes {
		if reader.gotQ.ActionLikes[i] != want {
			t.Errorf("ActionLikes[%d] = %q, want %q",
				i, reader.gotQ.ActionLikes[i], want)
		}
	}
}

func TestExport_HashChainIsDeterministic(t *testing.T) {
	now := time.Date(2026, 5, 1, 10, 0, 0, 0, time.UTC)
	events := []Event{
		{ID: "a", Action: "dlp.inbound", CreatedAt: now},
		{ID: "b", Action: "policy.update", CreatedAt: now.Add(time.Minute)},
	}
	first := hashChain(events)
	second := hashChain(events)
	if first != second {
		t.Errorf("hash chain not deterministic: %q vs %q", first, second)
	}
	// Mutating one event must change the hash.
	events[0].Details = map[string]any{"x": 1}
	mutated := hashChain(events)
	if mutated == first {
		t.Error("hash chain unchanged after event mutation — chain is broken")
	}
}

func TestExport_EventsSortedByCreatedAt(t *testing.T) {
	now := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	reader := &fakeReader{
		events: []Event{
			{ID: "z", Action: "dlp.inbound", CreatedAt: now.Add(2 * time.Hour)},
			{ID: "a", Action: "policy.update", CreatedAt: now},
			{ID: "m", Action: "auth.login", CreatedAt: now.Add(time.Hour)},
		},
	}
	r := chi.NewRouter()
	Mount(r, reader)
	tenantID := "11111111-1111-4111-8111-111111111111"
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet,
		"/admin/tenants/"+tenantID+"/compliance/export", nil))

	var bundle Bundle
	_ = json.Unmarshal(rec.Body.Bytes(), &bundle)
	if len(bundle.Events) != 3 {
		t.Fatalf("event count = %d, want 3", len(bundle.Events))
	}
	got := []string{bundle.Events[0].ID, bundle.Events[1].ID, bundle.Events[2].ID}
	if got[0] != "a" || got[1] != "m" || got[2] != "z" {
		t.Errorf("events not sorted by created_at: %v", got)
	}
}

func TestExport_RejectsBadDate(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, &fakeReader{})
	tenantID := "11111111-1111-4111-8111-111111111111"
	req := httptest.NewRequest(http.MethodGet,
		"/admin/tenants/"+tenantID+"/compliance/export?from=bogus", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 on bad date", rec.Code)
	}
}

func TestExport_RejectsInvalidTenantID(t *testing.T) {
	r := chi.NewRouter()
	Mount(r, &fakeReader{})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet,
		"/admin/tenants/not-a-uuid/compliance/export", nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}
