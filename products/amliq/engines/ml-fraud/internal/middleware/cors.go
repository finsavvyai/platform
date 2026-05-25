package middleware

import (
	"net/http"
	"os"
	"strings"
)

// DefaultAllowedOrigin is used when no CORS_ALLOWED_ORIGINS env var is set.
const DefaultAllowedOrigin = "https://dashboard.fintech.io"

// CORSConfig holds the CORS middleware configuration.
type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods string
	AllowedHeaders string
	MaxAge         string
}

// DefaultCORSConfig returns a config loaded from the CORS_ALLOWED_ORIGINS env
// variable, falling back to DefaultAllowedOrigin.
func DefaultCORSConfig() *CORSConfig {
	origins := ParseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if len(origins) == 0 {
		origins = []string{DefaultAllowedOrigin}
	}
	return &CORSConfig{
		AllowedOrigins: origins,
		AllowedMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		AllowedHeaders: "Accept, Authorization, Content-Type, X-CSRF-Token, X-API-Key, X-Request-ID",
		MaxAge:         "86400",
	}
}

// ParseAllowedOrigins splits a comma-separated string into a slice of trimmed,
// non-empty origin strings. It rejects the wildcard "*".
func ParseAllowedOrigins(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" && origin != "*" {
			origins = append(origins, origin)
		}
	}
	return origins
}

// CORSMiddlewareChi returns a net/http middleware that enforces an origin
// allowlist. Disallowed origins receive no Access-Control-Allow-Origin header,
// making the browser reject the response. Preflight OPTIONS requests respond
// with 204 and correct CORS headers for allowed origins.
func CORSMiddlewareChi(cfg *CORSConfig) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(cfg.AllowedOrigins))
	for _, o := range cfg.AllowedOrigins {
		allowed[o] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			w.Header().Set("Vary", "Origin")

			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			if _, ok := allowed[origin]; !ok {
				// Do not set any CORS headers -- browser will reject.
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusForbidden)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", cfg.AllowedMethods)
			w.Header().Set("Access-Control-Allow-Headers", cfg.AllowedHeaders)
			w.Header().Set("Access-Control-Max-Age", cfg.MaxAge)

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
