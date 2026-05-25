// Per-tenant CMEK admin endpoint.
//
// PATCH /admin/tenants/{id}/cmek    body: {"kms_key_arn": "<arn or null>"}
// GET   /admin/tenants/{id}/cmek    returns the configured ARN (or null)
//
// RBAC: tenants:write on PATCH, tenants:read on GET. The admin UI's
// settings/encryption page consumes this. ARN format is validated
// loosely (non-empty, contains "kms" or starts with "arn:") because
// GCP / Azure equivalents may land later — strict AWS-only regex
// would lock us in.
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TenantCMEKDeps wires the handler against the live pgxpool. Pool is
// nil-tolerant so the route stays mounted in dev (returns 503).
type TenantCMEKDeps struct {
	Pool *pgxpool.Pool
	// Audit receives one row per PATCH (CMEK enable/disable). Nil in
	// dev; fail-closed in production.
	Audit AuditAppender
}

// CMEKRequest is the PATCH body. KMSKeyARN may be nil (clears CMEK)
// or a non-empty string (sets it). Empty string is treated as
// "missing field" and rejected — use null to disable.
type CMEKRequest struct {
	KMSKeyARN *string `json:"kms_key_arn"`
}

// CMEKResponse is the GET shape and the PATCH success body.
type CMEKResponse struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	KMSKeyARN *string   `json:"kms_key_arn"`
	Enabled   bool      `json:"enabled"`
}

// GetTenantCMEK handles GET /admin/tenants/{id}/cmek.
func GetTenantCMEK(deps TenantCMEKDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqID := uuid.New().String()
		if deps.Pool == nil {
			respondWithError(w, http.StatusServiceUnavailable, "NOT_CONFIGURED", "CMEK admin not wired", reqID)
			return
		}
		tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "tenant id must be uuid", reqID)
			return
		}
		arn, err := loadKEK(r.Context(), deps.Pool, tenantID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				respondWithError(w, http.StatusNotFound, "NOT_FOUND", "tenant not found", reqID)
				return
			}
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		renderJSON(w, http.StatusOK, CMEKResponse{
			TenantID: tenantID, KMSKeyARN: arn, Enabled: arn != nil,
		})
	}
}

// PatchTenantCMEK handles PATCH /admin/tenants/{id}/cmek.
func PatchTenantCMEK(deps TenantCMEKDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqID := uuid.New().String()
		if deps.Pool == nil {
			respondWithError(w, http.StatusServiceUnavailable, "NOT_CONFIGURED", "CMEK admin not wired", reqID)
			return
		}
		tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "tenant id must be uuid", reqID)
			return
		}
		var req CMEKRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid JSON body", reqID)
			return
		}
		// Empty string is suspicious: caller likely meant null.
		if req.KMSKeyARN != nil && *req.KMSKeyARN == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR",
				"kms_key_arn must be null (to disable) or a non-empty ARN", reqID)
			return
		}
		if req.KMSKeyARN != nil && !looksLikeKEK(*req.KMSKeyARN) {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR",
				"kms_key_arn must be an AWS KMS ARN, GCP resource name, or Azure Key Vault URL", reqID)
			return
		}
		if _, err := deps.Pool.Exec(r.Context(),
			`UPDATE tenants SET kms_key_arn = $1, updated_at = NOW() WHERE id = $2`,
			req.KMSKeyARN, tenantID,
		); err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if deps.Audit != nil {
			if err := deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				TenantID:  tenantID,
				Action:    "tenant.cmek.update",
				Target:    "tenants/" + tenantID.String() + "/cmek",
				After:     map[string]any{"enabled": req.KMSKeyARN != nil},
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				respondWithError(w, http.StatusInternalServerError, "AUDIT_ERROR", "audit write failed: "+err.Error(), reqID)
				return
			}
		}
		renderJSON(w, http.StatusOK, CMEKResponse{
			TenantID: tenantID, KMSKeyARN: req.KMSKeyARN, Enabled: req.KMSKeyARN != nil,
		})
	}
}

// looksLikeKEK is a deliberately loose validator covering AWS / GCP
// / Azure KEK identifier shapes. Strict AWS-only regex would block
// the multi-cloud direction tenants.kms_key_arn already supports.
func looksLikeKEK(s string) bool {
	s = strings.TrimSpace(s)
	switch {
	case strings.HasPrefix(s, "arn:aws:kms:"):
		return true // AWS KMS ARN
	case strings.HasPrefix(s, "projects/") && strings.Contains(s, "/cryptoKeys/"):
		return true // GCP KMS resource name
	case strings.HasPrefix(s, "https://") && strings.Contains(s, ".vault.azure.net/keys/"):
		return true // Azure Key Vault URL
	}
	return false
}

func loadKEK(ctx context.Context, pool *pgxpool.Pool, tenantID uuid.UUID) (*string, error) {
	var arn *string
	err := pool.QueryRow(ctx,
		`SELECT kms_key_arn FROM tenants WHERE id = $1`, tenantID,
	).Scan(&arn)
	return arn, err
}
