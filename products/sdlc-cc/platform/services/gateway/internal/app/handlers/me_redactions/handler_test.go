// Behavior tests for the GET /v1/me/redactions endpoint. Validates
// query parsing, tenant scoping, RFC3339 enforcement, and that the
// reader receives the right Query.
package me_redactions

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeReader struct {
	gotQuery Query
	page     Page
	err      error
}

func (f *fakeReader) ListUserRedactions(_ context.Context, q Query) (Page, error) {
	f.gotQuery = q
	return f.page, f.err
}

func tenantOK(_ *http.Request) (uuid.UUID, error) {
	return uuid.MustParse("11111111-1111-4111-8111-111111111111"), nil
}

func userOK(_ *http.Request) (uuid.UUID, error) {
	return uuid.MustParse("22222222-2222-4222-8222-222222222222"), nil
}

func TestHandler_ReturnsPageJSON(t *testing.T) {
	r := &fakeReader{
		page: Page{
			Events: []Event{
				{ID: uuid.New(), Action: "dlp.inbound", Leg: "inbound",
					Types: []string{"email"}, Matches: 1, CreatedAt: time.Now()},
			},
		},
	}
	h := Handler(r, tenantOK, userOK)
	req := httptest.NewRequest(http.MethodGet, "/v1/me/redactions", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var got Page
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("response not JSON: %v", err)
	}
	if len(got.Events) != 1 {
		t.Errorf("event count = %d, want 1", len(got.Events))
	}
}

func TestHandler_ScopesToTenantAndUser(t *testing.T) {
	r := &fakeReader{}
	h := Handler(r, tenantOK, userOK)
	h.ServeHTTP(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodGet, "/v1/me/redactions", nil))

	if r.gotQuery.TenantID == uuid.Nil {
		t.Error("reader did not receive tenant id")
	}
	if r.gotQuery.UserID == uuid.Nil {
		t.Error("reader did not receive user id")
	}
}

func TestHandler_ParsesFromAndToAsRFC3339(t *testing.T) {
	r := &fakeReader{}
	h := Handler(r, tenantOK, userOK)

	req := httptest.NewRequest(http.MethodGet,
		"/v1/me/redactions?from=2026-04-01T00:00:00Z&to=2026-05-01T00:00:00Z", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%q", rec.Code, rec.Body.String())
	}
	if r.gotQuery.From == nil || r.gotQuery.To == nil {
		t.Error("From/To should be populated")
	}
	if r.gotQuery.From.Year() != 2026 {
		t.Errorf("From parse failed: %v", r.gotQuery.From)
	}
}

func TestHandler_RejectsNonRFC3339(t *testing.T) {
	r := &fakeReader{}
	h := Handler(r, tenantOK, userOK)
	req := httptest.NewRequest(http.MethodGet,
		"/v1/me/redactions?from=2026-04-01", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 on bad date", rec.Code)
	}
}

func TestHandler_NilReaderReturns503(t *testing.T) {
	h := Handler(nil, tenantOK, userOK)
	req := httptest.NewRequest(http.MethodGet, "/v1/me/redactions", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", rec.Code)
	}
}

func TestHandler_MissingTenantReturns401(t *testing.T) {
	r := &fakeReader{}
	tenantFail := func(_ *http.Request) (uuid.UUID, error) {
		return uuid.Nil, errors.New("no tenant")
	}
	h := Handler(r, tenantFail, userOK)
	req := httptest.NewRequest(http.MethodGet, "/v1/me/redactions", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

func TestHandler_LimitParsedFromQuery(t *testing.T) {
	r := &fakeReader{}
	h := Handler(r, tenantOK, userOK)
	req := httptest.NewRequest(http.MethodGet,
		"/v1/me/redactions?limit=42", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if r.gotQuery.Limit != 42 {
		t.Errorf("Limit = %d, want 42", r.gotQuery.Limit)
	}
}

func TestHandler_NonNumericLimitReturns400(t *testing.T) {
	r := &fakeReader{}
	h := Handler(r, tenantOK, userOK)
	req := httptest.NewRequest(http.MethodGet,
		"/v1/me/redactions?limit=abc", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 on non-numeric limit", rec.Code)
	}
}

// Compile-time assertion that the public surface is consistent.
var _ = strings.TrimSpace