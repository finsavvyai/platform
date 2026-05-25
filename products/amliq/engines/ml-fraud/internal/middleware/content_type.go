package middleware

import (
	"net/http"
	"strings"
)

// ContentTypeChi returns a Chi/net-http middleware that enforces
// Content-Type: application/json on POST, PUT, and PATCH requests.
// GET, DELETE, OPTIONS, and HEAD requests pass through without checks.
func ContentTypeChi(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch:
			ct := r.Header.Get("Content-Type")
			if ct == "" || !strings.HasPrefix(strings.ToLower(ct), "application/json") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnsupportedMediaType)
				_, _ = w.Write([]byte(`{"error":"content-type must be application/json"}`))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
