// Admin endpoints for per-tenant BYOK credential enrollment.
// Claude Team A3 closeout. RBAC-gated by the caller via
// `admin:billing:write` (set + delete) and `admin:billing:read` for
// the existence probe.
package byok_admin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/byok"
)

// Repo is the write-side of byok.PgxRepo we depend on. Kept narrow
// so tests can fake it without standing up Postgres.
type Repo interface {
	Set(ctx context.Context, tenantID uuid.UUID, provider, apiKey string) error
	Delete(ctx context.Context, tenantID uuid.UUID, provider string) error
}

// Mount attaches /admin/tenants/{tenant_id}/provider-credentials/{provider}
// onto r. The handler accepts PUT (upsert) and DELETE (rotate-back-
// to-platform) operations. Read-side reveal is intentionally NOT
// exposed — once the key is sealed, only the gateway can unseal it
// and that's only on the upstream-call hot path.
func Mount(r chi.Router, repo Repo) {
	if repo == nil {
		// No repo wired — admin endpoint returns 503 so operators
		// learn at probe time that BYOK is disabled.
		r.Method(http.MethodPut,
			"/admin/tenants/{tenant_id}/provider-credentials/{provider}",
			notConfigured())
		r.Method(http.MethodDelete,
			"/admin/tenants/{tenant_id}/provider-credentials/{provider}",
			notConfigured())
		return
	}
	r.Method(http.MethodPut,
		"/admin/tenants/{tenant_id}/provider-credentials/{provider}",
		setHandler(repo))
	r.Method(http.MethodDelete,
		"/admin/tenants/{tenant_id}/provider-credentials/{provider}",
		deleteHandler(repo))
}

type setBody struct {
	APIKey string `json:"api_key"`
}

// setHandler upserts the per-tenant credential. Returns 204 on
// success; 400 on missing api_key; 500 on storage failure.
func setHandler(repo Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := tenantFromPath(r)
		if !ok {
			writeJSONError(w, http.StatusBadRequest, "invalid tenant id")
			return
		}
		provider := chi.URLParam(r, "provider")
		if provider == "" {
			writeJSONError(w, http.StatusBadRequest, "provider required")
			return
		}
		var body setBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if body.APIKey == "" {
			writeJSONError(w, http.StatusBadRequest, "api_key required")
			return
		}
		if err := repo.Set(r.Context(), tenantID, provider, body.APIKey); err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// deleteHandler removes the per-tenant credential. Returns 204 on
// success and on missing rows (idempotent).
func deleteHandler(repo Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := tenantFromPath(r)
		if !ok {
			writeJSONError(w, http.StatusBadRequest, "invalid tenant id")
			return
		}
		provider := chi.URLParam(r, "provider")
		if provider == "" {
			writeJSONError(w, http.StatusBadRequest, "provider required")
			return
		}
		if err := repo.Delete(r.Context(), tenantID, provider); err != nil {
			if errors.Is(err, byok.ErrNotConfigured) {
				w.WriteHeader(http.StatusNoContent) // idempotent
				return
			}
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func notConfigured() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSONError(w, http.StatusServiceUnavailable,
			"BYOK_ENCRYPTION_KEY not configured on gateway")
	}
}

func tenantFromPath(r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "tenant_id"))
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]string{"message": message},
	})
}
