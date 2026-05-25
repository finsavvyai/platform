package router

import (
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/handlers"
)

// findingActionHandler routes /api/v1/findings/{id}/{suppress,reopen,fix,fix/pr,fix/pr/batch,similar}.
func findingActionHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/suppress"):
			mustPost(h.SuppressFinding)(w, r)
		case strings.HasSuffix(path, "/reopen"):
			mustPost(h.ReopenFinding)(w, r)
		case strings.HasSuffix(path, "/fix/pr/batch"):
			mustPost(h.CreateFixPRBatch)(w, r)
		case strings.HasSuffix(path, "/fix/pr"):
			mustPost(h.CreateFixPR)(w, r)
		case strings.HasSuffix(path, "/fix"):
			h.GetFixSuggestion(w, r)
		case strings.HasSuffix(path, "/similar"):
			h.GetSimilarFindings(w, r)
		default:
			http.NotFound(w, r)
		}
	}
}

// analysisHandler routes /api/v1/analysis/findings (GET list, PATCH/DELETE by ID).
func analysisHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path[len("/api/v1/analysis/findings"):]
		if path != "" && path != "/" {
			switch r.Method {
			case http.MethodPatch:
				h.UpdateFinding(w, r)
			case http.MethodDelete:
				h.DeleteFinding(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}
		if r.Method == http.MethodGet {
			h.ListFindings(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// policyCollectionHandler routes GET/POST /api/v1/policies.
func policyCollectionHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.ListPolicies(w, r)
		case http.MethodPost:
			h.CreatePolicy(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// policyDetailHandler routes /api/v1/policies/{id}, /test sub-path, and the
// dashboard's /custom and /custom/{id} aliases. The /custom paths are how the
// embedded SPA distinguishes user-created policies from the built-in set.
func policyDetailHandler(h *handlers.Handlers) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// /api/v1/policies/custom — list/create user-defined policies.
		if path == "/api/v1/policies/custom" {
			switch r.Method {
			case http.MethodGet:
				h.ListCustomPolicies(w, r)
			case http.MethodPost:
				h.CreatePolicy(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		// /api/v1/policies/custom/{id} — update or delete a user-defined policy.
		if strings.HasPrefix(path, "/api/v1/policies/custom/") {
			switch r.Method {
			case http.MethodPut:
				h.UpdatePolicy(w, r)
			case http.MethodDelete:
				h.DeletePolicy(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if strings.HasSuffix(path, "/test") {
			mustPost(h.TestPolicy)(w, r)
			return
		}

		switch r.Method {
		case http.MethodPut:
			h.UpdatePolicy(w, r)
		case http.MethodDelete:
			h.DeletePolicy(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// mustPost wraps a handler, returning 405 unless the request is POST.
// Removes boilerplate from the dispatch tables.
func mustPost(fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		fn(w, r)
	}
}
