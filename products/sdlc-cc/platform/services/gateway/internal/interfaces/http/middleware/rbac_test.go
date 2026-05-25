package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
)

type loaderFn func(context.Context, uuid.UUID) ([]rbac.Permission, error)

func (f loaderFn) LoadPermissions(ctx context.Context, id uuid.UUID) ([]rbac.Permission, error) {
	return f(ctx, id)
}

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestRequirePermission_Allows(t *testing.T) {
	uid := uuid.New()
	loader := loaderFn(func(_ context.Context, _ uuid.UUID) ([]rbac.Permission, error) {
		return []rbac.Permission{"rate_limit:write"}, nil
	})
	mw := RequirePermission(RBACConfig{
		Evaluator: rbac.NewEvaluator(loader, time.Minute),
		GetUser:   func(_ context.Context) (uuid.UUID, bool) { return uid, true },
	}, "rate_limit:write")

	rr := httptest.NewRecorder()
	mw(okHandler()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rr.Code)
	}
}

func TestRequirePermission_403OnMissingPermission(t *testing.T) {
	uid := uuid.New()
	loader := loaderFn(func(_ context.Context, _ uuid.UUID) ([]rbac.Permission, error) {
		return []rbac.Permission{"audit:read"}, nil
	})
	mw := RequirePermission(RBACConfig{
		Evaluator: rbac.NewEvaluator(loader, time.Minute),
		GetUser:   func(_ context.Context) (uuid.UUID, bool) { return uid, true },
	}, "rate_limit:write")

	rr := httptest.NewRecorder()
	mw(okHandler()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rr.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d", rr.Code)
	}
}

func TestRequirePermission_401WhenNoUser(t *testing.T) {
	mw := RequirePermission(RBACConfig{
		Evaluator: rbac.NewEvaluator(loaderFn(func(_ context.Context, _ uuid.UUID) ([]rbac.Permission, error) {
			return nil, nil
		}), time.Minute),
		GetUser: func(_ context.Context) (uuid.UUID, bool) { return uuid.Nil, false },
	}, "rate_limit:write")

	rr := httptest.NewRecorder()
	mw(okHandler()).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rr.Code)
	}
}
