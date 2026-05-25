package handlers_test

// Behavior tests for the A3 RBAC gates on /v1/projects.
// Each test posts/deletes through the real Chi router (not calling handler
// funcs directly) so the middleware chain fires and the gate is the actual
// requirment under test, not just the handler logic.

import (
	"context"
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers"
	appmw "github.com/sdlc-ai/platform/services/gateway/internal/app/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
)

// stubPermEval satisfies appmw.PermissionEvaluator. allow controls the verdict.
type stubPermEval struct{ allow bool }

func (s stubPermEval) Allow(_ context.Context, _ uuid.UUID, _ rbac.Permission) (bool, error) {
	return s.allow, nil
}

// newRBACRouter returns a chi.Router with RBAC wired via eval and user_id
// injected into every request context via a leading middleware. This mirrors
// production: auth middleware sets user_id, then RBAC middleware reads it.
func newRBACRouter(tenantID, userID uuid.UUID, eval appmw.PermissionEvaluator) chi.Router {
	repo := newStubRepo()
	svc := projects.NewService(repo, stubClock{})
	rbacMW := appmw.NewRBAC(eval, nil)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), appmw.UserIDContextKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	handlers.MountProjects(r, handlers.ProjectsDeps{
		Service:    svc,
		RBAC:       rbacMW,
		TenantFrom: func(_ *http.Request) (uuid.UUID, error) { return tenantID, nil },
		UserFrom:   func(_ *http.Request) (uuid.UUID, error) { return userID, nil },
	})
	return r
}

// TestProjects_RBACDeny_Write403 proves that POST /v1/projects returns 403
// when the evaluator denies projects:write. The handler never runs.
func TestProjects_RBACDeny_Write403(t *testing.T) {
	tenant, user := uuid.New(), uuid.New()
	r := newRBACRouter(tenant, user, stubPermEval{allow: false})

	w := postJSON(r, "/v1/projects/", map[string]any{"Name": "Denied"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("want 403 when write denied, got %d: %s", w.Code, w.Body.String())
	}
}

// TestProjects_RBACAllow_WriteCreates201 proves that POST /v1/projects returns
// 201 when the evaluator grants projects:write. The full handler runs.
func TestProjects_RBACAllow_WriteCreates201(t *testing.T) {
	tenant, user := uuid.New(), uuid.New()
	r := newRBACRouter(tenant, user, stubPermEval{allow: true})

	w := postJSON(r, "/v1/projects/", map[string]any{"Name": "Permitted"})
	if w.Code != http.StatusCreated {
		t.Fatalf("want 201 when write allowed, got %d: %s", w.Code, w.Body.String())
	}
}

// TestProjects_RBACDeny_Delete403 proves that DELETE /v1/projects/{id} returns
// 403 when the evaluator denies projects:delete. RBAC fires before the service
// layer so the project need not exist in the repo.
func TestProjects_RBACDeny_Delete403(t *testing.T) {
	tenant, user := uuid.New(), uuid.New()
	r := newRBACRouter(tenant, user, stubPermEval{allow: false})

	w := doRequest(r, http.MethodDelete, "/v1/projects/"+uuid.New().String())
	if w.Code != http.StatusForbidden {
		t.Fatalf("want 403 when delete denied, got %d: %s", w.Code, w.Body.String())
	}
}

// TestProjects_RBACAllow_Read200 proves that GET /v1/projects returns 200 when
// the evaluator grants projects:read.
func TestProjects_RBACAllow_Read200(t *testing.T) {
	tenant, user := uuid.New(), uuid.New()
	r := newRBACRouter(tenant, user, stubPermEval{allow: true})

	w := doRequest(r, http.MethodGet, "/v1/projects/")
	if w.Code != http.StatusOK {
		t.Fatalf("want 200 when read allowed, got %d: %s", w.Code, w.Body.String())
	}
}
