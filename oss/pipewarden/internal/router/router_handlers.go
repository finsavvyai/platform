package router

import (
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/handlers"
)

// isAPIRoute checks if the path is an API endpoint (returns JSON).
func isAPIRoute(path string) bool {
	return len(path) > 4 && path[:4] == "/api"
}

// needsDashboardAuth reports whether the SPA path should require a logged-in
// session. /, /login, /signup, /onboarding, and /quick-start stay public so
// users can reach the auth pages without already being authenticated.
func needsDashboardAuth(path string) bool {
	if auth.SessionSecret() == nil {
		// Auth not configured on this deploy — back-compat for self-hosted
		// users who run pipewarden without setting PIPEWARDEN_SESSION_SECRET.
		return false
	}
	publicPrefixes := []string{
		"/login", "/signup", "/onboarding", "/quick-start",
		"/privacy", "/terms", "/embed", "/.well-known",
		"/reset-password", "/verify-error", "/forgot-password",
	}
	for _, p := range publicPrefixes {
		if strings.HasPrefix(path, p) {
			return false
		}
	}
	if path == "/" || path == "" {
		return false
	}
	return true
}

// hasValidSession is a thin wrapper around auth.SessionFromRequest that
// just returns whether a request carries a verifiable session cookie.
// JWT signature + expiry are checked by SessionFromRequest. The
// password_version claim is checked elsewhere (auth-protected handlers
// fetch the user and compare) — for the dashboard gate we accept any
// signed token to keep this hot path DB-free.
func hasValidSession(r *http.Request) bool {
	_, err := auth.SessionFromRequest(r)
	return err == nil
}

// connHandler routes /api/v1/connections to GET (list) or POST (create).
func connHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.ListConnections(w, r)
		case http.MethodPost:
			h.CreateConnection(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// connDetailHandler routes /api/v1/connections/{name} and its sub-paths.
func connDetailHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path[len("/api/v1/connections/"):]

		if strings.HasSuffix(path, "/test") {
			h.TestConnection(w, r)
			return
		}
		if strings.HasSuffix(path, "/schedule") {
			connScheduleHandler(h, w, r)
			return
		}
		if strings.HasSuffix(path, "/sbom") {
			h.GenerateSBOM(w, r)
			return
		}
		if strings.HasSuffix(path, "/apikey") {
			connAPIKeyHandler(h, w, r)
			return
		}
		if strings.HasSuffix(path, "/health") {
			h.GetHealthScore(w, r)
			return
		}
		if strings.HasSuffix(path, "/scan/history") {
			h.ScanHistory(w, r)
			return
		}
		if strings.HasSuffix(path, "/scan/runtime") {
			h.RuntimeScan(w, r)
			return
		}

		switch r.Method {
		case http.MethodGet:
			h.GetConnection(w, r)
		case http.MethodDelete:
			h.DeleteConnection(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

func connScheduleHandler(h *handlers.Handlers, w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetSchedule(w, r)
	case http.MethodPost:
		h.SetSchedule(w, r)
	case http.MethodDelete:
		h.DeleteSchedule(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func connAPIKeyHandler(h *handlers.Handlers, w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.GenerateAPIKey(w, r)
	case http.MethodDelete:
		h.RevokeAPIKey(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
