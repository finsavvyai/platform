// Package middleware provides RBAC enforcement that gates routes by
// fine-grained permissions. The middleware is intentionally
// independent of the auth strategy: it pulls user_id + tenant_id off
// the request context (the keys other middleware in this gateway
// already populate) and asks the rbac.Evaluator (or its cached
// variant) for a decision.
//
// Day 22 of the production-ready roadmap.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/rbac"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
)

// PermissionEvaluator is the minimal surface RequirePermission needs.
// Both *rbac.Evaluator and *rbac.CachedEvaluator satisfy it.
type PermissionEvaluator interface {
	Allow(ctx context.Context, userID uuid.UUID, required rbac.Permission) (bool, error)
}

// AuditAppender is the audit hook surface. *audit.Writer satisfies it
// via AppendAsync; tests pass an in-memory implementation.
type AuditAppender interface {
	AppendAsync(row audit.Row) error
}

// RBAC bundles the dependencies the middleware needs. Construct once
// at startup and reuse across routes.
type RBAC struct {
	Eval  PermissionEvaluator
	Audit AuditAppender // optional; nil disables audit emission
	Now   func() time.Time
}

// NewRBAC wires an RBAC middleware factory.
func NewRBAC(eval PermissionEvaluator, auditW AuditAppender) *RBAC {
	return &RBAC{Eval: eval, Audit: auditW, Now: time.Now}
}

// RequirePermission returns middleware that allows the request only
// when the authenticated user has perm. Denies emit a 403 with a
// stable JSON body and (when an audit appender is configured) an
// audit row.
func (r *RBAC) RequirePermission(perm string) func(http.Handler) http.Handler {
	required := rbac.Permission(perm)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			userID, ok := userIDFromContext(req.Context())
			if !ok {
				writeRBACError(w, http.StatusUnauthorized, "unauthorized",
					"authentication required")
				return
			}
			tenantID, _ := tenantIDFromContext(req.Context())

			allowed, err := r.Eval.Allow(req.Context(), userID, required)
			if err != nil {
				writeRBACError(w, http.StatusInternalServerError, "rbac_error",
					"permission check failed")
				return
			}
			if !allowed {
				r.audit(req, tenantID, userID, perm, "deny")
				writeRBACError(w, http.StatusForbidden, "forbidden",
					"permission denied: "+perm)
				return
			}
			r.audit(req, tenantID, userID, perm, "allow")
			next.ServeHTTP(w, req)
		})
	}
}

func (r *RBAC) audit(req *http.Request, tenantID, userID uuid.UUID, perm, decision string) {
	if r.Audit == nil {
		return
	}
	now := time.Now
	if r.Now != nil {
		now = r.Now
	}
	uid := userID
	row := audit.Row{
		TenantID:   tenantID,
		ActorID:    &uid,
		ActorType:  "user",
		Action:     "rbac." + decision,
		TargetType: "permission",
		TargetID:   perm,
		After: map[string]string{
			"path":       req.URL.Path,
			"method":     req.Method,
			"permission": perm,
			"decision":   decision,
		},
		CreatedAt: now(),
	}
	_ = r.Audit.AppendAsync(row)
}

// userIDFromContext supports both the typed key the auth middleware
// is moving toward and the legacy string key the audit middleware
// reads. Returns false when neither is present.
func userIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	if v, ok := ctx.Value(UserIDContextKey).(uuid.UUID); ok && v != uuid.Nil {
		return v, true
	}
	if v, ok := ctx.Value("user_id").(uuid.UUID); ok && v != uuid.Nil {
		return v, true
	}
	if s, ok := ctx.Value("user_id").(string); ok && s != "" {
		if id, err := uuid.Parse(s); err == nil {
			return id, true
		}
	}
	return uuid.Nil, false
}

func tenantIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	if v, ok := ctx.Value(TenantIDContextKey).(uuid.UUID); ok && v != uuid.Nil {
		return v, true
	}
	if v, ok := ctx.Value("tenant_id").(uuid.UUID); ok && v != uuid.Nil {
		return v, true
	}
	if s, ok := ctx.Value("tenant_id").(string); ok && s != "" {
		if id, err := uuid.Parse(s); err == nil {
			return id, true
		}
	}
	return uuid.Nil, false
}

// rbacCtxKey is the typed key constant the middleware writes/reads.
type rbacCtxKey string

// UserIDContextKey + TenantIDContextKey are the canonical typed keys
// for context values. Other middleware can adopt these to migrate
// off the string-keyed legacy.
const (
	UserIDContextKey   rbacCtxKey = "rbac.user_id"
	TenantIDContextKey rbacCtxKey = "rbac.tenant_id"
)

func writeRBACError(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":   code,
		"message": msg,
	})
}
