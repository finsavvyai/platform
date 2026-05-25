// Admin endpoints for applying DLP policy templates to a tenant.
// Claude Team D2 closeout. The handler exposes:
//   GET  /admin/dlp-templates                       — list templates
//   POST /admin/tenants/{tenant_id}/dlp-policy/template/{name}
//                                                   — apply template to tenant
// RBAC: gating left to caller (admin:dlp:write); the handler
// itself is composable.
package dlp_template_admin

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/policy/templates"
)

// Repo is the write-side contract used to apply a template. Kept
// narrow so tests can fake it without standing up Postgres.
type Repo interface {
	UpsertPolicy(ctx context.Context, tenantID uuid.UUID,
		action middleware.Action,
		image middleware.ImagePolicy,
		patterns []middleware.CustomPatternSpec) error
}

// Mount attaches the routes on r. nil repo => apply endpoint 503s
// with a clear message; the listing endpoint stays available
// because it doesn't touch Postgres.
func Mount(r chi.Router, repo Repo) {
	r.Method(http.MethodGet, "/admin/dlp-templates", listHandler())
	if repo == nil {
		r.Method(http.MethodPost,
			"/admin/tenants/{tenant_id}/dlp-policy/template/{name}",
			notConfigured())
		return
	}
	r.Method(http.MethodPost,
		"/admin/tenants/{tenant_id}/dlp-policy/template/{name}",
		applyHandler(repo))
}

// listHandler returns the template catalog so the admin UI can
// render a picker. Output shape mirrors the Template struct minus
// the regex bodies (operators view those via /docs/templates).
func listHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		all := templates.All()
		out := make([]map[string]any, 0, len(all))
		for _, t := range all {
			out = append(out, map[string]any{
				"name":         t.Name,
				"description":  t.Description,
				"action":       string(t.Action),
				"image_policy": string(t.ImagePolicy),
				"pattern_count": len(t.CustomPatterns),
			})
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"templates": out})
	}
}

// applyHandler upserts a tenant's policy from the named template.
func applyHandler(repo Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, err := uuid.Parse(chi.URLParam(r, "tenant_id"))
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid tenant id")
			return
		}
		name := chi.URLParam(r, "name")
		tpl, ok := templates.ByName(name)
		if !ok {
			writeJSONError(w, http.StatusNotFound,
				"unknown template name; GET /admin/dlp-templates for the catalog")
			return
		}
		if err := repo.UpsertPolicy(r.Context(), tenantID,
			tpl.Action, tpl.ImagePolicy, tpl.CustomPatterns); err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"applied":  tpl.Name,
			"tenant":   tenantID.String(),
			"action":   string(tpl.Action),
			"image":    string(tpl.ImagePolicy),
			"patterns": len(tpl.CustomPatterns),
		})
	}
}

func notConfigured() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSONError(w, http.StatusServiceUnavailable,
			"DLP template repo not wired (no DB pool)")
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]string{"message": message},
	})
}
