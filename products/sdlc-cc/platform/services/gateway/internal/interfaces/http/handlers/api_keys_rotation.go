// Day-9 API key rotation + revoke endpoints.
//
// Mounted at /v1/api-keys/{id}/rotate and /v1/api-keys/{id}/revoke
// from routes/admin_routes.go. Both require RBAC: api_keys:write to
// rotate, api_keys:delete to revoke.
//
// Rotate returns the plaintext of the new key in the response body
// exactly once — the caller MUST surface it to the user immediately
// since the gateway only persists the hash.
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/auth"
)

// APIKeyRotator is satisfied by *auth.Rotator. Defined as an interface
// so the test can mock without standing up a *sql.DB.
type APIKeyRotator interface {
	Rotate(ctx context.Context, oldKeyID uuid.UUID, gracePeriod time.Duration) (*auth.IssuedKey, error)
	Revoke(ctx context.Context, keyID uuid.UUID) error
}

// APIKeyRotateDeps wires the handler factory.
type APIKeyRotateDeps struct {
	Rotator APIKeyRotator
	// Audit receives one row per rotate/revoke. Nil-tolerant in dev;
	// in production the AppendCritical path is fail-closed.
	Audit AuditAppender
}

// RotateAPIKey handles POST /v1/api-keys/{id}/rotate.
//
// Body (optional): {"grace_seconds": 300}. Default = Rotator's
// configured grace window.
//
// Response: 200 + {id, plaintext, prefix} — plaintext returned ONCE.
func RotateAPIKey(deps APIKeyRotateDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqID := uuid.New().String()
		if deps.Rotator == nil {
			respondWithError(w, http.StatusServiceUnavailable, "NOT_CONFIGURED", "api-key rotator not wired", reqID)
			return
		}
		idParam := chi.URLParam(r, "id")
		oldID, err := uuid.Parse(idParam)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "id must be a uuid", reqID)
			return
		}
		var body struct {
			GraceSeconds int `json:"grace_seconds,omitempty"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body) // body is optional
		grace := time.Duration(body.GraceSeconds) * time.Second

		issued, err := deps.Rotator.Rotate(r.Context(), oldID, grace)
		if err != nil {
			if errors.Is(err, auth.ErrKeyNotFound) {
				respondWithError(w, http.StatusNotFound, "NOT_FOUND", "api key not found", reqID)
				return
			}
			if errors.Is(err, auth.ErrKeyAlreadyRevoked) {
				respondWithError(w, http.StatusConflict, "REVOKED", "api key already revoked", reqID)
				return
			}
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if deps.Audit != nil {
			if err := deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				Action:    "api_key.rotate",
				Target:    "api_keys/" + oldID.String(),
				After:     map[string]any{"new_id": issued.ID, "prefix": issued.Prefix},
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				respondWithError(w, http.StatusInternalServerError, "AUDIT_ERROR", "audit write failed: "+err.Error(), reqID)
				return
			}
		}
		renderJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{
				"id":        issued.ID,
				"plaintext": issued.Plaintext,
				"prefix":    issued.Prefix,
			},
			"meta": map[string]any{"request_id": reqID, "warning": "store the plaintext now; it cannot be retrieved later"},
		})
	}
}

// RevokeAPIKeyHandler handles POST /v1/api-keys/{id}/revoke. Distinct
// from the existing RevokeAPIKey stub in stubs.go (which still returns
// NOT_IMPLEMENTED for the /admin/api-keys CRUD path) — this one wraps
// the real *auth.Rotator and is wired by admin_routes.go.
func RevokeAPIKeyHandler(deps APIKeyRotateDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqID := uuid.New().String()
		if deps.Rotator == nil {
			respondWithError(w, http.StatusServiceUnavailable, "NOT_CONFIGURED", "api-key rotator not wired", reqID)
			return
		}
		idParam := chi.URLParam(r, "id")
		keyID, err := uuid.Parse(idParam)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "id must be a uuid", reqID)
			return
		}
		if err := deps.Rotator.Revoke(r.Context(), keyID); err != nil {
			if errors.Is(err, auth.ErrKeyAlreadyRevoked) {
				respondWithError(w, http.StatusConflict, "REVOKED", "api key already revoked", reqID)
				return
			}
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if deps.Audit != nil {
			if err := deps.Audit.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				Action:    "api_key.revoke",
				Target:    "api_keys/" + keyID.String(),
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
