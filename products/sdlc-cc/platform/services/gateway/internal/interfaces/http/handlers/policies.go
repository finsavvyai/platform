// BEAT-PLAN S2.2 — tenant-scoped policy CRUD with Rego syntax validation.
//
// On every Create/Update we run policy.SyntaxValidator before persistence;
// invalid Rego returns 400 + {module, line, column, message} so the
// admin UI can underline the failing token. The repository handles
// soft-delete + RLS-scoped reads.
package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy"
)

// PolicyRequest is the create/update body. PolicyData is raw Rego
// source — not base64 — so admin UIs can post the textarea contents
// directly. Description is optional. Type defaults to "rego".
type PolicyRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	PolicyType  string `json:"policy_type,omitempty"`
	PolicyData  string `json:"policy_data"`
}

// SyntaxErrorBody is the 400 shape when SyntaxValidator rejects the
// Rego source. Joined errors flatten into the slice so the admin UI
// can highlight every diagnostic at once.
type SyntaxErrorBody struct {
	Code    string             `json:"code"`
	Message string             `json:"message"`
	Errors  []SyntaxErrorItem  `json:"errors"`
}

// SyntaxErrorItem is one validator finding.
type SyntaxErrorItem struct {
	Module  string `json:"module"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Message string `json:"message"`
}

// ListPolicies returns all non-deleted policies for the tenant.
func ListPolicies(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "ListPolicies")
		defer span.End()
		reqID := uuid.New().String()
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "tenant context missing", reqID)
			return
		}
		repo := policyRepo(deps)
		if repo == nil {
			respondWithError(w, http.StatusServiceUnavailable, "NOT_CONFIGURED", "policy repository not configured", reqID)
			return
		}
		rows, err := repo.ListPoliciesWithMetadata(r.Context(), tenantID)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		renderJSON(w, http.StatusOK, map[string]any{"data": rows, "meta": map[string]any{"request_id": reqID}})
	}
}

// CreatePolicy validates the Rego source then persists.
func CreatePolicy(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "CreatePolicy")
		defer span.End()
		reqID := uuid.New().String()
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "tenant context missing", reqID)
			return
		}
		repo := policyRepo(deps)
		if repo == nil {
			respondWithError(w, http.StatusServiceUnavailable, "NOT_CONFIGURED", "policy repository not configured", reqID)
			return
		}
		var req PolicyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid JSON body", reqID)
			return
		}
		if req.Name == "" || req.PolicyData == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "name and policy_data are required", reqID)
			return
		}
		ptype := req.PolicyType
		if ptype == "" {
			ptype = "rego"
		}
		if ptype == "rego" {
			if err := validateRego(deps, req.Name, req.PolicyData); err != nil {
				writeSyntaxError(w, err, reqID)
				return
			}
		}
		actor, _ := userFromCtx(r.Context())
		sum := sha256.Sum256([]byte(req.PolicyData))
		meta := &storage.PolicyMetadata{
			TenantID:    tenantID,
			Name:        req.Name,
			Description: req.Description,
			PolicyType:  ptype,
			PolicyData:  []byte(req.PolicyData),
			Version:     1,
			IsActive:    true,
			CreatedBy:   actor,
			Checksum:    hex.EncodeToString(sum[:]),
		}
		if err := repo.CreatePolicy(r.Context(), meta); err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if deps.Audit != nil {
			if err := deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actor,
				TenantID:  tenantID,
				Action:    "policy.create",
				Target:    "policies/" + req.Name,
				After:     map[string]any{"name": req.Name, "type": ptype},
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				respondWithError(w, http.StatusInternalServerError, "AUDIT_ERROR", "audit write failed: "+err.Error(), reqID)
				return
			}
		}
		renderJSON(w, http.StatusCreated, map[string]any{"data": meta, "meta": map[string]any{"request_id": reqID}})
	}
}

// GetPolicy returns one policy by name.
func GetPolicy(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetPolicy")
		defer span.End()
		reqID := uuid.New().String()
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "tenant context missing", reqID)
			return
		}
		repo := policyRepo(deps)
		name := chi.URLParam(r, "id")
		row, err := repo.GetPolicyWithMetadata(r.Context(), tenantID, name)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", err.Error(), reqID)
			return
		}
		renderJSON(w, http.StatusOK, map[string]any{"data": row, "meta": map[string]any{"request_id": reqID}})
	}
}

// UpdatePolicy revalidates the Rego source then writes via SavePolicy
// (upsert), bumping the version.
func UpdatePolicy(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "UpdatePolicy")
		defer span.End()
		reqID := uuid.New().String()
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "tenant context missing", reqID)
			return
		}
		repo := policyRepo(deps)
		name := chi.URLParam(r, "id")
		var req PolicyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid JSON body", reqID)
			return
		}
		if req.PolicyData == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "policy_data is required", reqID)
			return
		}
		if err := validateRego(deps, name, req.PolicyData); err != nil {
			writeSyntaxError(w, err, reqID)
			return
		}
		if err := repo.SavePolicy(r.Context(), tenantID, name, []byte(req.PolicyData)); err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if deps.Audit != nil {
			actor, _ := userFromCtx(r.Context())
			if err := deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actor,
				TenantID:  tenantID,
				Action:    "policy.update",
				Target:    "policies/" + name,
				After:     map[string]any{"name": name},
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				respondWithError(w, http.StatusInternalServerError, "AUDIT_ERROR", "audit write failed: "+err.Error(), reqID)
				return
			}
		}
		renderJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"name": name, "tenant_id": tenantID}, "meta": map[string]any{"request_id": reqID}})
	}
}

// DeletePolicy soft-deletes by name.
func DeletePolicy(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "DeletePolicy")
		defer span.End()
		reqID := uuid.New().String()
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "tenant context missing", reqID)
			return
		}
		repo := policyRepo(deps)
		name := chi.URLParam(r, "id")
		if err := repo.DeletePolicy(r.Context(), tenantID, name); err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if deps.Audit != nil {
			actor, _ := userFromCtx(r.Context())
			if err := deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actor,
				TenantID:  tenantID,
				Action:    "policy.delete",
				Target:    "policies/" + name,
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				respondWithError(w, http.StatusInternalServerError, "AUDIT_ERROR", "audit write failed: "+err.Error(), reqID)
				return
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// validateRego runs SyntaxValidator if Dependencies has one wired.
// nil validator = skip (dev convenience).
func validateRego(deps *Dependencies, module, src string) error {
	v := syntaxValidator(deps)
	if v == nil {
		return nil
	}
	return v.Validate(module, src)
}

// writeSyntaxError flattens errors.Join'd *policy.SyntaxError values
// into a 400 body the admin UI can render.
func writeSyntaxError(w http.ResponseWriter, err error, reqID string) {
	body := SyntaxErrorBody{Code: "INVALID_REGO", Message: "policy failed Rego validation"}
	for {
		var se *policy.SyntaxError
		if errors.As(err, &se) {
			body.Errors = append(body.Errors, SyntaxErrorItem{Module: se.Module, Line: se.Line, Column: se.Column, Message: se.Message})
		}
		u, ok := err.(interface{ Unwrap() []error })
		if !ok {
			break
		}
		errs := u.Unwrap()
		if len(errs) == 0 {
			break
		}
		body.Errors = nil
		for _, e := range errs {
			var se *policy.SyntaxError
			if errors.As(e, &se) {
				body.Errors = append(body.Errors, SyntaxErrorItem{Module: se.Module, Line: se.Line, Column: se.Column, Message: se.Message})
			}
		}
		break
	}
	if len(body.Errors) == 0 {
		body.Errors = []SyntaxErrorItem{{Message: err.Error()}}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": body, "meta": map[string]any{"request_id": reqID}})
}

// policyRepo + syntaxValidator + tenantFromCtx + userFromCtx pull from
// Dependencies via a small registration shim so callers that build
// *Dependencies don't break. Real wiring (cmd/server) populates these
// via SetPolicyDeps.
func policyRepo(deps *Dependencies) *storage.PolicyRepository       { return deps.PolicyRepo }
func syntaxValidator(deps *Dependencies) *policy.SyntaxValidator    { return deps.SyntaxValidator }
func tenantFromCtx(ctx context.Context) (uuid.UUID, bool) {
	if v, ok := ctx.Value(ctxKey("tenant_id")).(string); ok {
		if id, err := uuid.Parse(v); err == nil {
			return id, true
		}
	}
	if v, ok := ctx.Value("tenant_id").(string); ok {
		if id, err := uuid.Parse(v); err == nil {
			return id, true
		}
	}
	return uuid.Nil, false
}
func userFromCtx(ctx context.Context) (uuid.UUID, bool) {
	if v, ok := ctx.Value(ctxKey("user_id")).(uuid.UUID); ok {
		return v, true
	}
	return uuid.Nil, false
}

type ctxKey string
