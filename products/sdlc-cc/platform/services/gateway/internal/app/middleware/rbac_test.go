package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
)

type fakeEvaluator struct {
	allow bool
	err   error
	calls int
}

func (f *fakeEvaluator) Allow(_ context.Context, _ uuid.UUID, _ rbac.Permission) (bool, error) {
	f.calls++
	return f.allow, f.err
}

type fakeAudit struct {
	mu   sync.Mutex
	rows []audit.Row
}

func (f *fakeAudit) AppendAsync(row audit.Row) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rows = append(f.rows, row)
	return nil
}

func newAuthedRequest(uid uuid.UUID) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/audit", nil)
	ctx := context.WithValue(req.Context(), UserIDContextKey, uid)
	ctx = context.WithValue(ctx, TenantIDContextKey, uuid.New())
	return req.WithContext(ctx)
}

func TestRequirePermission_AllowsWhenEvaluatorAllows(t *testing.T) {
	eval := &fakeEvaluator{allow: true}
	au := &fakeAudit{}
	mw := NewRBAC(eval, au).RequirePermission("audit:read")

	called := false
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newAuthedRequest(uuid.New()))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if !called {
		t.Fatal("next handler must run on allow")
	}
	if eval.calls != 1 {
		t.Fatalf("evaluator must be queried once, got %d", eval.calls)
	}
	if len(au.rows) != 1 || au.rows[0].Action != "rbac.allow" {
		t.Fatalf("expected one rbac.allow audit row, got %+v", au.rows)
	}
}

func TestRequirePermission_403WhenEvaluatorDenies(t *testing.T) {
	eval := &fakeEvaluator{allow: false}
	au := &fakeAudit{}
	mw := NewRBAC(eval, au).RequirePermission("audit:read")

	h := mw(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("next must NOT run on deny")
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newAuthedRequest(uuid.New()))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
	if len(au.rows) != 1 || au.rows[0].Action != "rbac.deny" {
		t.Fatalf("expected one rbac.deny audit row, got %+v", au.rows)
	}
}

func TestRequirePermission_401WhenUnauthenticated(t *testing.T) {
	eval := &fakeEvaluator{allow: true}
	mw := NewRBAC(eval, nil).RequirePermission("audit:read")

	h := mw(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("next must NOT run for unauthenticated")
	}))

	req := httptest.NewRequest(http.MethodGet, "/audit", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	if eval.calls != 0 {
		t.Fatal("evaluator must not be queried without a user")
	}
}

func TestRequirePermission_500OnEvaluatorError(t *testing.T) {
	eval := &fakeEvaluator{err: errors.New("db down")}
	mw := NewRBAC(eval, nil).RequirePermission("audit:read")
	h := mw(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("next must NOT run on evaluator error")
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newAuthedRequest(uuid.New()))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}

func TestRequirePermission_LegacyStringKeyContext(t *testing.T) {
	// Legacy audit middleware uses untyped "user_id" / "tenant_id" keys.
	eval := &fakeEvaluator{allow: true}
	mw := NewRBAC(eval, nil).RequirePermission("audit:read")
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(req.Context(), "user_id", uuid.New())
	ctx = context.WithValue(ctx, "tenant_id", uuid.New())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Fatalf("legacy keys must work, got %d", rec.Code)
	}
}
