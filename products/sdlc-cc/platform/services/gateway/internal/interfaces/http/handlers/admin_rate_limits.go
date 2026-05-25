// Admin endpoints for per-tenant rate-limit configuration.
//
// Day 7 of the production-ready roadmap.
//
//   GET  /admin/tenants/{id}/rate-limits  — list rules for the tenant
//   PUT  /admin/tenants/{id}/rate-limits  — replace the entire rule set
//
// Both endpoints require the `admin:rate_limit:write` permission via
// the RBAC middleware (Day 21). Until then the existing AdminAuth
// middleware gates these routes.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
)

// AdminRateLimitsDeps is what the handler needs from main.go.
// Keeps Dependencies free of every micro-feature wiring.
type AdminRateLimitsDeps struct {
	Admin AdminRateLimitWriter
	Audit AuditAppender
}

// AdminRateLimitWriter is satisfied by *ratelimit.AdminRepo. Defined as
// an interface so handler tests can supply an in-memory fake.
type AdminRateLimitWriter interface {
	List(ctx context.Context, tenantID uuid.UUID) ([]ratelimit.Rule, error)
	Replace(ctx context.Context, tenantID uuid.UUID, rules []ratelimit.Rule) error
}

// AuditAppender writes one row to the audit log. The real impl wraps
// repositories.AuditRepository; tests pass a fake.
type AuditAppender interface {
	Append(ctx context.Context, event AuditEvent) error
}

// AuditEvent is the minimal audit row written by these handlers.
type AuditEvent struct {
	ActorID   uuid.UUID
	TenantID  uuid.UUID
	Action    string
	Target    string
	Before    interface{}
	After     interface{}
	IP        string
	UserAgent string
	Timestamp time.Time
}

type rateLimitRuleDTO struct {
	RoutePattern      string `json:"route_pattern"`
	RequestsPerMinute int    `json:"requests_per_minute"`
	Burst             int    `json:"burst"`
}

type listRateLimitsResponse struct {
	TenantID uuid.UUID          `json:"tenant_id"`
	Rules    []rateLimitRuleDTO `json:"rules"`
}

type putRateLimitsRequest struct {
	Rules []rateLimitRuleDTO `json:"rules"`
}

// ListRateLimits returns every rate-limit rule configured for the tenant.
func ListRateLimits(deps AdminRateLimitsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := parseTenantPathParam(w, r)
		if !ok {
			return
		}
		rules, err := deps.Admin.List(r.Context(), tenantID)
		if err != nil {
			http.Error(w, "list failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, listRateLimitsResponse{
			TenantID: tenantID,
			Rules:    rulesToDTO(rules),
		})
	}
}

// PutRateLimits replaces the entire rule set for the tenant. Audited.
func PutRateLimits(deps AdminRateLimitsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := parseTenantPathParam(w, r)
		if !ok {
			return
		}
		var body putRateLimitsRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}
		rules := make([]ratelimit.Rule, 0, len(body.Rules))
		for _, dto := range body.Rules {
			rules = append(rules, ratelimit.Rule{
				TenantID:          tenantID,
				RoutePattern:      dto.RoutePattern,
				RequestsPerMinute: dto.RequestsPerMinute,
				Burst:             dto.Burst,
			})
		}
		before, _ := deps.Admin.List(r.Context(), tenantID)
		if err := deps.Admin.Replace(r.Context(), tenantID, rules); err != nil {
			if ratelimit.IsInvalidRule(err) {
				http.Error(w, err.Error(), http.StatusUnprocessableEntity)
				return
			}
			http.Error(w, "replace failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if deps.Audit != nil {
			_ = deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				TenantID:  tenantID,
				Action:    "rate_limit.replace",
				Target:    "rate_limits/" + tenantID.String(),
				Before:    rulesToDTO(before),
				After:     body.Rules,
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			})
		}
		writeJSON(w, http.StatusOK, listRateLimitsResponse{
			TenantID: tenantID,
			Rules:    body.Rules,
		})
	}
}

func parseTenantPathParam(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	raw := chi.URLParam(r, "id")
	tenantID, err := uuid.Parse(raw)
	if err != nil {
		http.Error(w, "tenant id must be a UUID", http.StatusBadRequest)
		return uuid.Nil, false
	}
	return tenantID, true
}

func rulesToDTO(rules []ratelimit.Rule) []rateLimitRuleDTO {
	out := make([]rateLimitRuleDTO, 0, len(rules))
	for _, r := range rules {
		out = append(out, rateLimitRuleDTO{
			RoutePattern:      r.RoutePattern,
			RequestsPerMinute: r.RequestsPerMinute,
			Burst:             r.Burst,
		})
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// actorIDFromCtx extracts the authenticated user from the request
// context; returns uuid.Nil when missing so audit row remains writable.
func actorIDFromCtx(r *http.Request) uuid.UUID {
	if v := r.Context().Value(actorIDKey{}); v != nil {
		if id, ok := v.(uuid.UUID); ok {
			return id
		}
	}
	return uuid.Nil
}

type actorIDKey struct{}
