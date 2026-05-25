package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
)

type fakeAdminRepo struct {
	mu       sync.Mutex
	store    map[uuid.UUID][]ratelimit.Rule
	failNext error
}

func newFakeAdminRepo() *fakeAdminRepo {
	return &fakeAdminRepo{store: make(map[uuid.UUID][]ratelimit.Rule)}
}

func (f *fakeAdminRepo) List(_ context.Context, tenantID uuid.UUID) ([]ratelimit.Rule, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failNext != nil {
		err := f.failNext
		f.failNext = nil
		return nil, err
	}
	dst := make([]ratelimit.Rule, len(f.store[tenantID]))
	copy(dst, f.store[tenantID])
	return dst, nil
}

func (f *fakeAdminRepo) Replace(_ context.Context, tenantID uuid.UUID, rules []ratelimit.Rule) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failNext != nil {
		err := f.failNext
		f.failNext = nil
		return err
	}
	for i, rule := range rules {
		if err := ratelimit.ValidateRule(rule); err != nil {
			return err
		}
		_ = i
	}
	f.store[tenantID] = append([]ratelimit.Rule(nil), rules...)
	return nil
}

type fakeAudit struct {
	mu     sync.Mutex
	events []AuditEvent
}

func (a *fakeAudit) Append(_ context.Context, ev AuditEvent) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.events = append(a.events, ev)
	return nil
}

func mountRouter(repo AdminRateLimitWriter, audit AuditAppender) http.Handler {
	deps := AdminRateLimitsDeps{Admin: repo, Audit: audit}
	r := chi.NewRouter()
	r.Get("/admin/tenants/{id}/rate-limits", ListRateLimits(deps))
	r.Put("/admin/tenants/{id}/rate-limits", PutRateLimits(deps))
	return r
}

func TestList_EmptyTenantReturnsEmpty(t *testing.T) {
	repo := newFakeAdminRepo()
	tenantID := uuid.New()
	rr := httptest.NewRecorder()
	mountRouter(repo, nil).ServeHTTP(
		rr,
		httptest.NewRequest(http.MethodGet, "/admin/tenants/"+tenantID.String()+"/rate-limits", nil),
	)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d", rr.Code)
	}
	var body listRateLimitsResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Rules) != 0 || body.TenantID != tenantID {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestPut_ReplacesAllRules_AuditAppended(t *testing.T) {
	repo := newFakeAdminRepo()
	audit := &fakeAudit{}
	tenantID := uuid.New()

	put := putRateLimitsRequest{
		Rules: []rateLimitRuleDTO{
			{RoutePattern: "/v1/rag/query", RequestsPerMinute: 60, Burst: 10},
			{RoutePattern: "*", RequestsPerMinute: 600, Burst: 100},
		},
	}
	body, _ := json.Marshal(put)
	req := httptest.NewRequest(http.MethodPut, "/admin/tenants/"+tenantID.String()+"/rate-limits", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mountRouter(repo, audit).ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status: want 200 got %d, body=%s", rr.Code, rr.Body.String())
	}

	stored, _ := repo.List(context.Background(), tenantID)
	if len(stored) != 2 {
		t.Fatalf("expected 2 rules persisted, got %d", len(stored))
	}
	if len(audit.events) != 1 {
		t.Fatalf("expected 1 audit event, got %d", len(audit.events))
	}
	if audit.events[0].Action != "rate_limit.replace" || audit.events[0].TenantID != tenantID {
		t.Fatalf("audit event mismatch: %+v", audit.events[0])
	}
}

func TestPut_RejectsInvalidRoutePattern(t *testing.T) {
	repo := newFakeAdminRepo()
	tenantID := uuid.New()

	put := putRateLimitsRequest{
		Rules: []rateLimitRuleDTO{
			{RoutePattern: "no-leading-slash", RequestsPerMinute: 60, Burst: 10},
		},
	}
	body, _ := json.Marshal(put)
	req := httptest.NewRequest(http.MethodPut, "/admin/tenants/"+tenantID.String()+"/rate-limits", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	mountRouter(repo, &fakeAudit{}).ServeHTTP(rr, req)
	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid pattern: want 422 got %d, body=%s", rr.Code, rr.Body.String())
	}
}

func TestPut_RejectsBurstAboveLimitTimes10(t *testing.T) {
	repo := newFakeAdminRepo()
	tenantID := uuid.New()

	put := putRateLimitsRequest{
		Rules: []rateLimitRuleDTO{
			{RoutePattern: "/v1/q", RequestsPerMinute: 10, Burst: 200},
		},
	}
	body, _ := json.Marshal(put)
	req := httptest.NewRequest(http.MethodPut, "/admin/tenants/"+tenantID.String()+"/rate-limits", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	mountRouter(repo, &fakeAudit{}).ServeHTTP(rr, req)
	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("burst too high: want 422 got %d", rr.Code)
	}
}

func TestPut_RejectsNonUUIDTenant(t *testing.T) {
	rr := httptest.NewRecorder()
	mountRouter(newFakeAdminRepo(), &fakeAudit{}).ServeHTTP(
		rr,
		httptest.NewRequest(http.MethodPut, "/admin/tenants/not-a-uuid/rate-limits", bytes.NewReader([]byte("{}"))),
	)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("non-uuid tenant: want 400 got %d", rr.Code)
	}
}

func TestPut_RejectsBadJSON(t *testing.T) {
	tenantID := uuid.New()
	rr := httptest.NewRecorder()
	mountRouter(newFakeAdminRepo(), &fakeAudit{}).ServeHTTP(
		rr,
		httptest.NewRequest(http.MethodPut, "/admin/tenants/"+tenantID.String()+"/rate-limits", bytes.NewReader([]byte("not json"))),
	)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("bad JSON: want 400 got %d", rr.Code)
	}
}
